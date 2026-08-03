package user

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type Handler struct {
	svc       *Service
	jwtSecret string
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc, jwtSecret: "change-me-in-production"}
}

type RegisterRequest struct {
	Email    string   `json:"email" binding:"required,email"`
	Password string   `json:"password" binding:"required,min=8"`
	Phone    string   `json:"phone"`
	Role     UserRole `json:"role" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	u, err := h.svc.Register(req.Email, req.Password, req.Phone, req.Role)
	if err != nil {
		if err == ErrEmailTaken {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":    u.ID,
		"email": u.Email,
		"role":  u.Role,
	})
}

// GET /api/admin/users?page=1&size=20
func (h *Handler) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	if size > 100 {
		size = 100
	}
	users, total, err := h.svc.ListAllAdmin(size, (page-1)*size)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": users, "total": total, "page": page, "size": size})
}

func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	u, err := h.svc.Authenticate(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	token, err := h.generateToken(u)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":             u.ID,
			"email":          u.Email,
			"role":           u.Role,
			"wallet_address": u.WalletAddress,
		},
	})
}

// BindWalletRequest 钱包绑定请求
type BindWalletRequest struct {
	WalletAddress string `json:"wallet_address" binding:"required"`
	Signature     string `json:"signature" binding:"required"`
	Message       string `json:"message" binding:"required"`
}

// BindWallet 校验钱包签名所有权后绑定地址到当前用户
func (h *Handler) BindWallet(c *gin.Context) {
	var req BindWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	expected := common.HexToAddress(req.WalletAddress)
	if expected == (common.Address{}) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid wallet address"})
		return
	}

	recovered, err := RecoverPersonalSignAddress(req.Message, req.Signature)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature: " + err.Error()})
		return
	}
	if !strings.EqualFold(recovered.Hex(), expected.Hex()) {
		c.JSON(http.StatusForbidden, gin.H{"error": "signature does not match wallet address"})
		return
	}

	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}
	uid, ok := userID.(interface{ String() string })
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "bad user id"})
		return
	}

	if err := h.svc.BindWallet(uid.String(), req.WalletAddress); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	u2, err := h.svc.GetByIDString(uid.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":             u2.ID,
		"email":          u2.Email,
		"role":           u2.Role,
		"wallet_address": u2.WalletAddress,
	})
}

// RecoverPersonalSignAddress 验证 EIP-191 personal_sign 签名并返回签名者地址
func RecoverPersonalSignAddress(message, signature string) (common.Address, error) {
	sig := common.FromHex(signature)
	if len(sig) != 65 {
		return common.Address{}, fmt.Errorf("signature length %d != 65", len(sig))
	}
	// 兼容 v=27/28 与 v=0/1
	if sig[64] == 27 || sig[64] == 28 {
		sig[64] -= 27
	}
	msg := fmt.Sprintf("\x19Ethereum Signed Message:\n%d%s", len(message), message)
	hash := crypto.Keccak256Hash([]byte(msg))
	pub, err := crypto.Ecrecover(hash.Bytes(), sig)
	if err != nil {
		return common.Address{}, fmt.Errorf("ecrecover: %w", err)
	}
	addr := common.BytesToAddress(crypto.Keccak256(pub[1:])[12:])
	return addr, nil
}

func (h *Handler) generateToken(u *User) (string, error) {
	claims := Claims{
		UserID: u.ID.String(),
		Email:  u.Email,
		Role:   string(u.Role),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.jwtSecret))
}
