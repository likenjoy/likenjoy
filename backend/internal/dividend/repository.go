package dividend

import (
	"database/sql"

	"github.com/google/uuid"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// --- DividendPlan ---

func (r *Repository) CreatePlan(plan *DividendPlan) error {
	plan.ID = uuid.New()
	_, err := r.db.Exec(`INSERT INTO dividend_plans (id, asset_id, name, type, rate, frequency, start_date, end_date, total_periods, status, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		plan.ID, plan.AssetID, plan.Name, plan.Type, plan.Rate, plan.Frequency, plan.StartDate, plan.EndDate, plan.TotalPeriods, plan.Status, plan.CreatedBy)
	return err
}

func (r *Repository) FindPlanByID(id uuid.UUID) (*DividendPlan, error) {
	plan := &DividendPlan{}
	err := r.db.QueryRow(`SELECT id, asset_id, name, type, rate, frequency, start_date, end_date, next_pay_date, total_periods, paid_periods, status, created_by, created_at, updated_at
		FROM dividend_plans WHERE id=$1`, id).
		Scan(&plan.ID, &plan.AssetID, &plan.Name, &plan.Type, &plan.Rate, &plan.Frequency, &plan.StartDate, &plan.EndDate, &plan.NextPayDate, &plan.TotalPeriods, &plan.PaidPeriods, &plan.Status, &plan.CreatedBy, &plan.CreatedAt, &plan.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return plan, nil
}

func (r *Repository) FindPlansByAsset(assetID uuid.UUID) ([]DividendPlan, error) {
	rows, err := r.db.Query(`SELECT id, asset_id, name, type, rate, frequency, start_date, end_date, next_pay_date, total_periods, paid_periods, status, created_by, created_at, updated_at
		FROM dividend_plans WHERE asset_id=$1 ORDER BY created_at DESC`, assetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanPlans(rows)
}

func (r *Repository) FindActivePlans() ([]DividendPlan, error) {
	rows, err := r.db.Query(`SELECT id, asset_id, name, type, rate, frequency, start_date, end_date, next_pay_date, total_periods, paid_periods, status, created_by, created_at, updated_at
		FROM dividend_plans WHERE status IN ('pending','processing')`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanPlans(rows)
}

func (r *Repository) UpdatePlanStatus(id uuid.UUID, status DividendStatus) error {
	_, err := r.db.Exec(`UPDATE dividend_plans SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2`, status, id)
	return err
}

func (r *Repository) IncrementPaidPeriods(id uuid.UUID) error {
	_, err := r.db.Exec(`UPDATE dividend_plans SET paid_periods = paid_periods + 1, updated_at=CURRENT_TIMESTAMP WHERE id=$1`, id)
	return err
}

// --- DividendRecord ---

func (r *Repository) CreateRecord(record *DividendRecord) error {
	record.ID = uuid.New()
	_, err := r.db.Exec(`INSERT INTO dividend_records (id, plan_id, user_id, asset_id, period_num, amount, holding_amount, rate, status, paid_at, tx_hash, remark)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		record.ID, record.PlanID, record.UserID, record.AssetID, record.PeriodNum, record.Amount, record.HoldingAmount, record.Rate, record.Status, record.PaidAt, record.TxHash, record.Remark)
	return err
}

func (r *Repository) BatchCreateRecords(records []DividendRecord) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`INSERT INTO dividend_records (id, plan_id, user_id, asset_id, period_num, amount, holding_amount, rate, status, paid_at, tx_hash, remark)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for i := range records {
		records[i].ID = uuid.New()
		_, err := stmt.Exec(records[i].ID, records[i].PlanID, records[i].UserID, records[i].AssetID, records[i].PeriodNum, records[i].Amount, records[i].HoldingAmount, records[i].Rate, records[i].Status, records[i].PaidAt, records[i].TxHash, records[i].Remark)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *Repository) FindRecordsByPlan(planID uuid.UUID) ([]DividendRecord, error) {
	rows, err := r.db.Query(`SELECT id, plan_id, user_id, asset_id, period_num, amount, holding_amount, rate, status, paid_at, tx_hash, remark, created_at
		FROM dividend_records WHERE plan_id=$1 ORDER BY period_num DESC`, planID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRecords(rows)
}

func (r *Repository) FindRecordsByUser(userID uuid.UUID) ([]DividendRecord, error) {
	rows, err := r.db.Query(`SELECT id, plan_id, user_id, asset_id, period_num, amount, holding_amount, rate, status, paid_at, tx_hash, remark, created_at
		FROM dividend_records WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRecords(rows)
}

