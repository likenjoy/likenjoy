package trade

import (
	"time"

	"github.com/google/uuid"
)

// OrderSide 买卖方向
type OrderSide string

const (
	SideBuy  OrderSide = "buy"
	SideSell OrderSide = "sell"
)

// OrderType 订单类型
type OrderType string

const (
	TypeMarket OrderType = "market" // 市价单
	TypeLimit  OrderType = "limit"  // 限价单
)

// OrderStatus 订单状态
type OrderStatus string

const (
	OrderPending   OrderStatus = "pending"   // 待成交
	OrderPartial   OrderStatus = "partial"   // 部分成交
	OrderFilled    OrderStatus = "filled"    // 全部成交
	OrderCancelled OrderStatus = "cancelled" // 已取消
	OrderExpired   OrderStatus = "expired"   // 已过期
)

// SettlementStatus 结算状态
type SettlementStatus string

const (
	SettlementPending    SettlementStatus = "pending"
	SettlementProcessing SettlementStatus = "processing"
	SettlementCompleted  SettlementStatus = "completed"
	SettlementFailed     SettlementStatus = "failed"
)

// Order 订单
type Order struct {
	ID          uuid.UUID   `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID      uuid.UUID   `json:"user_id" gorm:"type:uuid;not null;index"`
	AssetID     uuid.UUID   `json:"asset_id" gorm:"type:uuid;not null;index"`
	RoundID     *uuid.UUID  `json:"round_id" gorm:"type:uuid;index"`
	Side        OrderSide   `json:"side" gorm:"not null"`
	OrderType   OrderType   `json:"order_type" gorm:"not null"`
	Price       string      `json:"price" gorm:"type:numeric(36,6)"` // 限价单价格
	Quantity    string      `json:"quantity" gorm:"type:numeric(78,0);not null"`
	FilledQty   string      `json:"filled_qty" gorm:"type:numeric(78,0);default:'0'"`
	TotalAmount string      `json:"total_amount" gorm:"type:numeric(36,6)"` // quantity * price
	Status      OrderStatus `json:"status" gorm:"default:'pending'"`
	ExpiresAt   *time.Time  `json:"expires_at"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

// Trade 成交记录
type Trade struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	BuyOrderID  uuid.UUID `json:"buy_order_id" gorm:"type:uuid;not null;index"`
	SellOrderID uuid.UUID `json:"sell_order_id" gorm:"type:uuid;not null;index"`
	AssetID   uuid.UUID `json:"asset_id" gorm:"type:uuid;not null;index"`
	Price     string    `json:"price" gorm:"type:numeric(36,6);not null"`
	Quantity  string    `json:"quantity" gorm:"type:numeric(78,0);not null"`
	Amount    string    `json:"amount" gorm:"type:numeric(36,6);not null"` // price * quantity
	BuyerID   uuid.UUID `json:"buyer_id" gorm:"type:uuid;not null"`
	SellerID  uuid.UUID `json:"seller_id" gorm:"type:uuid;not null"`
	CreatedAt time.Time `json:"created_at"`
}

// Settlement 结算记录
type Settlement struct {
	ID          uuid.UUID        `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	TradeID     uuid.UUID        `json:"trade_id" gorm:"type:uuid;not null;uniqueIndex"`
	AssetID     uuid.UUID        `json:"asset_id" gorm:"type:uuid;not null"`
	BuyerID     uuid.UUID        `json:"buyer_id" gorm:"type:uuid;not null"`
	SellerID    uuid.UUID        `json:"seller_id" gorm:"type:uuid;not null"`
	Quantity    string           `json:"quantity" gorm:"type:numeric(78,0);not null"`
	Amount      string           `json:"amount" gorm:"type:numeric(36,6);not null"`
	Currency    string           `json:"currency" gorm:"default:'HKD'"`
	TxHash      string           `json:"tx_hash"` // 链上交易哈希
	Status      SettlementStatus `json:"status" gorm:"default:'pending'"`
	SettledAt   *time.Time       `json:"settled_at"`
	CreatedAt   time.Time        `json:"created_at"`
}

// WhitelistEntry 白名单（私募合规）
type WhitelistEntry struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	AssetID   uuid.UUID `json:"asset_id" gorm:"type:uuid;not null;index"`
	UserID    uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index"`
	AddedBy   uuid.UUID `json:"added_by" gorm:"type:uuid;not null"`
	ExpiresAt *time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}
