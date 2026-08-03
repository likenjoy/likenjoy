package kyc

import (
	"context"
	"errors"
	"log"
	"time"

	"rwa-exchange/internal/blockchain"
	"rwa-exchange/pkg/compliance"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"math/big"
	"github.com/google/uuid"
)

var (
	ErrAlreadySubmitted = errors.New("kyc already submitted")
	ErrNotSubmitted     = errors.New("no kyc submission found")
)

type Service struct {
	repo           *Repository
	sanctions      *compliance.SanctionsChecker
	identityOp     *blockchain.IdentityOperator
	complianceOp   *blockchain.ComplianceOperator
	registryAddr   common.Address
	complianceAddr common.Address
	onchainEnabled bool
}

// SetOnChainOps 注入链上身份/白名单操作器（KYC 通过后自动上链）
func (s *Service) SetOnChainOps(identityOp *blockchain.IdentityOperator, complianceOp *blockchain.ComplianceOperator, registryAddr, complianceAddr common.Address) {
	s.identityOp = identityOp
	s.complianceOp = complianceOp
	s.registryAddr = registryAddr
	s.complianceAddr = complianceAddr
	s.onchainEnabled = identityOp != nil && complianceOp != nil
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

	sub := &KYCSubmission{UserID: userID, Country: country}
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
	// 先查询提交记录（拿 userID / country）
	sub, err := s.findByID(submissionID)
	if err != nil {
		return err
	}
	if err := s.repo.UpdateStatus(submissionID, StatusApproved, reviewerID, ""); err != nil {
		return err
	}
	// KYC 通过 → 链上注册身份 + 白名单（投资者可真正持有/交易代币）
	if err := s.onChainRegister(sub); err != nil {
		log.Printf("[kyc] on-chain register failed for user %s: %v", sub.UserID, err)
	}
	return nil
}

// findByID 通过提交 ID 查记录（含 user_id / country）
func (s *Service) findByID(submissionID uuid.UUID) (*KYCSubmission, error) {
	return s.repo.FindByID(submissionID)
}

// onChainRegister 链上注册投资者身份并加入白名单
// 流程：registerIdentity(identityHash=keccak(userID), countryCode) → addToWhitelist(无上限, 无锁定期)
func (s *Service) onChainRegister(sub *KYCSubmission) error {
	if !s.onchainEnabled {
		log.Printf("[kyc] on-chain ops not enabled, skip register for user %s", sub.UserID)
		return nil
	}
	wallet, err := s.repo.GetUserWallet(sub.UserID)
	if err != nil || wallet == "" {
		log.Printf("[kyc] user %s has no bound wallet, skip on-chain register", sub.UserID)
		return nil
	}
	investor := common.HexToAddress(wallet)
	if investor == (common.Address{}) {
		return errors.New("invalid wallet address: " + wallet)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 身份 hash：keccak256(userID)，链上只存 hash（隐私合规）
	identityHash := crypto.Keccak256Hash([]byte(sub.UserID.String()))
	countryCode := CountryCode(sub.Country)

	// 1) 注册链上身份（幂等：已注册则跳过，避免 revert）
	verified, err := s.identityOp.IsVerified(ctx, s.registryAddr, investor)
	if err == nil && verified {
		log.Printf("[kyc] identity already registered for %s, skip", wallet)
	} else {
		tx, err := s.identityOp.RegisterIdentity(ctx, s.registryAddr, investor, identityHash, countryCode)
		if err != nil {
			return err
		}
		if _, err := blockchain.WaitMined(ctx, s.identityOp.Client(), tx); err != nil {
			return err
		}
		log.Printf("[kyc] identity registered on-chain for %s (wallet=%s, country=%d)", sub.UserID, wallet, countryCode)
	}

	// 2) 加入白名单（幂等：已白名单则跳过）
	listed, err := s.complianceOp.IsWhitelisted(ctx, s.complianceAddr, investor)
	if err == nil && listed {
		log.Printf("[kyc] already whitelisted for %s, skip", wallet)
		return nil
	}
	tx2, err := s.complianceOp.AddToWhitelist(ctx, s.complianceAddr, investor, new(big.Int), 0)
	if err != nil {
		return err
	}
	if _, err := blockchain.WaitMined(ctx, s.complianceOp.Client(), tx2); err != nil {
		return err
	}
	log.Printf("[kyc] whitelisted on-chain for %s", wallet)
	return nil
}

// CountryCode ISO 3166-1 alpha-2 → 数字代码（用于链上身份国家字段）
func CountryCode(iso string) uint16 {
	switch iso {
	case "HK":
		return 344
	case "CN":
		return 156
	case "SG":
		return 702
	case "US":
		return 840
	case "GB":
		return 826
	case "JP":
		return 392
	case "MO":
		return 446
	case "TW":
		return 158
	default:
		return 0
	}
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
