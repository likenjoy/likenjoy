package asset

import (
	"context"
	"crypto/sha256"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"time"

	"rwa-exchange/internal/blockchain"
	"rwa-exchange/internal/revenue"
	"rwa-exchange/internal/user"

	"github.com/ethereum/go-ethereum/common"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	svc        *Service
	tokenOp    *blockchain.TokenOperator
	tokenAddr  common.Address
	revenueSvc *revenue.Service
	userRepo   *user.Repository
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) SetBlockchain(tokenOp *blockchain.TokenOperator, tokenAddr common.Address) {
	h.tokenOp = tokenOp
	h.tokenAddr = tokenAddr
}

func (h *Handler) SetRevenue(svc *revenue.Service) {
	h.revenueSvc = svc
}

func (h *Handler) SetUserRepo(r *user.Repository) {
	h.userRepo = r
}

type createAssetReq struct {
	Name          string `json:"name" binding:"required"`
	Symbol        string `json:"symbol" binding:"required"`
	AssetType     string `json:"asset_type" binding:"required"`
	TotalSupply   string `json:"total_supply" binding:"required"`
	PricePerUnit  string `json:"price_per_unit" binding:"required"`
	MinInvestment string `json:"min_investment" binding:"required"`
	Description   string `json:"description"`
}

func (h *Handler) CreateAsset(c *gin.Context) {
	var req createAssetReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	issuerID := c.MustGet("user_id").(uuid.UUID)

	asset, err := h.svc.CreateAsset(
		issuerID,
		req.Name,
		req.Symbol,
		AssetType(req.AssetType),
		req.Description,
		req.TotalSupply,
		req.PricePerUnit,
		"HKD",
		req.MinInvestment,
		"0",
		0,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 自动上链：同步调用
	mintResult := ""
	contractAddr := ""
	status := string(asset.Status)
	if h.tokenOp != nil {
		txHash, gasUsed, err := h.mintOnChainSync(asset.ID, req.TotalSupply)
		if err != nil {
			log.Printf("[CreateAsset] Mint failed for asset %s: %v", asset.ID, err)
			mintResult = "mint_failed: " + err.Error()
		} else {
			mintResult = "minted: " + txHash
			contractAddr = h.tokenAddr.Hex()
			status = string(StatusLive)
			// 收入记账：铸造费（按发行总额 total_supply * price_per_unit * rate/10000）
			if h.revenueSvc != nil {
				h.recordMintRevenue(asset.ID, issuerID, req.TotalSupply, req.PricePerUnit, txHash, gasUsed)
			}
		}
	}

	// 记录初始价格快照（收益曲线数据源）
	if herr := h.svc.RecordPrice(asset.ID, asset.PricePerUnit); herr != nil {
		log.Printf("[CreateAsset] record price: %v", herr)
	}
	c.JSON(http.StatusCreated, gin.H{
		"id":               asset.ID,
		"issuer_id":        asset.IssuerID,
		"name":             asset.Name,
		"symbol":           asset.Symbol,
		"asset_type":       asset.AssetType,
		"description":      asset.Description,
		"total_supply":     asset.TotalSupply,
		"price_per_unit":   asset.PricePerUnit,
		"currency":         asset.Currency,
		"min_investment":   asset.MinInvestment,
		"status":           status,
		"contract_address": contractAddr,
		"mint_result":      mintResult,
		"created_at":       asset.CreatedAt,
	})
}

// GET /api/portfolio 投资者持仓（绑定钱包的链上余额）
func (h *Handler) ListPortfolio(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad user id"})
		return
	}
	if h.tokenOp == nil {
		c.JSON(http.StatusOK, gin.H{"wallet": "", "positions": []interface{}{}, "total_value": "0"})
		return
	}

	// 查用户绑定钱包
	walletAddr, err := h.getUserWallet(uid)
	if err != nil || walletAddr == "" {
		c.JSON(http.StatusOK, gin.H{"wallet": walletAddr, "positions": []interface{}{}, "total_value": "0", "note": "未绑定钱包"})
		return
	}
	investor := common.HexToAddress(walletAddr)

	// 链上总余额（单代币部署模型：一个 RWAToken 承载所有资产，按 assetId 区分）
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	bal, err := h.tokenOp.BalanceOf(ctx, h.tokenAddr, investor)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "balance query failed: " + err.Error()})
		return
	}
	decimals := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	human := new(big.Int).Div(bal, decimals)

	// 资产清单（供前端展示可投资/持有的资产）
	assets, _, err := h.svc.ListLiveAssets(100, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	type assetInfo struct {
		AssetID      string `json:"asset_id"`
		Symbol       string `json:"symbol"`
		Name         string `json:"name"`
		PricePerUnit string `json:"price_per_unit"`
	}
	assetList := []assetInfo{}
	for _, a := range assets {
		assetList = append(assetList, assetInfo{AssetID: a.ID.String(), Symbol: a.Symbol, Name: a.Name, PricePerUnit: a.PricePerUnit})
	}

	c.JSON(http.StatusOK, gin.H{
		"wallet":       walletAddr,
		"balance":      human.String(),
		"balance_wei":  bal.String(),
		"assets":       assetList,
		"token_symbol": "RVGOLD",
		"note":         "单代币模型：链上余额按代币总量计，价值需按具体资产单价估算",
	})
}

