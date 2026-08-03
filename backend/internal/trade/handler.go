package trade

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

type placeOrderReq struct {
	AssetID   string `json:"asset_id" binding:"required"`
	RoundID   string `json:"round_id"`
	Side      string `json:"side" binding:"required"`
	OrderType string `json:"order_type" binding:"required"`
	Price     string `json:"price"`
	Quantity  string `json:"quantity" binding:"required"`
	ExpiresAt *int64 `json:"expires_at"`
}

func (h *Handler) PlaceOrder(c *gin.Context) {
	var req placeOrderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := uuid.Parse(c.GetString("user_id"))
	assetID, _ := uuid.Parse(req.AssetID)

	var roundID *uuid.UUID
	if req.RoundID != "" {
		rid, _ := uuid.Parse(req.RoundID)
		roundID = &rid
	}

	var expiresAt *time.Time
	if req.ExpiresAt != nil {
		t := time.Unix(*req.ExpiresAt, 0)
		expiresAt = &t
	}

	order, err := h.svc.PlaceOrder(userID, assetID, roundID, OrderSide(req.Side), OrderType(req.OrderType), req.Price, req.Quantity, expiresAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, order)
}

func (h *Handler) CancelOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}
	userID, _ := uuid.Parse(c.GetString("user_id"))
	if err := h.svc.CancelOrder(orderID, userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "cancelled"})
}

func (h *Handler) MatchOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}
	trade, err := h.svc.MatchOrder(orderID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, trade)
}

func (h *Handler) GetOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}
	order, err := h.svc.GetOrder(orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	c.JSON(http.StatusOK, order)
}

func (h *Handler) ListUserOrders(c *gin.Context) {
	userID, _ := uuid.Parse(c.GetString("user_id"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	orders, total, err := h.svc.ListUserOrders(userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orders, "total": total})
}

func (h *Handler) ListAssetTrades(c *gin.Context) {
	assetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset id"})
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	trades, total, err := h.svc.ListAssetTrades(assetID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": trades, "total": total})
}

func (h *Handler) ListUserTrades(c *gin.Context) {
	userID, _ := uuid.Parse(c.GetString("user_id"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	trades, total, err := h.svc.ListUserTrades(userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": trades, "total": total})
}

// --- Whitelist ---

type whitelistAddReq struct {
	AssetID   string `json:"asset_id" binding:"required"`
	UserID    string `json:"user_id" binding:"required"`
	ExpiresAt *int64 `json:"expires_at"`
}

func (h *Handler) AddToWhitelist(c *gin.Context) {
	var req whitelistAddReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	assetID, _ := uuid.Parse(req.AssetID)
	userID, _ := uuid.Parse(req.UserID)
	addedBy, _ := uuid.Parse(c.GetString("user_id"))

	var expiresAt *time.Time
	if req.ExpiresAt != nil {
		t := time.Unix(*req.ExpiresAt, 0)
		expiresAt = &t
	}

	if err := h.svc.AddToWhitelist(assetID, userID, addedBy, expiresAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "whitelisted"})
}

type whitelistRemoveReq struct {
	AssetID string `json:"asset_id" binding:"required"`
	UserID  string `json:"user_id" binding:"required"`
}

func (h *Handler) RemoveFromWhitelist(c *gin.Context) {
	var req whitelistRemoveReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	assetID, _ := uuid.Parse(req.AssetID)
	userID, _ := uuid.Parse(req.UserID)
	if err := h.svc.RemoveFromWhitelist(assetID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}
