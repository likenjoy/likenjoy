const fs = require("fs");

// ===== 1. service.go 追加 epoch 方法 =====
const sp = "C:/Users/Administrator/Desktop/rwa-exchange/backend/internal/trade/service.go";
let sc = fs.readFileSync(sp, "utf8");
const svcAdd = `

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
`;
if (!sc.includes("CreateEpoch")) {
  sc = sc.trimEnd() + "\n" + svcAdd;
  fs.writeFileSync(sp, sc, "utf8");
  console.log("service epoch added");
}

// ===== 2. repository.go 追加 =====
const rp = "C:/Users/Administrator/Desktop/rwa-exchange/backend/internal/trade/repository.go";
let rc = fs.readFileSync(rp, "utf8");
const repoAdd = `

// ========== Epoch ==========

func (r *Repository) CreateEpoch(e *Epoch) error {
	_, err := r.db.Exec(\`INSERT INTO epochs (id, asset_id, status, created_by) VALUES (?, ?, ?, ?)\`, e.ID, e.AssetID.String(), e.Status, e.CreatedBy)
	return err
}

func (r *Repository) FindEpochByID(id uuid.UUID) (*Epoch, error) {
	row := r.db.QueryRow(\`SELECT id, asset_id, status, created_by, created_at, closed_at FROM epochs WHERE id = ?\`, id.String())
	var e Epoch
	var createdAt string
	if err := row.Scan(&e.ID, &e.AssetID, &e.Status, &e.CreatedBy, &createdAt, &e.ClosedAt); err != nil {
		return nil, err
	}
	e.CreatedAt = createdAt
	return &e, nil
}

func (r *Repository) CloseEpoch(id uuid.UUID) error {
	_, err := r.db.Exec(\`UPDATE epochs SET status='closed', closed_at=CURRENT_TIMESTAMP WHERE id=?\`, id.String())
	return err
}

func (r *Repository) ListEpochsByAsset(assetID uuid.UUID) ([]Epoch, error) {
	rows, err := r.db.Query(\`SELECT id, asset_id, status, created_by, created_at, closed_at FROM epochs WHERE asset_id=? ORDER BY created_at DESC LIMIT 20\`, assetID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Epoch
	for rows.Next() {
		var e Epoch
		var createdAt string
		if err := rows.Scan(&e.ID, &e.AssetID, &e.Status, &e.CreatedBy, &createdAt, &e.ClosedAt); err != nil {
			return nil, err
		}
		e.CreatedAt = createdAt
		out = append(out, e)
	}
	return out, rows.Err()
}

// FindPendingBuyOrdersByAsset 资产下所有未成交买单（按创建时间）
func (r *Repository) FindPendingBuyOrdersByAsset(assetID uuid.UUID) ([]Order, error) {
	rows, err := r.db.Query(\`SELECT * FROM trade_orders WHERE asset_id=? AND side='buy' AND status IN ('pending','partial') ORDER BY created_at ASC\`, assetID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Order
	for rows.Next() {
		var o Order
		if err := rows.Scan(&o.ID, &o.AssetID, &o.RoundID, &o.UserID, &o.Side, &o.OrderType, &o.Price, &o.Quantity, &o.FilledQty, &o.Status, &o.ExpiresAt, &o.CreatedAt, &o.EpochID); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}
`;
if (!rc.includes("CreateEpoch")) {
  rc = rc.trimEnd() + "\n" + repoAdd;
  fs.writeFileSync(rp, rc, "utf8");
  console.log("repo epoch added");
}
console.log("done");