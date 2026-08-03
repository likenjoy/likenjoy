package asset

import (
	"errors"
	"math/big"
	"time"

	"github.com/google/uuid"
)

var (
	ErrAssetNotFound      = errors.New("asset not found")
	ErrInvalidStatus      = errors.New("invalid status transition")
	ErrRoundNotActive     = errors.New("no active round")
	ErrInsufficientSupply = errors.New("insufficient supply in round")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateAsset(issuerID uuid.UUID, name, symbol string, assetType AssetType, description string, totalSupply, pricePerUnit, currency string, minInvestment, maxInvestment string, lockupPeriod int) (*Asset, error) {
	asset := &Asset{
		IssuerID:      issuerID,
		Name:          name,
		Symbol:        symbol,
		AssetType:     assetType,
		Description:   description,
		TotalSupply:   totalSupply,
		PricePerUnit:  pricePerUnit,
		Currency:      currency,
		MinInvestment: minInvestment,
		MaxInvestment: maxInvestment,
		LockupPeriod:  lockupPeriod,
		Status:        StatusDraft,
	}
	if err := s.repo.Create(asset); err != nil {
		return nil, err
	}
	return asset, nil
}

func (s *Service) SubmitForReview(assetID uuid.UUID) error {
	asset, err := s.repo.FindByID(assetID)
	if err != nil {
		return ErrAssetNotFound
	}
	if asset.Status != StatusDraft && asset.Status != StatusRejected {
		return ErrInvalidStatus
	}
	return s.repo.UpdateStatus(assetID, StatusReviewing)
}

func (s *Service) Approve(assetID uuid.UUID) error {
	asset, err := s.repo.FindByID(assetID)
	if err != nil {
		return ErrAssetNotFound
	}
	if asset.Status != StatusReviewing {
		return ErrInvalidStatus
	}
	return s.repo.UpdateStatus(assetID, StatusApproved)
}

func (s *Service) Reject(assetID uuid.UUID) error {
	asset, err := s.repo.FindByID(assetID)
	if err != nil {
		return ErrAssetNotFound
	}
	if asset.Status != StatusReviewing {
		return ErrInvalidStatus
	}
	return s.repo.UpdateStatus(assetID, StatusRejected)
}

func (s *Service) StartIssuance(assetID uuid.UUID, roundNumber int, supply, pricePerUnit string, startTime, endTime int64, minAlloc, maxAlloc string) (*IssuanceRound, error) {
	asset, err := s.repo.FindByID(assetID)
	if err != nil {
		return nil, ErrAssetNotFound
	}
	if asset.Status != StatusApproved {
		return nil, ErrInvalidStatus
	}

	round := &IssuanceRound{
		AssetID:      assetID,
		RoundNumber:  roundNumber,
		Supply:       supply,
		PricePerUnit: pricePerUnit,
		StartTime:    time.Unix(startTime, 0),
		EndTime:      time.Unix(endTime, 0),
		MinAlloc:     minAlloc,
		MaxAlloc:     maxAlloc,
		Status:       "upcoming",
	}
	if err := s.repo.CreateRound(round); err != nil {
		return nil, err
	}
	_ = s.repo.UpdateStatus(assetID, StatusIssuing)
	return round, nil
}

func (s *Service) GoLive(assetID uuid.UUID, contractAddress string, chainID int64) error {
	asset, err := s.repo.FindByID(assetID)
	if err != nil {
		return ErrAssetNotFound
	}
	if asset.Status != StatusIssuing {
		return ErrInvalidStatus
	}
	if err := s.repo.UpdateContract(assetID, contractAddress, chainID); err != nil {
		return err
	}
	return s.repo.UpdateStatus(assetID, StatusLive)
}

// ForceGoLive 强制将资产设为 live（跳过状态检查，用于自动 mint 后）
func (s *Service) ForceGoLive(assetID uuid.UUID, contractAddress string, chainID int64) error {
	if err := s.repo.UpdateContract(assetID, contractAddress, chainID); err != nil {
		return err
	}
	return s.repo.UpdateStatus(assetID, StatusLive)
}

func (s *Service) CheckRoundAvailability(roundID uuid.UUID, amount string) (bool, error) {
	round, err := s.repo.FindActiveRound(roundID)
	if err != nil {
		return false, ErrRoundNotActive
	}
	supply := new(big.Int)
	supply.SetString(round.Supply, 10)
	sold := new(big.Int)
	sold.SetString(round.Sold, 10)
	amt := new(big.Int)
	amt.SetString(amount, 10)

	remaining := new(big.Int).Sub(supply, sold)
	return remaining.Cmp(amt) >= 0, nil
}

func (s *Service) GetAsset(assetID uuid.UUID) (*Asset, error) {
	return s.repo.FindByID(assetID)
}

func (s *Service) ListAllAssets(limit, offset int) ([]Asset, int64, error) {
	return s.repo.FindAll(limit, offset)
}

func (s *Service) ListLiveAssets(limit, offset int) ([]Asset, int64, error) {
	return s.repo.FindLive(limit, offset)
}

func (s *Service) ListIssuerAssets(issuerID uuid.UUID, limit, offset int) ([]Asset, int64, error) {
	return s.repo.FindByIssuer(issuerID, limit, offset)
}

func (s *Service) AddDocument(assetID uuid.UUID, docType, fileName, fileHash, fileURL string) (*AssetDocument, error) {
	doc := &AssetDocument{
		AssetID:  assetID,
		DocType:  docType,
		FileName: fileName,
		FileHash: fileHash,
		FileURL:  fileURL,
	}
	return doc, s.repo.AddDocument(doc)
}

func (s *Service) GetRounds(assetID uuid.UUID) ([]IssuanceRound, error) {
	return s.repo.FindRounds(assetID)
}
