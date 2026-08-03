package redeem

import (
	"database/sql"
	"fmt"

	"github.com/google/uuid"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// --- RedeemRequest ---

func (r *Repository) CreateRequest(req *RedeemRequest) error {
	req.ID = uuid.New()
	_, err := r.db.Exec(`INSERT INTO redeem_requests (id, user_id, asset_id, type, amount, unit, price_per_unit, total_value, fee, net_amount, status, delivery_method, delivery_address, tracking_number, tx_hash, approved_by, approved_at, completed_at, remark)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
		req.ID, req.UserID, req.AssetID, req.Type, req.Amount, req.Unit, req.PricePerUnit, req.TotalValue, req.Fee, req.NetAmount, req.Status, req.DeliveryMethod, req.DeliveryAddress, req.TrackingNumber, req.TxHash, req.ApprovedBy, req.ApprovedAt, req.CompletedAt, req.Remark)
	return err
}

func (r *Repository) FindRequestByID(id uuid.UUID) (*RedeemRequest, error) {
	req := &RedeemRequest{}
	err := r.db.QueryRow(`SELECT id, user_id, asset_id, type, amount, unit, price_per_unit, total_value, fee, net_amount, status, delivery_method, delivery_address, tracking_number, tx_hash, approved_by, approved_at, completed_at, remark, created_at, updated_at
		FROM redeem_requests WHERE id=$1`, id).
		Scan(&req.ID, &req.UserID, &req.AssetID, &req.Type, &req.Amount, &req.Unit, &req.PricePerUnit, &req.TotalValue, &req.Fee, &req.NetAmount, &req.Status, &req.DeliveryMethod, &req.DeliveryAddress, &req.TrackingNumber, &req.TxHash, &req.ApprovedBy, &req.ApprovedAt, &req.CompletedAt, &req.Remark, &req.CreatedAt, &req.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return req, nil
}

func (r *Repository) FindRequestsByUser(userID uuid.UUID) ([]RedeemRequest, error) {
	rows, err := r.db.Query(`SELECT id, user_id, asset_id, type, amount, unit, price_per_unit, total_value, fee, net_amount, status, delivery_method, delivery_address, tracking_number, tx_hash, approved_by, approved_at, completed_at, remark, created_at, updated_at
		FROM redeem_requests WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRequests(rows)
}

func (r *Repository) FindRequestsByAsset(assetID uuid.UUID) ([]RedeemRequest, error) {
	rows, err := r.db.Query(`SELECT id, user_id, asset_id, type, amount, unit, price_per_unit, total_value, fee, net_amount, status, delivery_method, delivery_address, tracking_number, tx_hash, approved_by, approved_at, completed_at, remark, created_at, updated_at
		FROM redeem_requests WHERE asset_id=$1 ORDER BY created_at DESC`, assetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRequests(rows)
}

func (r *Repository) FindPendingRequests() ([]RedeemRequest, error) {
	rows, err := r.db.Query(`SELECT id, user_id, asset_id, type, amount, unit, price_per_unit, total_value, fee, net_amount, status, delivery_method, delivery_address, tracking_number, tx_hash, approved_by, approved_at, completed_at, remark, created_at, updated_at
		FROM redeem_requests WHERE status='pending' ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRequests(rows)
}

func (r *Repository) UpdateRequestStatus(id uuid.UUID, status RedeemStatus, updates map[string]interface{}) error {
	query := `UPDATE redeem_requests SET status=$1, updated_at=CURRENT_TIMESTAMP`
	args := []interface{}{status}
	argIdx := 2

	if v, ok := updates["approved_by"]; ok {
		query += `, approved_by=$` + fmt.Sprintf("%d", argIdx)
		args = append(args, v)
		argIdx++
	}
	if v, ok := updates["approved_at"]; ok {
		query += `, approved_at=$` + fmt.Sprintf("%d", argIdx)
		args = append(args, v)
		argIdx++
	}
	if v, ok := updates["completed_at"]; ok {
		query += `, completed_at=$` + fmt.Sprintf("%d", argIdx)
		args = append(args, v)
		argIdx++
	}
	if v, ok := updates["tx_hash"]; ok {
		query += `, tx_hash=$` + fmt.Sprintf("%d", argIdx)
		args = append(args, v)
		argIdx++
	}
	if v, ok := updates["remark"]; ok {
		query += `, remark=$` + fmt.Sprintf("%d", argIdx)
		args = append(args, v)
		argIdx++
	}

	query += ` WHERE id=$` + fmt.Sprintf("%d", argIdx)
	args = append(args, id)

	_, err := r.db.Exec(query, args...)
	return err
}

func (r *Repository) UpdateTracking(id uuid.UUID, trackingNumber string) error {
	_, err := r.db.Exec(`UPDATE redeem_requests SET status=$1, tracking_number=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3`,
		RedeemStatusShipped, trackingNumber, id)
	return err
}

// --- RedeemRule ---

func (r *Repository) UpsertRule(rule *RedeemRule) error {
	existing, err := r.FindRuleByAsset(rule.AssetID)
	if err != nil {
		rule.ID = uuid.New()
		_, err := r.db.Exec(`INSERT INTO redeem_rules (id, asset_id, min_amount, max_amount, lock_period_days, fee_rate, allow_physical, allow_cash, physical_min_unit, processing_days, is_active)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
			rule.ID, rule.AssetID, rule.MinAmount, rule.MaxAmount, rule.LockPeriodDays, rule.FeeRate, rule.AllowPhysical, rule.AllowCash, rule.PhysicalMinUnit, rule.ProcessingDays, rule.IsActive)
		return err
	}
	_, err = r.db.Exec(`UPDATE redeem_rules SET min_amount=$1, max_amount=$2, lock_period_days=$3, fee_rate=$4, allow_physical=$5, allow_cash=$6, physical_min_unit=$7, processing_days=$8, is_active=$9, updated_at=CURRENT_TIMESTAMP WHERE id=$10`,
		rule.MinAmount, rule.MaxAmount, rule.LockPeriodDays, rule.FeeRate, rule.AllowPhysical, rule.AllowCash, rule.PhysicalMinUnit, rule.ProcessingDays, rule.IsActive, existing.ID)
	return err
}

func (r *Repository) FindRuleByAsset(assetID uuid.UUID) (*RedeemRule, error) {
	rule := &RedeemRule{}
	err := r.db.QueryRow(`SELECT id, asset_id, min_amount, max_amount, lock_period_days, fee_rate, allow_physical, allow_cash, physical_min_unit, processing_days, is_active, created_at, updated_at
		FROM redeem_rules WHERE asset_id=$1 AND is_active=true`, assetID).
		Scan(&rule.ID, &rule.AssetID, &rule.MinAmount, &rule.MaxAmount, &rule.LockPeriodDays, &rule.FeeRate, &rule.AllowPhysical, &rule.AllowCash, &rule.PhysicalMinUnit, &rule.ProcessingDays, &rule.IsActive, &rule.CreatedAt, &rule.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return rule, nil
}

func (r *Repository) FindAllRules() ([]RedeemRule, error) {
	rows, err := r.db.Query(`SELECT id, asset_id, min_amount, max_amount, lock_period_days, fee_rate, allow_physical, allow_cash, physical_min_unit, processing_days, is_active, created_at, updated_at
		FROM redeem_rules WHERE is_active=true`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []RedeemRule
	for rows.Next() {
		var rule RedeemRule
		if err := rows.Scan(&rule.ID, &rule.AssetID, &rule.MinAmount, &rule.MaxAmount, &rule.LockPeriodDays, &rule.FeeRate, &rule.AllowPhysical, &rule.AllowCash, &rule.PhysicalMinUnit, &rule.ProcessingDays, &rule.IsActive, &rule.CreatedAt, &rule.UpdatedAt); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	return rules, nil
}

// --- scanners ---

func scanRequests(rows *sql.Rows) ([]RedeemRequest, error) {
	var reqs []RedeemRequest
	for rows.Next() {
		var req RedeemRequest
		if err := rows.Scan(&req.ID, &req.UserID, &req.AssetID, &req.Type, &req.Amount, &req.Unit, &req.PricePerUnit, &req.TotalValue, &req.Fee, &req.NetAmount, &req.Status, &req.DeliveryMethod, &req.DeliveryAddress, &req.TrackingNumber, &req.TxHash, &req.ApprovedBy, &req.ApprovedAt, &req.CompletedAt, &req.Remark, &req.CreatedAt, &req.UpdatedAt); err != nil {
			return nil, err
		}
		reqs = append(reqs, req)
	}
	return reqs, nil
}
