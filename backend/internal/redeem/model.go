package redeem

import (
	"time"

	"github.com/google/uuid"
)

// RedeemType 赎回类型
type RedeemType string

const (
	RedeemTypePhysical RedeemType = "physical" // 实物赎回（如黄金提货）
	RedeemTypeCash     RedeemType = "cash"     // 现金赎回
	RedeemTypeMaturity RedeemType = "maturity" // 到期赎回
)

// RedeemStatus 赎回状态
type RedeemStatus string

const (
	RedeemStatusPending        RedeemStatus = "pending"         // 待审核
	RedeemStatusApproved       RedeemStatus = "approved"        // 已批准
	RedeemStatusProcessing     RedeemStatus = "processing"      // 处理中
	RedeemStatusShipped        RedeemStatus = "shipped"         // 已发货（实物）
	RedeemStatusDelivered      RedeemStatus = "delivered"       // 已交付
	RedeemStatusCompleted      RedeemStatus = "completed"       // 已完成
	RedeemStatusRejected       RedeemStatus = "rejected"        // 已拒绝
	RedeemStatusCancelled      RedeemStatus = "cancelled"       // 已取消
)

// RedeemRequest 赎回请求
type RedeemRequest struct {
	ID              uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID          uuid.UUID    `json:"user_id" gorm:"type:uuid;not null;index"`
	AssetID         uuid.UUID    `json:"asset_id" gorm:"type:uuid;not null;index"`
	Type            RedeemType   `json:"type" gorm:"not null"`
	Amount          float64      `json:"amount" gorm:"not null"`          // 赎回数量/份额
	Unit            string       `json:"unit" gorm:"not null"`            // 单位：share/gram/oz/bar
	PricePerUnit    float64      `json:"price_per_unit"`                  // 赎回单价
	TotalValue      float64      `json:"total_value" gorm:"not null"`     // 赎回总价值（HKD）
	Fee             float64      `json:"fee" gorm:"default:0"`            // 手续费
	NetAmount       float64      `json:"net_amount"`                      // 净额
	Status          RedeemStatus `json:"status" gorm:"default:'pending'"`
	DeliveryMethod  string       `json:"delivery_method"`                 // 交付方式：pickup/courier/vault_transfer
	DeliveryAddress string       `json:"delivery_address"`                // 交付地址（实物）
	TrackingNumber  string       `json:"tracking_number"`                 // 物流单号
	TxHash          string       `json:"tx_hash"`                         // 链上销毁交易哈希
	ApprovedBy      *uuid.UUID   `json:"approved_by" gorm:"type:uuid"`
	ApprovedAt      *time.Time   `json:"approved_at"`
	CompletedAt     *time.Time   `json:"completed_at"`
	Remark          string       `json:"remark"`
	CreatedAt       time.Time    `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time    `json:"updated_at" gorm:"autoUpdateTime"`
}

// RedeemRule 赎回规则（按资产配置）
type RedeemRule struct {
	ID              uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	AssetID         uuid.UUID  `json:"asset_id" gorm:"type:uuid;not null;uniqueIndex"`
	MinAmount       float64    `json:"min_amount" gorm:"not null"`        // 最小赎回量
	MaxAmount       *float64   `json:"max_amount"`                        // 最大赎回量（nil=无上限）
	LockPeriodDays  int        `json:"lock_period_days" gorm:"default:0"` // 锁定期（天）
	FeeRate         float64    `json:"fee_rate" gorm:"default:0"`         // 赎回费率
	AllowPhysical   bool       `json:"allow_physical" gorm:"default:false"`
	AllowCash       bool       `json:"allow_cash" gorm:"default:true"`
	PhysicalMinUnit float64    `json:"physical_min_unit"`                 // 实物最小单位（如金条100g）
	ProcessingDays  int        `json:"processing_days" gorm:"default:3"`  // 处理工作日
	IsActive        bool       `json:"is_active" gorm:"default:true"`
	CreatedAt       time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time  `json:"updated_at" gorm:"autoUpdateTime"`
}

// RedeemCalculation 赎回计算结果
type RedeemCalculation struct {
	Amount       float64 `json:"amount"`
	PricePerUnit float64 `json:"price_per_unit"`
	TotalValue   float64 `json:"total_value"`
	Fee          float64 `json:"fee"`
	NetAmount    float64 `json:"net_amount"`
	IsEligible   bool    `json:"is_eligible"`
	BlockReason  string  `json:"block_reason,omitempty"`
}
