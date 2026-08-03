package revenue

import (
	"fmt"
	"math/big"
	"strings"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// GetFee 获取费率配置（无配置时返回默认值）
func (s *Service) GetFee() (*PlatformFee, error) {
	f, err := s.repo.GetFee()
	if err != nil {
		return nil, err
	}
	if f == nil {
		return &PlatformFee{ID: "default", MintFeeRate: 100, TransferFeeRate: 0, GasMarkupRate: 0}, nil
	}
	return f, nil
}

// UpdateFee 更新费率（合规：记录操作人）
func (s *Service) UpdateFee(mintFeeRate, transferFeeRate, gasMarkupRate int64, treasuryAddress, updatedBy string) (*PlatformFee, error) {
	if mintFeeRate < 0 || mintFeeRate > 10000 {
		return nil, fmt.Errorf("mint_fee_rate must be 0-10000 (0.01%%-100%%)")
	}
	if transferFeeRate < 0 || transferFeeRate > 10000 {
		return nil, fmt.Errorf("transfer_fee_rate must be 0-10000")
	}
	if gasMarkupRate < 0 || gasMarkupRate > 10000 {
		return nil, fmt.Errorf("gas_markup_rate must be 0-10000")
	}
	f := &PlatformFee{
		ID:              "default",
		MintFeeRate:     mintFeeRate,
		TransferFeeRate: transferFeeRate,
		GasMarkupRate:   gasMarkupRate,
		TreasuryAddress: treasuryAddress,
		UpdatedBy:       updatedBy,
	}
	if err := s.repo.UpsertFee(f); err != nil {
		return nil, err
	}
	return f, nil
}

// CalcMintFee 计算铸造费（万分数，金额为 decimal 字符串）：amount * rate / 10000
// MulDecimal 高精度 decimal 字符串乘法："1000000" * "10.50" -> "10500000.00"
func MulDecimal(a, b string) (string, error) {
	parse := func(v string) (*big.Int, int) {
		neg := false
		vs := v
		if strings.HasPrefix(vs, "-") {
			neg = true
			vs = vs[1:]
		}
		parts := strings.SplitN(vs, ".", 2)
		intPart := parts[0]
		fracPart := ""
		if len(parts) == 2 {
			fracPart = parts[1]
		}
		if intPart == "" {
			intPart = "0"
		}
		n, _ := new(big.Int).SetString(intPart+fracPart, 10)
		if n == nil {
			n = big.NewInt(0)
		}
		if neg {
			n.Neg(n)
		}
		return n, len(fracPart)
	}
	na, da := parse(a)
	nb, db := parse(b)
	prod := new(big.Int).Mul(na, nb)
	scale := da + db
	if scale == 0 {
		return prod.String(), nil
	}
	// 缩放：除以 10^scale（保留 scale 位小数）
	div := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(scale)), nil)
	q := new(big.Int).Quo(prod, div)
	r := new(big.Int).Rem(prod, div)
	rs := r.String()
	for len(rs) < scale {
		rs = "0" + rs
	}
	return q.String() + "." + rs, nil
}

func (s *Service) CalcMintFee(amount string, rate int64) (string, error) {
	neg := strings.HasPrefix(amount, "-")
	a := amount
	if neg {
		a = a[1:]
	}
	parts := strings.SplitN(a, ".", 2)
	intPart, frac := parts[0], ""
	if len(parts) == 2 {
		frac = parts[1]
	}
	if intPart == "" {
		intPart = "0"
	}
	amt, ok := new(big.Int).SetString(intPart+frac, 10)
	if !ok {
		return "", fmt.Errorf("invalid amount: %s", amount)
	}
	if neg {
		amt.Neg(amt)
	}
	scale := len(frac)

	// fee = amount * rate / 10000
	fee := new(big.Int).Mul(amt, big.NewInt(rate))
	fee.Div(fee, big.NewInt(10000))

	// 按原小数位缩放回显
	if scale == 0 {
		return fee.String(), nil
	}
	div := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(scale)), nil)
	q := new(big.Int).Quo(fee, div)
	r := new(big.Int).Rem(fee, div)
	rs := r.String()
	for len(rs) < scale {
		rs = "0" + rs
	}
	return q.String() + "." + rs, nil
}

func (s *Service) RecordMintRevenue(assetID, userID, mintFee, txHash, gasUsedWei, detail string) error {
	if mintFee != "" && mintFee != "0" {
		rec := &RevenueRecord{
			Category:   "mint_fee",
			AssetID:    assetID,
			UserID:     userID,
			Amount:     mintFee,
			Currency:   "HKD",
			TxHash:     txHash,
			GasUsedWei: gasUsedWei,
			Detail:     detail,
		}
		if err := s.repo.InsertRevenue(rec); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) RecordGas(rec *GasRecord) error {
	return s.repo.InsertGas(rec)
}

func (s *Service) RecordAudit(adminID, action, target, detail string) error {
	return s.repo.InsertAudit(&AuditLog{AdminID: adminID, Action: action, Target: target, Detail: detail})
}

func (s *Service) ListRevenue(limit, offset int) ([]RevenueRecord, int64, error) {
	return s.repo.ListRevenue(limit, offset)
}

func (s *Service) ListGas(limit, offset int) ([]GasRecord, int64, error) {
	return s.repo.ListGas(limit, offset)
}

func (s *Service) ListAudit(limit, offset int) ([]AuditLog, int64, error) {
	return s.repo.ListAudit(limit, offset)
}
