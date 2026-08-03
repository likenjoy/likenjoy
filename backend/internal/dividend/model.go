package dividend

import (
	"time"

	"github.com/google/uuid"
)

// DividendType 分红类型
type DividendType string

const (
	DividendTypeCash     DividendType = "cash"     // 现金分红
	DividendTypeInterest DividendType = "interest" // 固定计息
	DividendTypeBonus    DividendType = "bonus"    // 额外收益
)

// DividendStatus 分红状态
type DividendStatus string

const (
	DividendStatusPending    DividendStatus = "pending"    // 待发放
	DividendStatusProcessing DividendStatus = "processing" // 处理中
	DividendStatusPaid       DividendStatus = "paid"       // 已发放
	DividendStatusFailed     DividendStatus = "failed"     // 发放失败
	DividendStatusCancelled  DividendStatus = "cancelled"  // 已取消
)

// DividendPlan 分红/计息计划
type DividendPlan struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	AssetID       uuid.UUID      `json:"asset_id" gorm:"type:uuid;not null;index"`
	Name          string         `json:"name" gorm:"not null"`
	Type          DividendType   `json:"type" gorm:"not null"`
	Rate          float64        `json:"rate" gorm:"not null"` // 年化利率/分红率（百分比）
	Frequency     string         `json:"frequency" gorm:"not null"` // monthly/quarterly/semi_annual/annual/maturity
	StartDate     time.Time      `json:"start_date" gorm:"not null"`
	EndDate       *time.Time     `json:"end_date"`
	NextPayDate   *time.Time     `json:"next_pay_date"`
	TotalPeriods  int            `json:"total_periods"`
	PaidPeriods   int            `json:"paid_periods" gorm:"default:0"`
	Status        DividendStatus `json:"status" gorm:"default:'pending'"`
	CreatedBy     uuid.UUID      `json:"created_by" gorm:"type:uuid;not null"`
	CreatedAt     time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
}

// DividendRecord 分红发放记录
type DividendRecord struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	PlanID      uuid.UUID      `json:"plan_id" gorm:"type:uuid;not null;index"`
	UserID      uuid.UUID      `json:"user_id" gorm:"type:uuid;not null;index"`
	AssetID     uuid.UUID      `json:"asset_id" gorm:"type:uuid;not null"`
	PeriodNum   int            `json:"period_num" gorm:"not null"`
	Amount      float64        `json:"amount" gorm:"not null"`      // 分红金额（HKD）
	HoldingAmount float64      `json:"holding_amount" gorm:"not null"` // 持有份额
	Rate        float64        `json:"rate" gorm:"not null"`        // 实际执行利率
	Status      DividendStatus `json:"status" gorm:"default:'pending'"`
	PaidAt      *time.Time     `json:"paid_at"`
	TxHash      string         `json:"tx_hash"`                    // 链上交易哈希
	Remark      string         `json:"remark"`
	CreatedAt   time.Time      `json:"created_at" gorm:"autoCreateTime"`
}

// InterestAccrual 计息累计
type InterestAccrual struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	PlanID        uuid.UUID `json:"plan_id" gorm:"type:uuid;not null;index"`
	UserID        uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index"`
	AssetID       uuid.UUID `json:"asset_id" gorm:"type:uuid;not null"`
	Principal     float64   `json:"principal" gorm:"not null"`     // 本金
	AccruedAmount float64   `json:"accrued_amount" gorm:"not null"` // 累计应计利息
	PaidAmount    float64   `json:"paid_amount" gorm:"default:0"`   // 已支付利息
	LastAccrualAt time.Time `json:"last_accrual_at"`
	UpdatedAt     time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

// DividendCalculation 分红计算结果
type DividendCalculation struct {
	UserID        uuid.UUID `json:"user_id"`
	HoldingAmount float64   `json:"holding_amount"`
	Rate          float64   `json:"rate"`
	PeriodAmount  float64   `json:"period_amount"`
	TotalAmount   float64   `json:"total_amount"`
	Periods       int       `json:"periods"`
}
