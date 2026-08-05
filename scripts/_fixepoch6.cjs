const fs = require("fs");

// ===== handler.go 追加 epoch 接口 =====
const hp = "C:/Users/Administrator/Desktop/rwa-exchange/backend/internal/trade/handler.go";
let hc = fs.readFileSync(hp, "utf8");
if (!hc.includes("CreateEpochHandler")) {
  const add = `

// ========== Epoch 接口 ==========

type createEpochReq struct {
	AssetID string \`json:"asset_id" binding:"required"\`
}

// CreateEpochHandler POST /api/trades/epochs 创建结算周期
func (h *Handler) CreateEpochHandler(c *gin.Context) {
	var req createEpochReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	assetID, err := uuid.Parse(req.AssetID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset id"})
		return
	}
	userID := c.MustGet("user_id").(uuid.UUID)
	e, err := h.svc.CreateEpoch(assetID, userID.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, e)
}

// CloseEpochHandler POST /api/trades/epochs/:id/close 关闭并批量结算
func (h *Handler) CloseEpochHandler(c *gin.Context) {
	epochID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid epoch id"})
		return
	}
	e, matched, err := h.svc.CloseEpoch(epochID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"epoch": e, "matched_orders": matched})
}

// ListEpochsHandler GET /api/trades/epochs?asset_id=
func (h *Handler) ListEpochsHandler(c *gin.Context) {
	assetID, err := uuid.Parse(c.Query("asset_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset_id"})
		return
	}
	epochs, err := h.svc.ListEpochs(assetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": epochs})
}
`;
  hc = hc.trimEnd() + "\n" + add;
  fs.writeFileSync(hp, hc, "utf8");
  console.log("epoch handlers added");
}

// ===== main.go 路由 =====
const mp = "C:/Users/Administrator/Desktop/rwa-exchange/backend/cmd/api/main.go";
let mc = fs.readFileSync(mp, "utf8");
if (!mc.includes("/epochs")) {
  const needle = '		trades.GET("/orders", tradeHandler.ListOrders)';
  const add = '		trades.GET("/orders", tradeHandler.ListOrders)\n		trades.POST("/epochs", tradeHandler.CreateEpochHandler)\n		trades.POST("/epochs/:id/close", tradeHandler.CloseEpochHandler)\n		trades.GET("/epochs", tradeHandler.ListEpochsHandler)';
  if (mc.includes(needle)) {
    mc = mc.replace(needle, add);
    fs.writeFileSync(mp, mc, "utf8");
    console.log("epoch routes added");
  } else {
    console.log("ROUTE NEEDLE NOT FOUND");
  }
}
console.log("done");