package dividend

import (
	"net/http"
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

// POST /api/v1/assets/:id/dividends/plans
func (h *Handler) CreatePlan(c *gin.Context) {
	assetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset_id"})
		return
	}

	var req struct {
		Name         string  `json:"name" binding:"required"`
		Type         string  `json:"type" binding:"required"`
		Rate         float64 `json:"rate" binding:"required"`
		Frequency    string  `json:"frequency" binding:"required"`
		StartDate    string  `json:"start_date" binding:"required"`
		EndDate      string  `json:"end_date"`
		TotalPeriods int     `json:"total_periods" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createdBy, _ := c.Get("user_id")

	startDate, err := parseDate(req.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_date"})
		return
	}

	var endDate *time.Time
	if req.EndDate != "" {
		ed, err := parseDate(req.EndDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_date"})
			return
		}
		endDate = &ed
	}

	plan, err := h.svc.CreatePlan(assetID, createdBy.(uuid.UUID), req.Name, DividendType(req.Type), req.Rate, req.Frequency, startDate, endDate, req.TotalPeriods)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, plan)
}

// GET /api/v1/assets/:id/dividends/plans
func (h *Handler) GetPlansByAsset(c *gin.Context) {
	assetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset_id"})
		return
	}

	plans, err := h.svc.GetPlansByAsset(assetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, plans)
}

// GET /api/v1/dividends/plans/:plan_id
func (h *Handler) GetPlan(c *gin.Context) {
	planID, err := uuid.Parse(c.Param("plan_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid plan_id"})
		return
	}

	plan, err := h.svc.GetPlan(planID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "plan not found"})
		return
	}

	c.JSON(http.StatusOK, plan)
}

// POST /api/v1/dividends/plans/:plan_id/pay
func (h *Handler) PayDividend(c *gin.Context) {
	planID, err := uuid.Parse(c.Param("plan_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid plan_id"})
		return
	}

	var req struct {
		PeriodNum    int                   `json:"period_num" binding:"required"`
		Calculations []DividendCalculation `json:"calculations" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	records, err := h.svc.PayDividend(planID, req.PeriodNum, req.Calculations)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, records)
}

// POST /api/v1/dividends/plans/:plan_id/accrue
func (h *Handler) AccrueInterest(c *gin.Context) {
	planID, err := uuid.Parse(c.Param("plan_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid plan_id"})
		return
	}

	var req struct {
		UserID    uuid.UUID `json:"user_id" binding:"required"`
		AssetID   uuid.UUID `json:"asset_id" binding:"required"`
		Principal float64   `json:"principal" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	accrual, err := h.svc.AccrueInterest(planID, req.UserID, req.AssetID, req.Principal)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, accrual)
}

// GET /api/v1/dividends/users/:user_id/records
func (h *Handler) GetUserRecords(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}

	records, err := h.svc.GetUserRecords(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, records)
}

// GET /api/v1/dividends/plans/:plan_id/accruals/:user_id
func (h *Handler) GetUserAccrual(c *gin.Context) {
	planID, err := uuid.Parse(c.Param("plan_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid plan_id"})
		return
	}
	userID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}

	accrual, err := h.svc.GetUserAccrual(planID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "accrual not found"})
		return
	}

	c.JSON(http.StatusOK, accrual)
}

// --- helpers ---

func parseDate(s string) (time.Time, error) {
	formats := []string{"2006-01-02", "2006-01-02T15:04:05Z", "2006-01-02T15:04:05Z07:00"}
	for _, f := range formats {
		t, err := time.Parse(f, s)
		if err == nil {
			return t, nil
		}
	}
	return time.Parse("2006-01-02", s)
}
