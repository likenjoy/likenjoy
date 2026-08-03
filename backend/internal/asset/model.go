package asset

import (
	"time"

	"github.com/google/uuid"
)

// AssetType 资产类型
type AssetType string

const (
	AssetTypeGold       AssetType = "gold"       // 黄金
	AssetTypeCarbon     AssetType = "carbon"     // 碳汇
	AssetTypeRealEstate AssetType = "realestate" // 地产收益权
	AssetTypePrivateDebt AssetType = "privatedebt" // 私募债
	AssetTypeOther      AssetType = "other"
)

// AssetStatus 资产状态
type AssetStatus string

const (
	StatusDraft     AssetStatus = "draft"     // 草稿
	StatusReviewing AssetStatus = "reviewing" // 审核中
	StatusApproved  AssetStatus = "approved"  // 已批准
	StatusIssuing   AssetStatus = "issuing"   // 发行中
	StatusLive      AssetStatus = "live"      // 已上线
	StatusSettled   AssetStatus = "settled"   // 已结算
	StatusRejected  AssetStatus = "rejected"  // 已驳回
)

// Asset 资产
type Asset struct {
	ID              uuid.UUID   `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	IssuerID        uuid.UUID   `json:"issuer_id" gorm:"type:uuid;not null;index"`
	Name            string      `json:"name" gorm:"not null"`
	Symbol          string      `json:"symbol" gorm:"uniqueIndex;not null"`
	AssetType       AssetType   `json:"asset_type" gorm:"not null"`
	Description     string      `json:"description"`
	TotalSupply     string      `json:"total_supply" gorm:"type:numeric(78,0);not null"` // 总发行量（链上精度）
	PricePerUnit    string      `json:"price_per_unit" gorm:"type:numeric(36,6);not null"` // 单价（法币）
	Currency        string      `json:"currency" gorm:"default:'HKD'"`
	MinInvestment   string      `json:"min_investment" gorm:"type:numeric(36,2);not null"` // 最低投资额
	MaxInvestment   string      `json:"max_investment" gorm:"type:numeric(36,2)"`
	LockupPeriod    int         `json:"lockup_period" gorm:"default:0"` // 锁定期（天）
	ContractAddress string      `json:"contract_address"`              // 部署后填充
	ChainID         int64       `json:"chain_id" gorm:"default:42161"` // 默认 Arbitrum
	Status          AssetStatus `json:"status" gorm:"default:'draft'"`
	MetadataURI     string      `json:"metadata_uri"` // IPFS/链上元数据
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}

// AssetDocument 资产证明文件
type AssetDocument struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	AssetID   uuid.UUID `json:"asset_id" gorm:"type:uuid;not null;index"`
	DocType   string    `json:"doc_type" gorm:"not null"` // valuation_report, legal_opinion, audit_report, custody_proof, insurance
	FileName  string    `json:"file_name" gorm:"not null"`
	FileHash  string    `json:"file_hash"` // SHA256
	FileURL   string    `json:"file_url"`
	CreatedAt time.Time `json:"created_at"`
}

// IssuanceRound 发行轮次
type IssuanceRound struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	AssetID      uuid.UUID `json:"asset_id" gorm:"type:uuid;not null;index"`
	RoundNumber  int       `json:"round_number" gorm:"not null"`
	Supply       string    `json:"supply" gorm:"type:numeric(78,0);not null"`
	PricePerUnit string    `json:"price_per_unit" gorm:"type:numeric(36,6);not null"`
	StartTime    time.Time `json:"start_time" gorm:"not null"`
	EndTime      time.Time `json:"end_time" gorm:"not null"`
	MinAlloc     string    `json:"min_alloc" gorm:"type:numeric(78,0)"`
	MaxAlloc     string    `json:"max_alloc" gorm:"type:numeric(78,0)"`
	Sold         string    `json:"sold" gorm:"type:numeric(78,0);default:'0'"`
	Status       string    `json:"status" gorm:"default:'upcoming'"` // upcoming, active, closed, settled
	CreatedAt    time.Time `json:"created_at"`
}
