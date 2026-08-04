package revenue

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"time"

	"rwa-exchange/internal/blockchain"

	"github.com/ethereum/go-ethereum/common"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service

	// 链上联动（可选）：更新费率时同步到 RWAToken 合约（转账手续费链上强制扣收）
	tokenOp   *blockchain.TokenOperator
	tokenAddr common.Address
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// SetBlockchain 注入链上操作器（admin 更新费率时同步合约）
func (h *Handler) SetBlockchain(op *blockchain.TokenOperator, tokenAddr common.Address) {
	h.tokenOp = op
	h.tokenAddr = tokenAddr
}

// GET /api/admin/fees
func (h *Handler) GetFees(c *gin.Context) {
	f, err := h.svc.GetFee()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, f)
}

type updateFeesReq struct {
	MintFeeRate     int64  `json:"mint_fee_rate"`
	TransferFeeRate int64  `json:"transfer_fee_rate"`
	GasMarkupRate   int64  `json:"gas_markup_rate"`
	TreasuryAddress string `json:"treasury_address"`
}

// PUT /api/admin/fees
func (h *Handler) UpdateFees(c *gin.Context) {
	var req updateFeesReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	adminID := c.GetString("user_id")
	f, err := h.svc.UpdateFee(req.MintFeeRate, req.TransferFeeRate, req.GasMarkupRate, req.TreasuryAddress, adminID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	_ = h.svc.RecordAudit(adminID, "update_fees", "default",
		"mint_fee_rate="+strconv.FormatInt(req.MintFeeRate, 10)+",transfer_fee_rate="+strconv.FormatInt(req.TransferFeeRate, 10)+",gas_markup_rate="+strconv.FormatInt(req.GasMarkupRate, 10))

	// 链上联动：转账费率同步到 RWAToken 合约（链上强制扣收，T-REX TransferFees 模式）
	// treasury_address 作为手续费收款地址（feeCollector）
	if h.tokenOp != nil && h.tokenAddr != (common.Address{}) && common.IsHexAddress(req.TreasuryAddress) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
		defer cancel()
		if _, err := h.tokenOp.SetTransferFee(ctx, h.tokenAddr, uint64(req.TransferFeeRate), common.HexToAddress(req.TreasuryAddress)); err != nil {
			// 链上同步失败：返回 500 提示（费率已存库，但链上未生效，需重试）
			log.Printf("[revenue] sync transfer fee to chain FAILED: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "fees saved, but on-chain sync failed: " + err.Error()})
			return
		}
		log.Printf("[revenue] transfer fee synced to chain: rate=%d collector=%s", req.TransferFeeRate, req.TreasuryAddress)
	}

	c.JSON(http.StatusOK, f)
}

// GET /api/admin/revenue?page=1&size=20
func (h *Handler) ListRevenue(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	if size > 100 {
		size = 100
	}
	recs, total, err := h.svc.ListRevenue(size, (page-1)*size)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": recs, "total": total, "page": page, "size": size})
}

// GET /api/admin/gas?page=1&size=20
func (h *Handler) ListGas(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	if size > 100 {
		size = 100
	}
	recs, total, err := h.svc.ListGas(size, (page-1)*size)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": recs, "total": total, "page": page, "size": size})
}

// GET /api/admin/audit?page=1&size=20
func (h *Handler) ListAudit(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	if size > 100 {
		size = 100
	}
	recs, total, err := h.svc.ListAudit(size, (page-1)*size)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": recs, "total": total, "page": page, "size": size})
}
