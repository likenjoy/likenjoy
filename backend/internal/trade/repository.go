package trade

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// --- Order ---

func (r *Repository) CreateOrder(o *Order) error {
	o.ID = uuid.New()
	o.CreatedAt = time.Now()
	o.UpdatedAt = time.Now()
	_, err := r.db.Exec(`INSERT INTO trade_orders (id, user_id, asset_id, round_id, side, order_type, price, quantity, filled_qty, total_amount, status, expires_at, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
		o.ID, o.UserID, o.AssetID, o.RoundID, o.Side, o.OrderType, o.Price, o.Quantity, o.FilledQty, o.TotalAmount, o.Status, o.ExpiresAt, o.CreatedAt, o.UpdatedAt)
	return err
}

func (r *Repository) FindOrderByID(id uuid.UUID) (*Order, error) {
	o := &Order{}
	err := r.db.QueryRow(`SELECT id, user_id, asset_id, round_id, side, order_type, price, quantity, filled_qty, total_amount, status, expires_at, created_at, updated_at
		FROM trade_orders WHERE id=$1`, id).
		Scan(&o.ID, &o.UserID, &o.AssetID, &o.RoundID, &o.Side, &o.OrderType, &o.Price, &o.Quantity, &o.FilledQty, &o.TotalAmount, &o.Status, &o.ExpiresAt, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return o, nil
}

func (r *Repository) UpdateOrderStatus(id uuid.UUID, status OrderStatus) error {
	_, err := r.db.Exec(`UPDATE trade_orders SET status=$1, updated_at=$2 WHERE id=$3`, status, time.Now(), id)
	return err
}

// CancelOrder sets order status to cancelled
func (r *Repository) CancelOrder(id uuid.UUID) error {
	return r.UpdateOrderStatus(id, OrderCancelled)
}

func (r *Repository) UpdateOrderFill(id uuid.UUID, filledQty string, status OrderStatus) error {
	_, err := r.db.Exec(`UPDATE trade_orders SET filled_qty=$1, status=$2, updated_at=$3 WHERE id=$4`,
		filledQty, status, time.Now(), id)
	return err
}

func (r *Repository) FindOrdersByUser(userID uuid.UUID, limit, offset int) ([]Order, int64, error) {
	var count int64
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM trade_orders WHERE user_id=$1`, userID).Scan(&count); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(`SELECT id, user_id, asset_id, round_id, side, order_type, price, quantity, filled_qty, total_amount, status, expires_at, created_at, updated_at
		FROM trade_orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	orders, err := scanOrders(rows)
	return orders, count, err
}

func (r *Repository) FindPendingOrdersByAsset(assetID uuid.UUID, limit, offset int) ([]Order, error) {
	rows, err := r.db.Query(`SELECT id, user_id, asset_id, round_id, side, order_type, price, quantity, filled_qty, total_amount, status, expires_at, created_at, updated_at
		FROM trade_orders WHERE asset_id=$1 AND status='pending' ORDER BY created_at ASC LIMIT $2 OFFSET $3`, assetID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanOrders(rows)
}

func scanOrders(rows *sql.Rows) ([]Order, error) {
	var orders []Order
	for rows.Next() {
		var o Order
		if err := rows.Scan(&o.ID, &o.UserID, &o.AssetID, &o.RoundID, &o.Side, &o.OrderType, &o.Price, &o.Quantity, &o.FilledQty, &o.TotalAmount, &o.Status, &o.ExpiresAt, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, err
		}
		orders = append(orders, o)
	}
	return orders, nil
}

// --- Trade ---

func (r *Repository) CreateTrade(t *Trade) error {
	t.ID = uuid.New()
	t.CreatedAt = time.Now()
	_, err := r.db.Exec(`INSERT INTO trades (id, buy_order_id, sell_order_id, asset_id, price, quantity, amount, buyer_id, seller_id, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		t.ID, t.BuyOrderID, t.SellOrderID, t.AssetID, t.Price, t.Quantity, t.Amount, t.BuyerID, t.SellerID, t.CreatedAt)
	return err
}

func (r *Repository) FindTradesByUser(userID uuid.UUID, limit, offset int) ([]Trade, int64, error) {
	var count int64
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM trades WHERE buyer_id=$1 OR seller_id=$1`, userID).Scan(&count); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(`SELECT id, buy_order_id, sell_order_id, asset_id, price, quantity, amount, buyer_id, seller_id, created_at
		FROM trades WHERE buyer_id=$1 OR seller_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	trades, err := scanTrades(rows)
	return trades, count, err
}

func (r *Repository) FindTradesByAsset(assetID uuid.UUID, limit, offset int) ([]Trade, int64, error) {
	var count int64
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM trades WHERE asset_id=$1`, assetID).Scan(&count); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(`SELECT id, buy_order_id, sell_order_id, asset_id, price, quantity, amount, buyer_id, seller_id, created_at
		FROM trades WHERE asset_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, assetID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	trades, err := scanTrades(rows)
	return trades, count, err
}

func scanTrades(rows *sql.Rows) ([]Trade, error) {
	var trades []Trade
	for rows.Next() {
		var t Trade
		if err := rows.Scan(&t.ID, &t.BuyOrderID, &t.SellOrderID, &t.AssetID, &t.Price, &t.Quantity, &t.Amount, &t.BuyerID, &t.SellerID, &t.CreatedAt); err != nil {
			return nil, err
		}
		trades = append(trades, t)
	}
	return trades, nil
}

// --- Settlement ---

func (r *Repository) CreateSettlement(s *Settlement) error {
	s.ID = uuid.New()
	s.CreatedAt = time.Now()
	_, err := r.db.Exec(`INSERT INTO settlements (id, trade_id, asset_id, buyer_id, seller_id, quantity, amount, currency, tx_hash, status, settled_at, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		s.ID, s.TradeID, s.AssetID, s.BuyerID, s.SellerID, s.Quantity, s.Amount, s.Currency, s.TxHash, s.Status, s.SettledAt, s.CreatedAt)
	return err
}

// --- Whitelist ---

func (r *Repository) AddToWhitelist(entry *WhitelistEntry) error {
	entry.ID = uuid.New()
	entry.CreatedAt = time.Now()
	_, err := r.db.Exec(`INSERT INTO trade_whitelist (id, asset_id, user_id, added_by, expires_at, created_at)
		VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
		entry.ID, entry.AssetID, entry.UserID, entry.AddedBy, entry.ExpiresAt, entry.CreatedAt)
	return err
}

func (r *Repository) RemoveFromWhitelist(assetID, userID uuid.UUID) error {
	_, err := r.db.Exec(`DELETE FROM trade_whitelist WHERE asset_id=$1 AND user_id=$2`, assetID, userID)
	return err
}

func (r *Repository) IsWhitelisted(assetID, userID uuid.UUID) (bool, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM trade_whitelist WHERE asset_id=$1 AND user_id=$2`, assetID, userID).Scan(&count)
	return count > 0, err
}
