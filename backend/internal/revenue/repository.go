package revenue

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) GetFee() (*PlatformFee, error) {
	f := &PlatformFee{}
	err := r.db.QueryRow(
		`SELECT id, mint_fee_rate, transfer_fee_rate, gas_markup_rate, treasury_address, updated_by, updated_at
		 FROM platform_fees WHERE id = 'default'`,
	).Scan(&f.ID, &f.MintFeeRate, &f.TransferFeeRate, &f.GasMarkupRate, &f.TreasuryAddress, &f.UpdatedBy, &f.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get fee: %w", err)
	}
	return f, nil
}

func (r *Repository) UpsertFee(f *PlatformFee) error {
	f.UpdatedAt = time.Now()
	_, err := r.db.Exec(
		`INSERT INTO platform_fees (id, mint_fee_rate, transfer_fee_rate, gas_markup_rate, treasury_address, updated_by, updated_at)
		 VALUES ('default', $1, $2, $3, $4, $5, $6)
		 ON CONFLICT(id) DO UPDATE SET
		   mint_fee_rate=$1, transfer_fee_rate=$2, gas_markup_rate=$3,
		   treasury_address=$4, updated_by=$5, updated_at=$6`,
		f.MintFeeRate, f.TransferFeeRate, f.GasMarkupRate, f.TreasuryAddress, f.UpdatedBy, f.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("upsert fee: %w", err)
	}
	return nil
}

func (r *Repository) InsertRevenue(rec *RevenueRecord) error {
	rec.ID = uuid.New()
	rec.CreatedAt = time.Now()
	_, err := r.db.Exec(
		`INSERT INTO revenue_ledger (id, category, asset_id, user_id, amount, currency, tx_hash, gas_used_wei, detail, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		rec.ID, rec.Category, rec.AssetID, rec.UserID, rec.Amount, rec.Currency, rec.TxHash, rec.GasUsedWei, rec.Detail, rec.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert revenue: %w", err)
	}
	return nil
}

func (r *Repository) InsertGas(rec *GasRecord) error {
	rec.ID = uuid.New()
	rec.CreatedAt = time.Now()
	_, err := r.db.Exec(
		`INSERT INTO gas_ledger (id, tx_hash, chain_id, action, asset_id, user_id, gas_used_wei, gas_price_wei, cost_wei, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		rec.ID, rec.TxHash, rec.ChainID, rec.Action, rec.AssetID, rec.UserID, rec.GasUsedWei, rec.GasPriceWei, rec.CostWei, rec.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert gas: %w", err)
	}
	return nil
}

func (r *Repository) InsertAudit(log *AuditLog) error {
	log.ID = uuid.New()
	log.CreatedAt = time.Now()
	_, err := r.db.Exec(
		`INSERT INTO admin_audit_log (id, admin_id, action, target, detail, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		log.ID, log.AdminID, log.Action, log.Target, log.Detail, log.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert audit: %w", err)
	}
	return nil
}

func (r *Repository) ListRevenue(limit, offset int) ([]RevenueRecord, int64, error) {
	var total int64
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM revenue_ledger`).Scan(&total)
	rows, err := r.db.Query(
		`SELECT id, category, asset_id, user_id, amount, currency, tx_hash, gas_used_wei, detail, created_at
		 FROM revenue_ledger ORDER BY created_at DESC LIMIT $1 OFFSET $2`, limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("list revenue: %w", err)
	}
	defer rows.Close()
	var out []RevenueRecord
	for rows.Next() {
		var rec RevenueRecord
		if err := rows.Scan(&rec.ID, &rec.Category, &rec.AssetID, &rec.UserID, &rec.Amount, &rec.Currency, &rec.TxHash, &rec.GasUsedWei, &rec.Detail, &rec.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, rec)
	}
	return out, total, nil
}

func (r *Repository) ListGas(limit, offset int) ([]GasRecord, int64, error) {
	var total int64
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM gas_ledger`).Scan(&total)
	rows, err := r.db.Query(
		`SELECT id, tx_hash, chain_id, action, asset_id, user_id, gas_used_wei, gas_price_wei, cost_wei, created_at
		 FROM gas_ledger ORDER BY created_at DESC LIMIT $1 OFFSET $2`, limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("list gas: %w", err)
	}
	defer rows.Close()
	var out []GasRecord
	for rows.Next() {
		var rec GasRecord
		if err := rows.Scan(&rec.ID, &rec.TxHash, &rec.ChainID, &rec.Action, &rec.AssetID, &rec.UserID, &rec.GasUsedWei, &rec.GasPriceWei, &rec.CostWei, &rec.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, rec)
	}
	return out, total, nil
}

func (r *Repository) ListAudit(limit, offset int) ([]AuditLog, int64, error) {
	var total int64
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM admin_audit_log`).Scan(&total)
	rows, err := r.db.Query(
		`SELECT id, admin_id, action, target, detail, created_at
		 FROM admin_audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2`, limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("list audit: %w", err)
	}
	defer rows.Close()
	var out []AuditLog
	for rows.Next() {
		var rec AuditLog
		if err := rows.Scan(&rec.ID, &rec.AdminID, &rec.Action, &rec.Target, &rec.Detail, &rec.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, rec)
	}
	return out, total, nil
}
