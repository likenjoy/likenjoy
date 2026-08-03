package kyc

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

type SubmitKYCRequest struct {
	UserID             string `json:"user_id" binding:"required"`
	FullName           string `json:"full_name"`                     // 用于制裁名单筛查
	Country            string `json:"country"`                       // ISO 3166-1 alpha-2，锁区检查
	AccreditationLevel string `json:"accreditation_level"`           // individual / professional_investor
	NetWorthProof      string `json:"net_worth_proof"`               // 资产证明文件 hash
}

type UploadDocRequest struct {
	UserID   string `json:"user_id" binding:"required"`
	DocType  string `json:"doc_type" binding:"required"`
	FileName string `json:"file_name" binding:"required"`
	FileHash string `json:"file_hash" binding:"required"`
}

type ReviewRequest struct {
	SubmissionID string `json:"submission_id" binding:"required"`
	ReviewerID   string `json:"reviewer_id" binding:"required"`
	Action       string `json:"action" binding:"required,oneof=approve reject"`
	Reason       string `json:"reason"`
}

func (h *Handler) Submit(c *gin.Context) {
	var req SubmitKYCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	uid, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}
	sub, err := h.svc.Submit(uid, req.FullName, req.Country, req.AccreditationLevel, req.NetWorthProof)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, sub)
}

func (h *Handler) GetStatus(c *gin.Context) {
	userID := c.Param("user_id")
	uid, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}
	sub, err := h.svc.GetSubmission(uid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sub)
}

func (h *Handler) UploadDocument(c *gin.Context) {
	var req UploadDocRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	uid, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}
	if err := h.svc.UploadDocument(uid, req.DocType, req.FileName, req.FileHash); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "uploaded"})
}

// GET /api/kyc/accreditation/:user_id
func (h *Handler) GetAccreditation(c *gin.Context) {
	userID := c.Param("user_id")
	uid, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}
	check, err := h.svc.GetAccreditation(uid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, check)
}

// GET /api/admin/kyc/pending
func (h *Handler) ListPending(c *gin.Context) {
	list, err := h.svc.ListPending()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": list, "total": len(list)})
}

func (h *Handler) Review(c *gin.Context) {
	var req ReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	subID, _ := uuid.Parse(req.SubmissionID)
	revID, _ := uuid.Parse(req.ReviewerID)

	switch req.Action {
	case "approve":
		if err := h.svc.Approve(subID, revID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	case "reject":
		if err := h.svc.Reject(subID, revID, req.Reason); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"status": req.Action + "d"})
}
