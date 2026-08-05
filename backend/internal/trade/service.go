package trade

import (
	"errors"
	"math/big"
	"time"

	"github.com/google/uuid"
)

var (
	ErrEpochNotFound = errors.New("epoch not found")
	ErrEpochClosed   = errors.New("epoch already closed")
	ErrOrderNotFound     = errors.New("order not found")
	ErrNotWhitelisted    = errors.New("user not whitelisted for this asset")
	ErrInsufficientFunds = errors.New("insufficient funds")
	ErrOrderNotOpen      = errors.New("order is not open")
	ErrSelfTrade         = errors.New("cannot trade with self")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// PlaceOrder creates a new trade order
func (s *Service) PlaceOrder(userID, assetID uuid.UUID, roundID *uuid.UUID, side OrderSide, orderType OrderType, price, quantity string, expiresAt *time.Time) (*Order, error) {
	order := &Order{
		UserID:    userID,
		AssetID:   assetID,
		RoundID:   roundID,
		Side:      side,
		OrderType: orderType,
		Price:     price,
		Quantity:  quantity,
		Status:    OrderPending,
		ExpiresAt: expiresAt,
	}

	if price != "" {
		p := new(big.Float)
		p.SetString(price)
		q := new(big.Float)
		q.SetString(quantity)
		total := new(big.Float).Mul(p, q)
		order.TotalAmount = total.Text('f', 6)
	}

	if err := s.repo.CreateOrder(order); err != nil {
		return nil, err
	}
	return order, nil
}

// CancelOrder cancels a pending order
func (s *Service) CancelOrder(orderID, userID uuid.UUID) error {
	order, err := s.repo.FindOrderByID(orderID)
	if err != nil {
		return ErrOrderNotFound
	}
	if order.UserID != userID {
		return errors.New("not your order")
	}
	if order.Status != OrderPending && order.Status != OrderPartial {
		return ErrOrderNotOpen
	}
	return s.repo.CancelOrder(orderID)
}

// MatchOrder matches an order against the order book (price-time priority)
func (s *Service) MatchOrder(orderID uuid.UUID) (*Trade, error) {
	order, err := s.repo.FindOrderByID(orderID)
	if err != nil {
		return nil, ErrOrderNotFound
	}
	if order.Status != OrderPending && order.Status != OrderPartial {
		return nil, ErrOrderNotOpen
	}

	openOrders, err := s.repo.FindPendingOrdersByAsset(order.AssetID, 10, 0)
	if err != nil || len(openOrders) == 0 {
		return nil, errors.New("no matching orders")
	}

	for _, counter := range openOrders {
		if counter.UserID == order.UserID {
			continue
		}
		if counter.Side == order.Side {
			continue
		}

		orderPrice := new(big.Float)
		orderPrice.SetString(order.Price)
		counterPrice := new(big.Float)
		counterPrice.SetString(counter.Price)

		if order.Side == SideBuy {
			if orderPrice.Cmp(counterPrice) < 0 {
				continue
			}
		} else {
			if orderPrice.Cmp(counterPrice) > 0 {
				continue
			}
		}

		orderRemaining := new(big.Int)
		orderRemaining.SetString(order.Quantity, 10)
		orderFilled := new(big.Int)
		orderFilled.SetString(order.FilledQty, 10)
		orderAvail := new(big.Int).Sub(orderRemaining, orderFilled)

		counterRemaining := new(big.Int)
		counterRemaining.SetString(counter.Quantity, 10)
		counterFilled := new(big.Int)
		counterFilled.SetString(counter.FilledQty, 10)
		counterAvail := new(big.Int).Sub(counterRemaining, counterFilled)

		qty := orderAvail
		if qty.Cmp(counterAvail) > 0 {
			qty = counterAvail
		}

		tradePrice := counter.Price
		amount := new(big.Float)
		amount.SetString(tradePrice)
		qtyFloat := new(big.Float).SetInt(qty)
		tradeAmount := new(big.Float).Mul(amount, qtyFloat)

		var buyerID, sellerID uuid.UUID
		var buyOrderID, sellOrderID uuid.UUID
		if order.Side == SideBuy {
			buyerID = order.UserID
			sellerID = counter.UserID
			buyOrderID = order.ID
			sellOrderID = counter.ID
		} else {
			buyerID = counter.UserID
			sellerID = order.UserID
			buyOrderID = counter.ID
			sellOrderID = order.ID
		}

		trade := &Trade{
			BuyOrderID:  buyOrderID,
			SellOrderID: sellOrderID,
			AssetID:     order.AssetID,
			Price:       tradePrice,
			Quantity:    qty.String(),
			Amount:      tradeAmount.Text('f', 6),
			BuyerID:     buyerID,
			SellerID:    sellerID,
		}

		if err := s.repo.CreateTrade(trade); err != nil {
			return nil, err
		}

		newOrderFilled := new(big.Int).Add(orderFilled, qty)
		newCounterFilled := new(big.Int).Add(counterFilled, qty)

		orderStatus := OrderPartial
		if newOrderFilled.Cmp(orderRemaining) >= 0 {
			orderStatus = OrderFilled
		}
		counterStatus := OrderPartial
		if newCounterFilled.Cmp(counterRemaining) >= 0 {
			counterStatus = OrderFilled
		}

		_ = s.repo.UpdateOrderFill(order.ID, newOrderFilled.String(), orderStatus)
		_ = s.repo.UpdateOrderFill(counter.ID, newCounterFilled.String(), counterStatus)

		settlement := &Settlement{
			TradeID:  trade.ID,
			AssetID:  order.AssetID,
			BuyerID:  buyerID,
			SellerID: sellerID,
			Quantity: qty.String(),
			Amount:   tradeAmount.Text('f', 6),
			Currency: "HKD",
			Status:   SettlementPending,
		}
		_ = s.repo.CreateSettlement(settlement)

		return trade, nil
	}

	return nil, errors.New("no matching orders at acceptable price")
}

// AddToWhitelist adds a user to an asset's trading whitelist
func (s *Service) AddToWhitelist(assetID, userID, addedBy uuid.UUID, expiresAt *time.Time) error {
	entry := &WhitelistEntry{
		AssetID:   assetID,
		UserID:    userID,
		AddedBy:   addedBy,
		ExpiresAt: expiresAt,
	}
	return s.repo.AddToWhitelist(entry)
}

// RemoveFromWhitelist removes a user from an asset's trading whitelist
func (s *Service) RemoveFromWhitelist(assetID, userID uuid.UUID) error {
	return s.repo.RemoveFromWhitelist(assetID, userID)
}

// CheckWhitelist checks if a user is whitelisted for an asset
func (s *Service) CheckWhitelist(assetID, userID uuid.UUID) (bool, error) {
	return s.repo.IsWhitelisted(assetID, userID)
}

func (s *Service) GetOrder(orderID uuid.UUID) (*Order, error) {
	return s.repo.FindOrderByID(orderID)
}

func (s *Service) ListUserOrders(userID uuid.UUID, limit, offset int) ([]Order, int64, error) {
	return s.repo.FindOrdersByUser(userID, limit, offset)
}

func (s *Service) ListAssetTrades(assetID uuid.UUID, limit, offset int) ([]Trade, int64, error) {
	return s.repo.FindTradesByAsset(assetID, limit, offset)
}

func (s *Service) ListUserTrades(userID uuid.UUID, limit, offset int) ([]Trade, int64, error) {
	return s.repo.FindTradesByUser(userID, limit, offset)
}


// ========== Epoch 两阶段结算（参考 Centrifuge investment epoch）==========

// CreateEpoch 创建结算周期（阶段一：订单收集期）
func (s *Service) CreateEpoch(assetID uuid.UUID, createdBy string) (*Epoch, error) {
	e := &Epoch{ID: uuid.NewString(), AssetID: assetID, Status: "open", CreatedBy: createdBy}
	if err := s.repo.CreateEpoch(e); err != nil {
		return nil, err
	}
	return e, nil
}

// ListEpochs 查询资产的结算周期
func (s *Service) ListEpochs(assetID uuid.UUID) ([]Epoch, error) {
	return s.repo.ListEpochsByAsset(assetID)
}

// CloseEpoch 关闭结算周期（阶段二：批量撮合结算）
// 对资产下所有 pending 买单按价格降序执行撮合（价格优先，防抢跑）
func (s *Service) CloseEpoch(epochID uuid.UUID) (*Epoch, int, error) {
	e, err := s.repo.FindEpochByID(epochID)
	if err != nil {
		return nil, 0, ErrEpochNotFound
	}
	if e.Status != "open" {
		return nil, 0, ErrEpochClosed
	}
	if err := s.repo.CloseEpoch(epochID); err != nil {
		return nil, 0, err
	}
	e.Status = "closed" // 同步内存状态（DB 已更新）
	// 批量撮合：买单价格降序
	buyOrders, err := s.repo.FindPendingBuyOrdersByAsset(e.AssetID)
	if err != nil {
		return e, 0, nil
	}
	matched := 0
	// 简单价格优先：按价格降序逐个撮合
	buyOrders = sortOrdersByPriceDesc(buyOrders)
	for _, o := range buyOrders {
		if o.Status != OrderPending && o.Status != OrderPartial {
			continue
		}
		if _, err := s.MatchOrder(o.ID); err == nil {
			matched++
		}
	}
	return e, matched, nil
}

// sortOrdersByPriceDesc 买单按价格降序（价格优先）
func sortOrdersByPriceDesc(orders []Order) []Order {
	out := make([]Order, len(orders))
	copy(out, orders)
	for i := 1; i < len(out); i++ {
		for j := i; j > 0; j-- {
			a := new(big.Float)
			a.SetString(out[j].Price)
			b := new(big.Float)
			b.SetString(out[j-1].Price)
			if a.Cmp(b) > 0 {
				out[j], out[j-1] = out[j-1], out[j]
			} else {
				break
			}
		}
	}
	return out
}