func (r *Repository) UpdateRecordStatus(id uuid.UUID, status DividendStatus, txHash string) error {
	_, err := r.db.Exec(`UPDATE dividend_records SET status=$1, tx_hash=$2 WHERE id=$3`, status, txHash, id)
	return err
}

// --- InterestAccrual ---

func (r *Repository) UpsertAccrual(accrual *InterestAccrual) error {
	existing, err := r.FindAccrualByPlanAndUser(accrual.PlanID, accrual.UserID)
	if err != nil {
		accrual.ID = uuid.New()
		_, err := r.db.Exec(`INSERT INTO interest_accruals (id, plan_id, user_id, asset_id, principal, accrued_amount, paid_amount, last_accrual_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			accrual.ID, accrual.PlanID, accrual.UserID, accrual.AssetID, accrual.Principal, accrual.AccruedAmount, accrual.PaidAmount, accrual.LastAccrualAt)
		return err
	}
	_, err = r.db.Exec(`UPDATE interest_accruals SET principal=$1, accrued_amount=$2, paid_amount=$3, last_accrual_at=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$5`,
		accrual.Principal, accrual.AccruedAmount, accrual.PaidAmount, accrual.LastAccrualAt, existing.ID)
	return err
}

func (r *Repository) FindAccrualByPlanAndUser(planID, userID uuid.UUID) (*InterestAccrual, error) {
	accrual := &InterestAccrual{}
	err := r.db.QueryRow(`SELECT id, plan_id, user_id, asset_id, principal, accrued_amount, paid_amount, last_accrual_at, updated_at
		FROM interest_accruals WHERE plan_id=$1 AND user_id=$2`, planID, userID).
		Scan(&accrual.ID, &accrual.PlanID, &accrual.UserID, &accrual.AssetID, &accrual.Principal, &accrual.AccruedAmount, &accrual.PaidAmount, &accrual.LastAccrualAt, &accrual.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return accrual, nil
}

func (r *Repository) FindAccrualsByPlan(planID uuid.UUID) ([]InterestAccrual, error) {
	rows, err := r.db.Query(`SELECT id, plan_id, user_id, asset_id, principal, accrued_amount, paid_amount, last_accrual_at, updated_at
		FROM interest_accruals WHERE plan_id=$1`, planID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accruals []InterestAccrual
	for rows.Next() {
		var a InterestAccrual
		if err := rows.Scan(&a.ID, &a.PlanID, &a.UserID, &a.AssetID, &a.Principal, &a.AccruedAmount, &a.PaidAmount, &a.LastAccrualAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		accruals = append(accruals, a)
	}
	return accruals, nil
}

// --- scanners ---

func scanPlans(rows *sql.Rows) ([]DividendPlan, error) {
	var plans []DividendPlan
	for rows.Next() {
		var p DividendPlan
		if err := rows.Scan(&p.ID, &p.AssetID, &p.Name, &p.Type, &p.Rate, &p.Frequency, &p.StartDate, &p.EndDate, &p.NextPayDate, &p.TotalPeriods, &p.PaidPeriods, &p.Status, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		plans = append(plans, p)
	}
	return plans, nil
}

func scanRecords(rows *sql.Rows) ([]DividendRecord, error) {
	var records []DividendRecord
	for rows.Next() {
		var r DividendRecord
		if err := rows.Scan(&r.ID, &r.PlanID, &r.UserID, &r.AssetID, &r.PeriodNum, &r.Amount, &r.HoldingAmount, &r.Rate, &r.Status, &r.PaidAt, &r.TxHash, &r.Remark, &r.CreatedAt); err != nil {
			return nil, err
		}
		records = append(records, r)
	}
	return records, nil
}
