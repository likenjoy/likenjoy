package user

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

func (r *Repository) Create(u *User) error {
	u.ID = uuid.New()
	u.CreatedAt = time.Now()
	u.UpdatedAt = time.Now()
	if u.Status == "" {
		u.Status = StatusPending
	}
	_, err := r.db.Exec(
		`INSERT INTO users (id, email, password_hash, phone, role, status, wallet_address, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		u.ID, u.Email, u.PasswordHash, u.Phone, u.Role, u.Status, u.WalletAddress, u.CreatedAt, u.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

func (r *Repository) FindByEmail(email string) (*User, error) {
	u := &User{}
	err := r.db.QueryRow(
		`SELECT id, email, password_hash, phone, role, status, wallet_address, created_at, updated_at
		 FROM users WHERE email = $1`, email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Phone, &u.Role, &u.Status, &u.WalletAddress, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("find user by email: %w", err)
	}
	return u, nil
}

func (r *Repository) FindByID(id uuid.UUID) (*User, error) {
	u := &User{}
	err := r.db.QueryRow(
		`SELECT id, email, password_hash, phone, role, status, wallet_address, created_at, updated_at
		 FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Phone, &u.Role, &u.Status, &u.WalletAddress, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("find user by id: %w", err)
	}
	return u, nil
}

func (r *Repository) BindWallet(id uuid.UUID, walletAddress string) error {
	_, err := r.db.Exec(
		`UPDATE users SET wallet_address = $1, updated_at = $2 WHERE id = $3`,
		walletAddress, time.Now(), id,
	)
	return err
}

func (r *Repository) UpdateStatus(id uuid.UUID, status UserStatus) error {
	_, err := r.db.Exec(
		`UPDATE users SET status = $1, updated_at = $2 WHERE id = $3`,
		status, time.Now(), id,
	)
	return err
}

// UserAdminView 管理后台用户视图（含 KYC 状态）
type UserAdminView struct {
	ID             uuid.UUID `json:"id"`
	Email          string    `json:"email"`
	Role           string    `json:"role"`
	Status         string    `json:"status"`
	WalletAddress  string    `json:"wallet_address"`
	KYCStatus      string    `json:"kyc_status"`
	KYCCreatedAt   *time.Time `json:"kyc_created_at,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

// ListAllAdmin 管理后台用户列表（LEFT JOIN 最新 KYC 提交）
func (r *Repository) ListAllAdmin(limit, offset int) ([]UserAdminView, int64, error) {
	var total int64
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&total)
	rows, err := r.db.Query(
		`SELECT u.id, u.email, u.role, u.status, u.wallet_address,
		        COALESCE(ks.status, ''), ks.submitted_at, u.created_at
		 FROM users u
		 LEFT JOIN kyc_submissions ks ON ks.id = (
		   SELECT id FROM kyc_submissions WHERE user_id = u.id ORDER BY submitted_at DESC LIMIT 1
		 )
		 ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`, limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("list users admin: %w", err)
	}
	defer rows.Close()
	var out []UserAdminView
	for rows.Next() {
		var v UserAdminView
		if err := rows.Scan(&v.ID, &v.Email, &v.Role, &v.Status, &v.WalletAddress, &v.KYCStatus, &v.KYCCreatedAt, &v.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, v)
	}
	return out, total, nil
}

// GetWalletAddress 查询用户绑定钱包地址
func (r *Repository) GetWalletAddress(id uuid.UUID) (string, error) {
	var addr string
	err := r.db.QueryRow(`SELECT wallet_address FROM users WHERE id = $1`, id).Scan(&addr)
	if err != nil {
		return "", fmt.Errorf("get wallet address: %w", err)
	}
	return addr, nil
}
