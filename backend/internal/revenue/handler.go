package revenue

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// GET /api/admin/fees
func (h *Handler) GetFees(c *gin.Context) {
	f, err := h.svc.GetFee()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, f)
}

type updateFeesReq struct {
	MintFeeRate     int64  `json:"mint_fee_rate"`
	TransferFeeRate int64  `json:"transfer_fee_rate"`
	GasMarkupRate   int64  `json:"gas_markup_rate"`
	TreasuryAddress string `json:"treasury_address"`
}

// PUT /api/admin/fees
func (h *Handler) UpdateFees(c *gin.Context) {
	var req updateFeesReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	adminID := c.GetString("user_id")
	f, err := h.svc.UpdateFee(req.MintFeeRate, req.TransferFeeRate, req.GasMarkupRate, req.TreasuryAddress, adminID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	_ = h.svc.RecordAudit(adminID, "update_fees", "default",
		"mint_fee_rate="+strconv.FormatInt(req.MintFeeRate, 10)+",transfer_fee_rate="+strconv.FormatInt(req.TransferFeeRate, 10)+",gas_markup_rate="+strconv.FormatInt(req.GasMarkupRate, 10))
	c.JSON(http.StatusOK, f)
}

// GET /api/admin/revenue?page=1&size=20
func (h *Handler) ListRevenue(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	if size > 100 {
		size = 100
	}
	recs, total, err := h.svc.ListRevenue(size, (page-1)*size)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": recs, "total": total, "page": page, "size": size})
}

// GET /api/admin/gas?page=1&size=20
func (h *Handler) ListGas(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	if size > 100 {
		size = 100
	}
	recs, total, err := h.svc.ListGas(size, (page-1)*size)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": recs, "total": total, "page": page, "size": size})
}

// GET /api/admin/audit?page=1&size=20
func (h *Handler) ListAudit(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	if size > 100 {
		size = 100
	}
	recs, total, err := h.svc.ListAudit(size, (page-1)*size)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": recs, "total": total, "page": page, "size": size})
}