// getUserWallet 查用户绑定钱包（复用 user repo）
func (h *Handler) getUserWallet(userID uuid.UUID) (string, error) {
	// 通过用户模块查询
	return h.userRepo.GetWalletAddress(userID)
}

// recordMintRevenue 记录铸造费收入与 gas 成本（合规审计）
func (h *Handler) recordMintRevenue(assetID uuid.UUID, issuerID uuid.UUID, totalSupply, pricePerUnit, txHash string, gasUsed uint64) {
	fee, err := h.revenueSvc.GetFee()
	if err != nil {
		log.Printf("[revenue] GetFee failed: %v", err)
		return
	}
	if fee.MintFeeRate <= 0 {
		return
	}
	// 发行总额 = total_supply * price_per_unit（decimal 字符串乘法）
	issuance, err := revenue.MulDecimal(totalSupply, pricePerUnit)
	if err != nil {
		log.Printf("[revenue] MulDecimal failed: %v", err)
		return
	}
	mintFee, err := h.revenueSvc.CalcMintFee(issuance, fee.MintFeeRate)
	if err != nil {
		log.Printf("[revenue] CalcMintFee failed: %v", err)
		return
	}
	if err := h.revenueSvc.RecordMintRevenue(assetID.String(), issuerID.String(), mintFee, txHash, strconv.FormatUint(gasUsed, 10),
		"supply="+totalSupply+",price="+pricePerUnit+",rate="+strconv.FormatInt(fee.MintFeeRate, 10)); err != nil {
		log.Printf("[revenue] RecordMintRevenue failed: %v", err)
	}
	// gas 记账
	if gasUsed > 0 {
		_ = h.revenueSvc.RecordGas(&revenue.GasRecord{
			TxHash:      txHash,
			ChainID:     31337,
			Action:      "mint",
			AssetID:     assetID.String(),
			UserID:      issuerID.String(),
			GasUsedWei:  strconv.FormatUint(gasUsed, 10),
			GasPriceWei: "0",
			CostWei:     "0",
		})
	}
}

