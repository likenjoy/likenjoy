package ad

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

type adReq struct {
	Title     string `json:"title" binding:"required"`
	ImageURL  string `json:"image_url"`
	LinkURL   string `json:"link_url"`
	Position  string `json:"position"`
	Enabled   bool   `json:"enabled"`
	SortOrder int    `json:"sort_order"`
}

// GET /api/ads?position=home_banner  公开查询（无鉴权）
func (h *Handler) ListPublic(c *gin.Context) {
	position := c.DefaultQuery("position", "home_banner")
	ads, err := h.svc.ListEnabled(position)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ads})
}

// GET /api/admin/ads  管理后台：全部广告
func (h *Handler) ListAdmin(c *gin.Context) {
	ads, err := h.svc.List()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ads})
}

// POST /api/admin/ads  新增
func (h *Handler) Create(c *gin.Context) {
	var req adReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	adminID := c.GetString("user_id")
	a, err := h.svc.Create(req.Title, req.ImageURL, req.LinkURL, req.Position, req.Enabled, req.SortOrder, adminID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, a)
}

// PUT /api/admin/ads/:id  更新
func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	var req adReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	a, err := h.svc.Update(id, req.Title, req.ImageURL, req.LinkURL, req.Position, req.Enabled, req.SortOrder)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, a)
}

// DELETE /api/admin/ads/:id  删除
func (h *Handler) Delete(c *gin.Context) {
	if err := h.svc.Delete(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
