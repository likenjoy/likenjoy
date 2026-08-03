package user

import (
	"time"

	"github.com/google/uuid"
)

// UserRole 用户角色
type UserRole string

const (
	RoleInvestor     UserRole = "investor"      // 合格投资者
	RoleIssuer       UserRole = "issuer"        // 资产发行方
	RoleAdmin        UserRole = "admin"         // 平台管理员
	RoleCompliance   UserRole = "compliance"    // 合规官
)

// UserStatus 账户状态
type UserStatus string

const (
	StatusPending   UserStatus = "pending"    // 待激活
	StatusActive    UserStatus = "active"     // 正常
	StatusSuspended UserStatus = "suspended"  // 暂停
	StatusClosed    UserStatus = "closed"     // 已注销
)

// User 用户主体
type User struct {
	ID           uuid.UUID  `json:"id"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"`
	Phone        string     `json:"phone,omitempty"`
	Role         UserRole   `json:"role"`
	Status       UserStatus `json:"status"`
	WalletAddress string     `json:"wallet_address"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// InvestorProfile 合格投资者补充信息
type InvestorProfile struct {
	UserID             uuid.UUID `json:"user_id"`
	FullName           string    `json:"full_name"`
	Nationality        string    `json:"nationality"`
	IDType             string    `json:"id_type"`   // passport / national_id
	IDNumber           string    `json:"id_number"`
	AccreditationLevel string    `json:"accreditation_level"` // individual / professional_investor
	NetWorthTier       string    `json:"net_worth_tier"`      // tier_1 (<1M) / tier_2 (1M-8M) / tier_3 (>8M)
	RiskScore          int       `json:"risk_score"`           // 0-100
}