// mintOnChainSync 同步在链上 mint 代币，返回 tx hash
func (h *Handler) mintOnChainSync(assetID uuid.UUID, totalSupply string) (string, uint64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 用 assetID 生成 bytes32 assetId
	assetIDHash := sha256.Sum256([]byte(assetID.String()))
	var assetIDBytes [32]byte
	copy(assetIDBytes[:], assetIDHash[:])

	// 解析总供应量（decimals=18）
	supply := new(big.Int)
	supply.SetString(totalSupply, 10)
	decimals := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	supply.Mul(supply, decimals)

	// 平台地址作为接收方
	platformAddr := h.tokenOp.Client().Signer().Address()

	tx, err := h.tokenOp.Mint(ctx, h.tokenAddr, platformAddr, supply, assetIDBytes)
	if err != nil {
		return "", 0, err
	}

	log.Printf("[mintOnChain] Asset %s mint tx sent: %s", assetID, tx.Hash().Hex())

	// 等待交易确认
	receipt, err := blockchain.WaitMined(ctx, h.tokenOp.Client(), tx)
	if err != nil {
		return tx.Hash().Hex(), 0, err
	}

	log.Printf("[mintOnChain] Asset %s confirmed in block %d gasUsed=%d", assetID, receipt.BlockNumber.Uint64(), receipt.GasUsed)

	// 强制更新资产状态为 live
	if err := h.svc.ForceGoLive(assetID, h.tokenAddr.Hex(), 31337); err != nil {
		log.Printf("[mintOnChain] ForceGoLive failed for asset %s: %v", assetID, err)
	}

	return tx.Hash().Hex(), receipt.GasUsed, nil
}

func (h *Handler) GetAsset(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset id"})
		return
	}
	asset, err := h.svc.GetAsset(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, asset)
}

func (h *Handler) ListAllAssets(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	offset := (page - 1) * size
	assets, total, err := h.svc.ListAllAssets(size, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": assets, "total": total, "page": page, "size": size})
}

func (h *Handler) ListLiveAssets(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	offset := (page - 1) * size
	assets, total, err := h.svc.ListLiveAssets(size, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": assets, "total": total, "page": page, "size": size})
}

func (h *Handler) ListIssuerAssets(c *gin.Context) {
	issuerID := c.Query("issuer_id")
	if issuerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "issuer_id required"})
		return
	}
	uid, err := uuid.Parse(issuerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid issuer_id"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	offset := (page - 1) * size
	assets, total, err := h.svc.ListIssuerAssets(uid, size, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": assets, "total": total, "page": page, "size": size})
}

func (h *Handler) SubmitForReview(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset id"})
		return
	}
	if err := h.svc.SubmitForReview(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "submitted for review"})
}

func (h *Handler) Approve(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset id"})
		return
	}
	if err := h.svc.Approve(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "approved"})
}

func (h *Handler) Reject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset id"})
		return
	}
	if err := h.svc.Reject(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "rejected"})
}

func (h *Handler) StartIssuance(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset id"})
		return
	}
	var req struct {
		RoundNumber  int    `json:"round_number"`
		Supply       string `json:"supply"`
		PricePerUnit string `json:"price_per_unit"`
		StartTime    int64  `json:"start_time"`
		EndTime      int64  `json:"end_time"`
		MinAlloc     string `json:"min_alloc"`
		MaxAlloc     string `json:"max_alloc"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	round, err := h.svc.StartIssuance(id, req.RoundNumber, req.Supply, req.PricePerUnit, req.StartTime, req.EndTime, req.MinAlloc, req.MaxAlloc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, round)
}

func (h *Handler) GoLive(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset id"})
		return
	}
	var req struct {
		ContractAddress string `json:"contract_address"`
		ChainID         int64  `json:"chain_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.GoLive(id, req.ContractAddress, req.ChainID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "asset is now live"})
}

func (h *Handler) AddDocument(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset id"})
		return
	}
	var req struct {
		DocType  string `json:"doc_type" binding:"required"`
		FileName string `json:"file_name" binding:"required"`
		FileHash string `json:"file_hash"`
		FileURL  string `json:"file_url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	doc, err := h.svc.AddDocument(id, req.DocType, req.FileName, req.FileHash, req.FileURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, doc)
}

func (h *Handler) GetRounds(c *gin.Context) {
	assetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset id"})
		return
	}
	rounds, err := h.svc.GetRounds(assetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rounds)
}

// GetPriceHistory GET /api/assets/:id/history 资产价格历史（收益曲线数据源）
func (h *Handler) GetPriceHistory(c *gin.Context) {
	assetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset id"})
		return
	}
	points, err := h.svc.PriceHistory(assetID, 90)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": points})
}