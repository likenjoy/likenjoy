package kyc

import (
	"time"

	"github.com/google/uuid"
)

// KYCStatus KYC审核状态
type KYCStatus string

const (
	StatusNotSubmitted KYCStatus = "not_submitted"
	StatusPending      KYCStatus = "pending"
	StatusApproved     KYCStatus = "approved"
	StatusRejected     KYCStatus = "rejected"
	StatusExpired      KYCStatus = "expired"
)

// KYCDocument 单份KYC文件
type KYCDocument struct {
	ID         uuid.UUID `json:"id"`
	UserID     uuid.UUID `json:"user_id"`
	DocType    string    `json:"doc_type"`    // passport / proof_of_address / bank_statement / selfie
	FileName   string    `json:"file_name"`
	FileHash   string    `json:"file_hash"`   // SHA-256 for tamper evidence
	UploadedAt time.Time `json:"uploaded_at"`
}

// KYCSubmission 一次KYC提交（可含多份文件）
type KYCSubmission struct {
	ID          uuid.UUID  `json:"id"`
	UserID      uuid.UUID  `json:"user_id"`
	Status      KYCStatus  `json:"status"`
	SubmittedAt time.Time  `json:"submitted_at"`
	ReviewedAt  *time.Time `json:"reviewed_at,omitempty"`
	ReviewedBy  *uuid.UUID `json:"reviewed_by,omitempty"`
	RejectReason string    `json:"reject_reason,omitempty"`
	Documents   []KYCDocument `json:"documents,omitempty"`
}

// AccreditationCheck 合格投资者认证
type AccreditationCheck struct {
	ID            uuid.UUID `json:"id"`
	UserID        uuid.UUID `json:"user_id"`
	Level         string    `json:"level"`          // individual / professional_investor
	NetWorthProof string    `json:"net_worth_proof"` // 资产证明文件hash
	Status        KYCStatus `json:"status"`
	CheckedAt     *time.Time `json:"checked_at,omitempty"`
	CheckedBy     *uuid.UUID `json:"checked_by,omitempty"`
	ExpiresAt     time.Time  `json:"expires_at"`
}
