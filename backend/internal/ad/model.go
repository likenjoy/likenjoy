package ad

import (
	"time"

	"github.com/google/uuid"
)

// Advertisement 广告位（Landing/交易页等展示，管理后台维护）
type Advertisement struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	ImageURL  string    `json:"image_url"` // 图片地址（可留空则用标题背景）
	LinkURL   string    `json:"link_url"`  // 跳转链接
	Position  string    `json:"position"`  // 广告位：home_banner（首页横幅）等
	Enabled   bool      `json:"enabled"`   // 是否启用
	SortOrder int       `json:"sort_order"`
	CreatedBy string    `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// NewID 生成广告 ID
func NewID() string { return uuid.NewString() }
