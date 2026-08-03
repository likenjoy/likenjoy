package redeem

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// POST /api/v1/redeems/calculate
func (h *Handler) CalculateRedeem(c *gin.Context) {
	var req struct {
		AssetID      uuid.UUID `json:"asset_id" binding:"required"`
		Amount       float64   `json:"amount" binding:"required"`
		PricePerUnit float64   `json:"price_per_unit" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	calc, err := h.svc.CalculateRedeem(req.AssetID, req.Amount, req.PricePerUnit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, calc)
}

// POST /api/v1/redeems/requests
func (h *Handler) SubmitRequest(c *gin.Context) {
	var req struct {
		AssetID         uuid.UUID `json:"asset_id" binding:"required"`
		Type            string    `json:"type" binding:"required"`
		Amount          float64   `json:"amount" binding:"required"`
		Unit            string    `json:"unit" binding:"required"`
		PricePerUnit    float64   `json:"price_per_unit" binding:"required"`
		DeliveryMethod  string    `json:"delivery_method"`
		DeliveryAddress string    `json:"delivery_address"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("user_id")

	request, err := h.svc.SubmitRequest(
		userID.(uuid.UUID),
		req.AssetID,
		RedeemType(req.Type),
		req.Amount,
		req.Unit,
		req.PricePerUnit,
		req.DeliveryMethod,
		req.DeliveryAddress,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, request)
}

// GET /api/v1/redeems/requests/:request_id
func (h *Handler) GetRequest(c *gin.Context) {
	requestID, err := uuid.Parse(c.Param("request_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request_id"})
		return
	}

	request, err := h.svc.GetRequest(requestID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
		return
	}

	c.JSON(http.StatusOK, request)
}

// GET /api/v1/redeems/users/:user_id/requests
func (h *Handler) GetUserRequests(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}

	requests, err := h.svc.GetUserRequests(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, requests)
}

// POST /api/v1/admin/redeems/:request_id/approve
func (h *Handler) ApproveRequest(c *gin.Context) {
	requestID, err := uuid.Parse(c.Param("request_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request_id"})
		return
	}

	approverID, _ := c.Get("user_id")

	request, err := h.svc.ApproveRequest(requestID, approverID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, request)
}

// POST /api/v1/admin/redeems/:request_id/reject
func (h *Handler) RejectRequest(c *gin.Context) {
	requestID, err := uuid.Parse(c.Param("request_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request_id"})
		return
	}

	var req struct {
		Remark string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.RejectRequest(requestID, req.Remark); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "rejected"})
}

// POST /api/v1/admin/redeems/:request_id/complete
func (h *Handler) CompleteRequest(c *gin.Context) {
	requestID, err := uuid.Parse(c.Param("request_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request_id"})
		return
	}

	var req struct {
		TxHash string `json:"tx_hash" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.CompleteRequest(requestID, req.TxHash); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "completed"})
}

// POST /api/v1/admin/redeems/:request_id/ship
func (h *Handler) ShipPhysical(c *gin.Context) {
	requestID, err := uuid.Parse(c.Param("request_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request_id"})
		return
	}

	var req struct {
		TrackingNumber string `json:"tracking_number" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.ShipPhysical(requestID, req.TrackingNumber); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "shipped"})
}

// POST /api/v1/admin/redeems/rules
func (h *Handler) UpsertRule(c *gin.Context) {
	var rule RedeemRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.UpsertRule(&rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rule)
}

// GET /api/v1/redeems/rules/:id
func (h *Handler) GetRule(c *gin.Context) {
	assetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset_id"})
		return
	}

	rule, err := h.svc.GetRule(assetID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}

	c.JSON(http.StatusOK, rule)
}

// GET /api/v1/admin/redeems/pending
func (h *Handler) GetPendingRequests(c *gin.Context) {
	requests, err := h.svc.GetPendingRequests()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, requests)
}
