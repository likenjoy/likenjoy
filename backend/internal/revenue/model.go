package revenue

import (
	"time"

	"github.com/google/uuid"
)

// PlatformFee 平台费率配置（单一配置行，id 固定为 "default"）
type PlatformFee struct {
	ID              string    `json:"id"`
	MintFeeRate     int64     `json:"mint_fee_rate"`     // 万分数：100 = 1%
	TransferFeeRate int64     `json:"transfer_fee_rate"` // 万分数（转账费，预留）
	GasMarkupRate   int64     `json:"gas_markup_rate"`   // 万分数：gas 加价
	TreasuryAddress string    `json:"treasury_address"`  // 平台金库地址
	UpdatedBy       string    `json:"updated_by"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// RevenueRecord 收入流水（合规审计：每笔收入留痕）
type RevenueRecord struct {
	ID         uuid.UUID `json:"id"`
	Category   string    `json:"category"` // mint_fee / redeem_fee / transfer_fee / gas_markup
	AssetID    string    `json:"asset_id"`
	UserID     string    `json:"user_id"`
	Amount     string    `json:"amount"` // 金额（decimal 字符串）
	Currency   string    `json:"currency"`
	TxHash     string    `json:"tx_hash"`
	GasUsedWei string    `json:"gas_used_wei"`
	Detail     string    `json:"detail"`
	CreatedAt  time.Time `json:"created_at"`
}

// GasRecord 链上交易 gas 记账
type GasRecord struct {
	ID          uuid.UUID `json:"id"`
	TxHash      string    `json:"tx_hash"`
	ChainID     int64     `json:"chain_id"`
	Action      string    `json:"action"`
	AssetID     string    `json:"asset_id"`
	UserID      string    `json:"user_id"`
	GasUsedWei  string    `json:"gas_used_wei"`
	GasPriceWei string    `json:"gas_price_wei"`
	CostWei     string    `json:"cost_wei"`
	CreatedAt   time.Time `json:"created_at"`
}

// AuditLog 管理操作审计（合规留痕）
type AuditLog struct {
	ID        uuid.UUID `json:"id"`
	AdminID   string    `json:"admin_id"`
	Action    string    `json:"action"`
	Target    string    `json:"target"`
	Detail    string    `json:"detail"`
	CreatedAt time.Time `json:"created_at"`
}
