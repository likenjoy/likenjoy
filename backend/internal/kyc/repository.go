package kyc

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

func (r *Repository) CreateSubmission(s *KYCSubmission) error {
	s.ID = uuid.New()
	s.SubmittedAt = time.Now()
	s.Status = StatusPending
	_, err := r.db.Exec(
		`INSERT INTO kyc_submissions (id, user_id, country, status, submitted_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		s.ID, s.UserID, s.Country, s.Status, s.SubmittedAt,
	)
	if err != nil {
		return fmt.Errorf("create kyc submission: %w", err)
	}
	return nil
}

func (r *Repository) FindSubmissionByUser(userID uuid.UUID) (*KYCSubmission, error) {
	s := &KYCSubmission{}
	err := r.db.QueryRow(
		`SELECT id, user_id, country, status, submitted_at, reviewed_at, reviewed_by, reject_reason
		 FROM kyc_submissions WHERE user_id = $1 ORDER BY submitted_at DESC LIMIT 1`,
		userID,
	).Scan(&s.ID, &s.UserID, &s.Country, &s.Status, &s.SubmittedAt, &s.ReviewedAt, &s.ReviewedBy, &s.RejectReason)
	if err != nil {
		return nil, fmt.Errorf("find kyc submission: %w", err)
	}
	return s, nil
}

func (r *Repository) UpdateStatus(id uuid.UUID, status KYCStatus, reviewerID uuid.UUID, reason string) error {
	now := time.Now()
	_, err := r.db.Exec(
		`UPDATE kyc_submissions SET status = $1, reviewed_at = $2, reviewed_by = $3, reject_reason = $4
		 WHERE id = $5`,
		status, now, reviewerID, reason, id,
	)
	return err
}

func (r *Repository) AddDocument(d *KYCDocument) error {
	d.ID = uuid.New()
	d.UploadedAt = time.Now()
	_, err := r.db.Exec(
		`INSERT INTO kyc_documents (id, user_id, doc_type, file_name, file_hash, uploaded_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		d.ID, d.UserID, d.DocType, d.FileName, d.FileHash, d.UploadedAt,
	)
	return err
}

// SaveAccreditation 保存/更新专业投资者认证
func (r *Repository) SaveAccreditation(check *AccreditationCheck) error {
	if check.ID == uuid.Nil {
		check.ID = uuid.New()
	}
	if check.ExpiresAt.IsZero() {
		check.ExpiresAt = time.Now().AddDate(1, 0, 0) // 默认1年有效期
	}
	_, err := r.db.Exec(
		`INSERT INTO accreditation_checks (id, user_id, level, net_worth_proof, status, checked_at, checked_by, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 ON CONFLICT(user_id) DO UPDATE SET
		   level=$3, net_worth_proof=$4, status=$5, checked_at=$6, checked_by=$7, expires_at=$8`,
		check.ID, check.UserID, check.Level, check.NetWorthProof, check.Status, check.CheckedAt, check.CheckedBy, check.ExpiresAt,
	)
	if err != nil {
		return fmt.Errorf("save accreditation: %w", err)
	}
	return nil
}

// GetAccreditation 查询用户的专业投资者认证
func (r *Repository) GetAccreditation(userID uuid.UUID) (*AccreditationCheck, error) {
	c := &AccreditationCheck{}
	err := r.db.QueryRow(
		`SELECT id, user_id, level, net_worth_proof, status, checked_at, checked_by, expires_at
		 FROM accreditation_checks WHERE user_id = $1`,
		userID,
	).Scan(&c.ID, &c.UserID, &c.Level, &c.NetWorthProof, &c.Status, &c.CheckedAt, &c.CheckedBy, &c.ExpiresAt)
	if err != nil {
		return nil, fmt.Errorf("get accreditation: %w", err)
	}
	return c, nil
}

// ListPending 待审核 KYC 提交（含用户邮箱）
func (r *Repository) ListPending() ([]map[string]interface{}, error) {
	rows, err := r.db.Query(
		`SELECT s.id, s.user_id, u.email, s.status, s.submitted_at,
		        (SELECT COUNT(*) FROM kyc_documents d WHERE d.user_id = s.user_id) AS doc_count
		 FROM kyc_submissions s JOIN users u ON u.id = s.user_id
		 WHERE s.status = 'pending' ORDER BY s.submitted_at ASC`,
	)
	if err != nil {
		return nil, fmt.Errorf("list pending kyc: %w", err)
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var id, uid uuid.UUID
		var emailStr, statusStr string
		var submitted time.Time
		var docCount int
		if err := rows.Scan(&id, &uid, &emailStr, &statusStr, &submitted, &docCount); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{
			"id": id, "user_id": uid, "email": emailStr, "status": statusStr,
			"submitted_at": submitted, "doc_count": docCount,
		})
	}
	return out, nil
}

// GetUserWallet 查询用户绑定的钱包地址
func (r *Repository) GetUserWallet(userID uuid.UUID) (string, error) {
	var addr string
	err := r.db.QueryRow(`SELECT wallet_address FROM users WHERE id = $1`, userID).Scan(&addr)
	if err != nil {
		return "", fmt.Errorf("get user wallet: %w", err)
	}
	return addr, nil
}

// FindByID 按提交 ID 查询（含 user_id / country）
func (r *Repository) FindByID(id uuid.UUID) (*KYCSubmission, error) {
	sub := &KYCSubmission{}
	err := r.db.QueryRow(
		`SELECT id, user_id, country, status, submitted_at, reviewed_at, reviewed_by, reject_reason
		 FROM kyc_submissions WHERE id = $1`, id,
	).Scan(&sub.ID, &sub.UserID, &sub.Country, &sub.Status, &sub.SubmittedAt, &sub.ReviewedAt, &sub.ReviewedBy, &sub.RejectReason)
	if err != nil {
		return nil, fmt.Errorf("find kyc by id: %w", err)
	}
	return sub, nil
}
