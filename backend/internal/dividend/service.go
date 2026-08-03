package dividend

import (
	"errors"
	"math"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// CreatePlan 创建分红/计息计划
func (s *Service) CreatePlan(assetID, createdBy uuid.UUID, name string, dtype DividendType, rate float64, frequency string, startDate time.Time, endDate *time.Time, totalPeriods int) (*DividendPlan, error) {
	if rate <= 0 || rate > 100 {
		return nil, errors.New("rate must be between 0 and 100")
	}
	if totalPeriods <= 0 {
		return nil, errors.New("total_periods must be positive")
	}

	plan := &DividendPlan{
		AssetID:      assetID,
		Name:         name,
		Type:         dtype,
		Rate:         rate,
		Frequency:    frequency,
		StartDate:    startDate,
		EndDate:      endDate,
		TotalPeriods: totalPeriods,
		Status:       DividendStatusPending,
		CreatedBy:    createdBy,
	}

	if err := s.repo.CreatePlan(plan); err != nil {
		return nil, err
	}
	return plan, nil
}

// CalculateDividend 计算单个用户的分红金额
func (s *Service) CalculateDividend(plan *DividendPlan, holdingAmount float64) *DividendCalculation {
	periodRate := plan.Rate / float64(plan.TotalPeriods) / 100
	periodAmount := holdingAmount * periodRate
	totalAmount := periodAmount * float64(plan.TotalPeriods)

	return &DividendCalculation{
		HoldingAmount: holdingAmount,
		Rate:          plan.Rate,
		PeriodAmount:  math.Round(periodAmount*100) / 100,
		TotalAmount:   math.Round(totalAmount*100) / 100,
		Periods:       plan.TotalPeriods,
	}
}

// AccrueInterest 计息累计（按日）
func (s *Service) AccrueInterest(planID, userID, assetID uuid.UUID, principal float64) (*InterestAccrual, error) {
	plan, err := s.repo.FindPlanByID(planID)
	if err != nil {
		return nil, errors.New("plan not found")
	}
	if plan.Type != DividendTypeInterest {
		return nil, errors.New("plan is not an interest-bearing plan")
	}

	dailyRate := plan.Rate / 36500 // 年化利率转日利率
	dailyInterest := principal * dailyRate

	existing, err := s.repo.FindAccrualByPlanAndUser(planID, userID)
	if err != nil {
		// 新建
		accrual := &InterestAccrual{
			PlanID:        planID,
			UserID:        userID,
			AssetID:       assetID,
			Principal:     principal,
			AccruedAmount: math.Round(dailyInterest*100) / 100,
			LastAccrualAt: time.Now(),
		}
		if err := s.repo.UpsertAccrual(accrual); err != nil {
			return nil, err
		}
		return accrual, nil
	}

	// 更新已有
	existing.AccruedAmount += math.Round(dailyInterest*100) / 100
	existing.LastAccrualAt = time.Now()
	if err := s.repo.UpsertAccrual(existing); err != nil {
		return nil, err
	}
	return existing, nil
}

// PayDividend 执行单期分红发放
func (s *Service) PayDividend(planID uuid.UUID, periodNum int, calculations []DividendCalculation) ([]DividendRecord, error) {
	plan, err := s.repo.FindPlanByID(planID)
	if err != nil {
		return nil, errors.New("plan not found")
	}
	if plan.PaidPeriods >= plan.TotalPeriods {
		return nil, errors.New("all periods already paid")
	}

	var records []DividendRecord
	for _, calc := range calculations {
		record := DividendRecord{
			PlanID:        planID,
			UserID:        calc.UserID,
			AssetID:       plan.AssetID,
			PeriodNum:     periodNum,
			Amount:        calc.PeriodAmount,
			HoldingAmount: calc.HoldingAmount,
			Rate:          plan.Rate,
			Status:        DividendStatusPending,
		}
		records = append(records, record)
	}

	if err := s.repo.BatchCreateRecords(records); err != nil {
		return nil, err
	}

	// 更新已付期数
	if err := s.repo.IncrementPaidPeriods(planID); err != nil {
		return nil, err
	}

	return records, nil
}

// GetPlan 获取计划详情
func (s *Service) GetPlan(id uuid.UUID) (*DividendPlan, error) {
	return s.repo.FindPlanByID(id)
}

// GetPlansByAsset 获取资产的所有分红计划
func (s *Service) GetPlansByAsset(assetID uuid.UUID) ([]DividendPlan, error) {
	return s.repo.FindPlansByAsset(assetID)
}

// GetUserRecords 获取用户的分红记录
func (s *Service) GetUserRecords(userID uuid.UUID) ([]DividendRecord, error) {
	return s.repo.FindRecordsByUser(userID)
}

// GetUserAccrual 获取用户的计息累计
func (s *Service) GetUserAccrual(planID, userID uuid.UUID) (*InterestAccrual, error) {
	return s.repo.FindAccrualByPlanAndUser(planID, userID)
}
