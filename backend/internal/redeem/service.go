package redeem

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// CalculateRedeem 计算赎回预估
func (s *Service) CalculateRedeem(assetID uuid.UUID, amount float64, pricePerUnit float64) (*RedeemCalculation, error) {
	rule, err := s.repo.FindRuleByAsset(assetID)
	if err != nil {
		return nil, errors.New("redeem rule not found for this asset")
	}

	calc := &RedeemCalculation{
		Amount:       amount,
		PricePerUnit: pricePerUnit,
		TotalValue:   amount * pricePerUnit,
		IsEligible:   true,
	}

	// 检查最小赎回量
	if amount < rule.MinAmount {
		calc.IsEligible = false
		calc.BlockReason = "below minimum redeem amount"
		return calc, nil
	}

	// 检查最大赎回量
	if rule.MaxAmount != nil && amount > *rule.MaxAmount {
		calc.IsEligible = false
		calc.BlockReason = "exceeds maximum redeem amount"
		return calc, nil
	}

	// 计算手续费
	calc.Fee = calc.TotalValue * rule.FeeRate / 100
	calc.NetAmount = calc.TotalValue - calc.Fee

	return calc, nil
}

// SubmitRequest 提交赎回申请
func (s *Service) SubmitRequest(userID, assetID uuid.UUID, redeemType RedeemType, amount float64, unit string, pricePerUnit float64, deliveryMethod, deliveryAddress string) (*RedeemRequest, error) {
	// 检查赎回规则
	rule, err := s.repo.FindRuleByAsset(assetID)
	if err != nil {
		return nil, errors.New("redeem not available for this asset")
	}

	// 检查赎回类型是否允许
	if redeemType == RedeemTypePhysical && !rule.AllowPhysical {
		return nil, errors.New("physical redeem not allowed for this asset")
	}
	if redeemType == RedeemTypeCash && !rule.AllowCash {
		return nil, errors.New("cash redeem not allowed for this asset")
	}

	// 检查最小赎回量
	if amount < rule.MinAmount {
		return nil, errors.New("amount below minimum redeem amount")
	}
	if rule.MaxAmount != nil && amount > *rule.MaxAmount {
		return nil, errors.New("amount exceeds maximum redeem amount")
	}

	// 计算费用
	totalValue := amount * pricePerUnit
	fee := totalValue * rule.FeeRate / 100
	netAmount := totalValue - fee

	req := &RedeemRequest{
		UserID:          userID,
		AssetID:         assetID,
		Type:            redeemType,
		Amount:          amount,
		Unit:            unit,
		PricePerUnit:    pricePerUnit,
		TotalValue:      totalValue,
		Fee:             fee,
		NetAmount:       netAmount,
		Status:          RedeemStatusPending,
		DeliveryMethod:  deliveryMethod,
		DeliveryAddress: deliveryAddress,
	}

	if err := s.repo.CreateRequest(req); err != nil {
		return nil, err
	}
	return req, nil
}

// ApproveRequest 批准赎回
func (s *Service) ApproveRequest(requestID, approverID uuid.UUID) (*RedeemRequest, error) {
	req, err := s.repo.FindRequestByID(requestID)
	if err != nil {
		return nil, errors.New("request not found")
	}
	if req.Status != RedeemStatusPending {
		return nil, errors.New("request is not in pending status")
	}

	now := time.Now()
	updates := map[string]interface{}{
		"approved_by": approverID,
		"approved_at": now,
	}
	if err := s.repo.UpdateRequestStatus(requestID, RedeemStatusApproved, updates); err != nil {
		return nil, err
	}

	req.Status = RedeemStatusApproved
	req.ApprovedBy = &approverID
	req.ApprovedAt = &now
	return req, nil
}

// RejectRequest 拒绝赎回
func (s *Service) RejectRequest(requestID uuid.UUID, remark string) error {
	req, err := s.repo.FindRequestByID(requestID)
	if err != nil {
		return errors.New("request not found")
	}
	if req.Status != RedeemStatusPending {
		return errors.New("request is not in pending status")
	}

	updates := map[string]interface{}{"remark": remark}
	return s.repo.UpdateRequestStatus(requestID, RedeemStatusRejected, updates)
}

// CompleteRequest 完成赎回
func (s *Service) CompleteRequest(requestID uuid.UUID, txHash string) error {
	req, err := s.repo.FindRequestByID(requestID)
	if err != nil {
		return errors.New("request not found")
	}
	if req.Status != RedeemStatusApproved && req.Status != RedeemStatusProcessing {
		return errors.New("request cannot be completed from current status")
	}

	now := time.Now()
	updates := map[string]interface{}{
		"tx_hash":      txHash,
		"completed_at": now,
	}
	return s.repo.UpdateRequestStatus(requestID, RedeemStatusCompleted, updates)
}

// ShipPhysical 实物发货
func (s *Service) ShipPhysical(requestID uuid.UUID, trackingNumber string) error {
	req, err := s.repo.FindRequestByID(requestID)
	if err != nil {
		return errors.New("request not found")
	}
	if req.Type != RedeemTypePhysical {
		return errors.New("only physical redeem can be shipped")
	}
	if req.Status != RedeemStatusApproved {
		return errors.New("request must be approved before shipping")
	}

	return s.repo.UpdateTracking(requestID, trackingNumber)
}

// UpsertRule 创建或更新赎回规则
func (s *Service) UpsertRule(rule *RedeemRule) error {
	return s.repo.UpsertRule(rule)
}

// GetRule 获取资产赎回规则
func (s *Service) GetRule(assetID uuid.UUID) (*RedeemRule, error) {
	return s.repo.FindRuleByAsset(assetID)
}

// GetUserRequests 获取用户的赎回记录
func (s *Service) GetUserRequests(userID uuid.UUID) ([]RedeemRequest, error) {
	return s.repo.FindRequestsByUser(userID)
}

// GetPendingRequests 获取待审核的赎回申请
func (s *Service) GetPendingRequests() ([]RedeemRequest, error) {
	return s.repo.FindPendingRequests()
}

// GetRequest 获取赎回详情
func (s *Service) GetRequest(id uuid.UUID) (*RedeemRequest, error) {
	return s.repo.FindRequestByID(id)
}
