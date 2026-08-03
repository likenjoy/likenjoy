package kyc

import (
	"errors"
	"time"

	"rwa-exchange/pkg/compliance"

	"github.com/google/uuid"
)

var (
	ErrAlreadySubmitted = errors.New("kyc already submitted")
	ErrNotSubmitted     = errors.New("no kyc submission found")
)

type Service struct {
	repo     *Repository
	sanctions *compliance.SanctionsChecker
}

// SetSanctions 注入制裁名单检查器
func (s *Service) SetSanctions(c *compliance.SanctionsChecker) {
	s.sanctions = c
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Submit(userID uuid.UUID, fullName, country, level, netWorthProof string) (*KYCSubmission, error) {
	existing, _ := s.repo.FindSubmissionByUser(userID)
	if existing != nil && existing.Status == StatusPending {
		return nil, ErrAlreadySubmitted
	}

	// 合规预检：制裁名单 + 受限国家
	complianceReason := ""
	if s.sanctions != nil {
		if hit, entry := s.sanctions.Check(fullName); hit {
			complianceReason = "sanctions list match: " + entry
		}
	}
	if complianceReason == "" && compliance.CountryRestricted(country) {
		complianceReason = compliance.RestrictedCountryHint()
	}

	sub := &KYCSubmission{UserID: userID}
	if err := s.repo.CreateSubmission(sub); err != nil {
		return nil, err
	}

	// 制裁/锁区命中：直接拒绝并记录原因
	if complianceReason != "" {
		_ = s.repo.UpdateStatus(sub.ID, StatusRejected, uuid.Nil, complianceReason)
		sub.Status = StatusRejected
		sub.RejectReason = complianceReason
		return sub, nil
	}

	// 专业投资者认证申请（随 KYC 一并提交）
	if level != "" {
		check := &AccreditationCheck{
			UserID:        userID,
			Level:         level,
			NetWorthProof: netWorthProof,
			Status:        StatusPending,
		}
		if err := s.repo.SaveAccreditation(check); err != nil {
			return nil, err
		}
	}
	return sub, nil
}

// GetAccreditation 查询认证状态
func (s *Service) GetAccreditation(userID uuid.UUID) (*AccreditationCheck, error) {
	c, err := s.repo.GetAccreditation(userID)
	if err != nil {
		return nil, err
	}
	return c, nil
}

// ApproveAccreditation 审核通过专业投资者认证（合规角色操作）
func (s *Service) ApproveAccreditation(userID, reviewerID uuid.UUID) error {
	now := time.Now()
	check := &AccreditationCheck{
		UserID:    userID,
		Status:    StatusApproved,
		CheckedAt: &now,
		CheckedBy: &reviewerID,
	}
	return s.repo.SaveAccreditation(check)
}

func (s *Service) GetSubmission(userID uuid.UUID) (*KYCSubmission, error) {
	return s.repo.FindSubmissionByUser(userID)
}

func (s *Service) Approve(submissionID, reviewerID uuid.UUID) error {
	return s.repo.UpdateStatus(submissionID, StatusApproved, reviewerID, "")
}

func (s *Service) Reject(submissionID, reviewerID uuid.UUID, reason string) error {
	return s.repo.UpdateStatus(submissionID, StatusRejected, reviewerID, reason)
}

func (s *Service) UploadDocument(userID uuid.UUID, docType, fileName, fileHash string) error {
	d := &KYCDocument{
		UserID:   userID,
		DocType:  docType,
		FileName: fileName,
		FileHash: fileHash,
	}
	return s.repo.AddDocument(d)
}

// ListPending 待审核 KYC 列表（admin）
func (s *Service) ListPending() ([]map[string]interface{}, error) {
	return s.repo.ListPending()
}
