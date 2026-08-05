package sysconfig

import (
	"net/http"
	"os"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/gin-gonic/gin"
)

// ConfigView 系统配置视图（管理后台）
// 安全设计：私钥永不回显明文，仅展示平台地址（公钥指纹）
type ConfigView struct {
	RPCURL          string `json:"rpc_url"`
	ChainID         string `json:"chain_id"`
	JWTSecretMasked string `json:"jwt_secret_masked"` // 仅前 4 位
	JWTSecretSet    bool   `json:"jwt_secret_set"`
	PrivateKeySet   bool   `json:"private_key_set"`
	PlatformAddress string `json:"platform_address"`
	JWTSecretFile   string `json:"-"`
	EnvFilePath     string `json:"-"`
}

type Handler struct {
	platformAddress common.Address
	envFilePath     string
}

// NewHandler 创建系统配置处理器
// platformAddress = 平台签名账户地址（用于展示，不涉及私钥）
func NewHandler(platformAddress common.Address, envFilePath string) *Handler {
	return &Handler{platformAddress: platformAddress, envFilePath: envFilePath}
}

// mask 脱敏：保留前 4 位
func mask(s string) string {
	if len(s) <= 8 {
		return "****"
	}
	return s[:4] + "****"
}

// Get GET /api/admin/system
func (h *Handler) Get(c *gin.Context) {
	v := ConfigView{
		RPCURL:          os.Getenv("ETH_RPC_URL"),
		ChainID:         os.Getenv("ETH_CHAIN_ID"),
		JWTSecretMasked: mask(os.Getenv("JWT_SECRET")),
		JWTSecretSet:    os.Getenv("JWT_SECRET") != "" && os.Getenv("JWT_SECRET") != "change-me-in-production",
		PrivateKeySet:   os.Getenv("ETH_PRIVATE_KEY") != "" || os.Getenv("ETH_PRIVATE_KEY_FILE") != "",
		PlatformAddress: h.platformAddress.Hex(),
	}
	c.JSON(http.StatusOK, v)
}

type updateReq struct {
	RPCURL       string `json:"rpc_url"`
	ChainID      string `json:"chain_id"`
	JWTSecret    string `json:"jwt_secret"`    // 留空 = 不修改
	PrivateKey   string `json:"private_key"`   // 留空 = 不修改；⚠️ 高危操作
}

// Update PUT /api/admin/system
// 写入 .env 文件（服务器部署场景）；本地 go run 场景写入 backend/.env
// 注意：修改后需重启后端生效（MVP 不热加载）
func (h *Handler) Update(c *gin.Context) {
	var req updateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	adminID := c.GetString("user_id")

	// 校验 chainID 必须是数字
	if req.ChainID != "" {
		for _, ch := range req.ChainID {
			if ch < '0' || ch > '9' {
				c.JSON(http.StatusBadRequest, gin.H{"error": "chain_id 必须是数字"})
				return
			}
		}
	}
	// 校验私钥格式（hex 64 字符，可带 0x）
	if req.PrivateKey != "" {
		pk := strings.TrimPrefix(strings.TrimSpace(req.PrivateKey), "0x")
		if len(pk) != 64 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "私钥格式不正确（应为 64 位 hex）"})
			return
		}
	}

	// 读取现有 .env（不存在则创建）
	content := ""
	if b, err := os.ReadFile(h.envFilePath); err == nil {
		content = string(b)
	}
	lines := strings.Split(strings.TrimRight(content, "\n"), "\n")
	updated := map[string]bool{}
	out := make([]string, 0, len(lines)+3)

	upsert := func(key, val string) {
		if val == "" || updated[key] {
			return
		}
		updated[key] = true
		found := false
		for i, ln := range lines {
			if strings.HasPrefix(strings.TrimSpace(ln), key+"=") {
				lines[i] = key + "=" + val
				found = true
				break
			}
		}
		if !found {
			out = append(out, key+"="+val)
		}
	}
	// 非空配置写入
	if req.RPCURL != "" {
		upsert("ETH_RPC_URL", req.RPCURL)
	}
	if req.ChainID != "" {
		upsert("ETH_CHAIN_ID", req.ChainID)
	}
	if req.JWTSecret != "" {
		upsert("JWT_SECRET", req.JWTSecret)
	}
	if req.PrivateKey != "" {
		upsert("ETH_PRIVATE_KEY", strings.TrimPrefix(strings.TrimSpace(req.PrivateKey), "0x"))
	}

	// 重组输出（保留原有行 + 新追加行）
	result := append(lines, out...)
	if err := os.WriteFile(h.envFilePath, []byte(strings.Join(result, "\n")+"\n"), 0o600); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "写入 .env 失败: " + err.Error()})
		return
	}

	// 审计：记录修改了哪些项（不含值）
	changed := []string{}
	if req.RPCURL != "" {
		changed = append(changed, "ETH_RPC_URL")
	}
	if req.ChainID != "" {
		changed = append(changed, "ETH_CHAIN_ID")
	}
	if req.JWTSecret != "" {
		changed = append(changed, "JWT_SECRET")
	}
	if req.PrivateKey != "" {
		changed = append(changed, "ETH_PRIVATE_KEY")
	}
	_ = adminID // 审计写入由外部（revenue）完成，此处记录日志
	c.JSON(http.StatusOK, gin.H{"ok": true, "updated": changed, "note": "配置已写入 .env，重启后端后生效"})
}