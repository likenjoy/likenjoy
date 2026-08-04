package relay

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler EIP-2771 元交易中继 HTTP 处理器
type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// ExecuteRequest 中继请求体
// 注意：数字字段不能用 binding:"required"（Gin validator 对零值判定为空，nonce=0 会被误拒）
type ExecuteRequest struct {
	From      string `json:"from" binding:"required"`
	To        string `json:"to" binding:"required"`
	Value     string `json:"value" binding:"required"`
	Gas       uint64 `json:"gas"`
	Nonce     uint64 `json:"nonce"`
	Deadline  uint64 `json:"deadline"`
	Data      string `json:"data" binding:"required"`
	Signature string `json:"signature" binding:"required"`
}

// Execute POST /api/relay/execute
// 平台代付 gas 转发用户的 EIP-2771 元交易（如免 gas 的合规转账）
func (h *Handler) Execute(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := userID.(uuid.UUID)

	boundWallet := c.GetString("wallet_address")

	var req ExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	txHash, err := h.svc.Execute(c.Request.Context(), &ForwardRequest{
		From:      req.From,
		To:        req.To,
		Value:     req.Value,
		Gas:       req.Gas,
		Nonce:     req.Nonce,
		Deadline:  req.Deadline,
		Data:      req.Data,
		Signature: req.Signature,
	}, boundWallet, uid)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tx_hash": txHash, "relayed_by": "platform"})
}
