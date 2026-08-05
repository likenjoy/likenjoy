package asset

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

func (r *Repository) Create(a *Asset) error {
	a.ID = uuid.New()
	a.CreatedAt = time.Now()
	a.UpdatedAt = time.Now()
	_, err := r.db.Exec(`INSERT INTO assets (id, issuer_id, name, symbol, asset_type, description, total_supply, price_per_unit, currency, min_investment, max_investment, lockup_period, contract_address, chain_id, status, metadata_uri, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
		a.ID, a.IssuerID, a.Name, a.Symbol, a.AssetType, a.Description, a.TotalSupply, a.PricePerUnit,
		a.Currency, a.MinInvestment, a.MaxInvestment, a.LockupPeriod, a.ContractAddress, a.ChainID, a.Status, a.MetadataURI, a.CreatedAt, a.UpdatedAt)
	return err
}

func (r *Repository) FindByID(id uuid.UUID) (*Asset, error) {
	a := &Asset{}
	err := r.db.QueryRow(`SELECT id, issuer_id, name, symbol, asset_type, description, total_supply, price_per_unit, currency, min_investment, max_investment, lockup_period, contract_address, chain_id, status, metadata_uri, created_at, updated_at
		FROM assets WHERE id=$1`, id).
		Scan(&a.ID, &a.IssuerID, &a.Name, &a.Symbol, &a.AssetType, &a.Description, &a.TotalSupply, &a.PricePerUnit,
			&a.Currency, &a.MinInvestment, &a.MaxInvestment, &a.LockupPeriod, &a.ContractAddress, &a.ChainID, &a.Status, &a.MetadataURI, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return a, nil
}

func (r *Repository) FindBySymbol(symbol string) (*Asset, error) {
	a := &Asset{}
	err := r.db.QueryRow(`SELECT id, issuer_id, name, symbol, asset_type, description, total_supply, price_per_unit, currency, min_investment, max_investment, lockup_period, contract_address, chain_id, status, metadata_uri, created_at, updated_at
		FROM assets WHERE symbol=$1`, symbol).
		Scan(&a.ID, &a.IssuerID, &a.Name, &a.Symbol, &a.AssetType, &a.Description, &a.TotalSupply, &a.PricePerUnit,
			&a.Currency, &a.MinInvestment, &a.MaxInvestment, &a.LockupPeriod, &a.ContractAddress, &a.ChainID, &a.Status, &a.MetadataURI, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return a, nil
}

func (r *Repository) UpdateStatus(id uuid.UUID, status AssetStatus) error {
	_, err := r.db.Exec(`UPDATE assets SET status=$1, updated_at=$2 WHERE id=$3`, status, time.Now(), id)
	return err
}

func (r *Repository) UpdateContract(id uuid.UUID, contractAddress string, chainID int64) error {
	_, err := r.db.Exec(`UPDATE assets SET contract_address=$1, chain_id=$2, updated_at=$3 WHERE id=$4`, contractAddress, chainID, time.Now(), id)
	return err
}

func (r *Repository) ListByStatus(status AssetStatus, limit, offset int) ([]Asset, error) {
	rows, err := r.db.Query(`SELECT id, issuer_id, name, symbol, asset_type, description, total_supply, price_per_unit, currency, min_investment, max_investment, lockup_period, contract_address, chain_id, status, metadata_uri, created_at, updated_at
		FROM assets WHERE status=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, status, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAssets(rows)
}

// FindAll returns all assets with count
func (r *Repository) FindAll(limit, offset int) ([]Asset, int64, error) {
	var count int64
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM assets`).Scan(&count); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(`SELECT id, issuer_id, name, symbol, asset_type, description, total_supply, price_per_unit, currency, min_investment, max_investment, lockup_period, contract_address, chain_id, status, metadata_uri, created_at, updated_at
		FROM assets ORDER BY created_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	assets, err := scanAssets(rows)
	if err != nil {
		return nil, 0, err
	}
	return assets, count, nil
}

// FindLive returns live assets with count
func (r *Repository) FindLive(limit, offset int) ([]Asset, int64, error) {
	var count int64
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM assets WHERE status='live'`).Scan(&count); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(`SELECT id, issuer_id, name, symbol, asset_type, description, total_supply, price_per_unit, currency, min_investment, max_investment, lockup_period, contract_address, chain_id, status, metadata_uri, created_at, updated_at
		FROM assets WHERE status='live' ORDER BY created_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	assets, err := scanAssets(rows)
	if err != nil {
		return nil, 0, err
	}
	return assets, count, nil
}

// FindByIssuer returns issuer assets with count
func (r *Repository) FindByIssuer(issuerID uuid.UUID, limit, offset int) ([]Asset, int64, error) {
	var count int64
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM assets WHERE issuer_id=$1`, issuerID).Scan(&count); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(`SELECT id, issuer_id, name, symbol, asset_type, description, total_supply, price_per_unit, currency, min_investment, max_investment, lockup_period, contract_address, chain_id, status, metadata_uri, created_at, updated_at
		FROM assets WHERE issuer_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, issuerID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	assets, err := scanAssets(rows)
	if err != nil {
		return nil, 0, err
	}
	return assets, count, nil
}

func scanAssets(rows *sql.Rows) ([]Asset, error) {
	var assets []Asset
	for rows.Next() {
		var a Asset
		if err := rows.Scan(&a.ID, &a.IssuerID, &a.Name, &a.Symbol, &a.AssetType, &a.Description, &a.TotalSupply, &a.PricePerUnit,
			&a.Currency, &a.MinInvestment, &a.MaxInvestment, &a.LockupPeriod, &a.ContractAddress, &a.ChainID, &a.Status, &a.MetadataURI, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}
	return assets, nil
}

// --- AssetDocument ---

func (r *Repository) CreateDocument(d *AssetDocument) error {
	d.ID = uuid.New()
	d.CreatedAt = time.Now()
	_, err := r.db.Exec(`INSERT INTO asset_documents (id, asset_id, doc_type, file_name, file_hash, file_url, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`, d.ID, d.AssetID, d.DocType, d.FileName, d.FileHash, d.FileURL, d.CreatedAt)
	return err
}

func (r *Repository) AddDocument(d *AssetDocument) error {
	return r.CreateDocument(d)
}

func (r *Repository) FindDocumentsByAsset(assetID uuid.UUID) ([]AssetDocument, error) {
	rows, err := r.db.Query(`SELECT id, asset_id, doc_type, file_name, file_hash, file_url, created_at
		FROM asset_documents WHERE asset_id=$1 ORDER BY created_at`, assetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var docs []AssetDocument
	for rows.Next() {
		var d AssetDocument
		if err := rows.Scan(&d.ID, &d.AssetID, &d.DocType, &d.FileName, &d.FileHash, &d.FileURL, &d.CreatedAt); err != nil {
			return nil, err
		}
		docs = append(docs, d)
	}
	return docs, nil
}

// --- IssuanceRound ---

func (r *Repository) CreateRound(ir *IssuanceRound) error {
	ir.ID = uuid.New()
	ir.CreatedAt = time.Now()
	_, err := r.db.Exec(`INSERT INTO issuance_rounds (id, asset_id, round_number, supply, price_per_unit, start_time, end_time, min_alloc, max_alloc, sold, status, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		ir.ID, ir.AssetID, ir.RoundNumber, ir.Supply, ir.PricePerUnit, ir.StartTime, ir.EndTime, ir.MinAlloc, ir.MaxAlloc, ir.Sold, ir.Status, ir.CreatedAt)
	return err
}

func (r *Repository) FindRoundsByAsset(assetID uuid.UUID) ([]IssuanceRound, error) {
	rows, err := r.db.Query(`SELECT id, asset_id, round_number, supply, price_per_unit, start_time, end_time, min_alloc, max_alloc, sold, status, created_at
		FROM issuance_rounds WHERE asset_id=$1 ORDER BY round_number`, assetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var rounds []IssuanceRound
	for rows.Next() {
		var ir IssuanceRound
		if err := rows.Scan(&ir.ID, &ir.AssetID, &ir.RoundNumber, &ir.Supply, &ir.PricePerUnit, &ir.StartTime, &ir.EndTime, &ir.MinAlloc, &ir.MaxAlloc, &ir.Sold, &ir.Status, &ir.CreatedAt); err != nil {
			return nil, err
		}
		rounds = append(rounds, ir)
	}
	return rounds, nil
}

func (r *Repository) FindRounds(assetID uuid.UUID) ([]IssuanceRound, error) {
	return r.FindRoundsByAsset(assetID)
}

func (r *Repository) FindActiveRound(roundID uuid.UUID) (*IssuanceRound, error) {
	ir := &IssuanceRound{}
	err := r.db.QueryRow(`SELECT id, asset_id, round_number, supply, price_per_unit, start_time, end_time, min_alloc, max_alloc, sold, status, created_at
		FROM issuance_rounds WHERE id=$1 AND status IN ('upcoming','active')`, roundID).
		Scan(&ir.ID, &ir.AssetID, &ir.RoundNumber, &ir.Supply, &ir.PricePerUnit, &ir.StartTime, &ir.EndTime, &ir.MinAlloc, &ir.MaxAlloc, &ir.Sold, &ir.Status, &ir.CreatedAt)
	if err != nil {
		return nil, err
	}
	return ir, nil
}

// RecordPrice 记录资产价格快照（曲线数据源）
func (r *Repository) RecordPrice(assetID uuid.UUID, price string) error {
	_, err := r.db.Exec(`INSERT INTO asset_price_history (id, asset_id, price) VALUES (?, ?, ?)`,
		uuid.NewString(), assetID.String(), price)
	return err
}

// PriceHistory 返回资产价格历史（按时间正序，最近 N 条）
func (r *Repository) PriceHistory(assetID uuid.UUID, limit int) ([]PricePoint, error) {
	if limit <= 0 || limit > 365 {
		limit = 90
	}
	rows, err := r.db.Query(
		`SELECT price, recorded_at FROM asset_price_history WHERE asset_id = ? ORDER BY recorded_at ASC LIMIT ?`,
		assetID.String(), limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PricePoint
	for rows.Next() {
		var p PricePoint
		if err := rows.Scan(&p.Price, &p.Date); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}