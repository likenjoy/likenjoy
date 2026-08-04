package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"rwa-exchange/internal/asset"
	"rwa-exchange/internal/blockchain"
	"rwa-exchange/internal/dividend"
	"rwa-exchange/internal/kyc"
	"rwa-exchange/internal/middleware"
	"rwa-exchange/internal/redeem"
	"rwa-exchange/internal/relay"
	"rwa-exchange/internal/revenue"
	"rwa-exchange/internal/trade"
	"rwa-exchange/internal/user"
	"rwa-exchange/pkg/compliance"
	"rwa-exchange/pkg/database"

	"github.com/ethereum/go-ethereum/common"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ContractsConfig 合约地址配置
type ContractsConfig struct {
	IdentityRegistry string `json:"identityRegistry"`
	ComplianceModule string `json:"complianceModule"`
	RWAToken         string `json:"rwaToken"`
	Forwarder        string `json:"forwarder"`
	AssetID          string `json:"assetId"`
}

func loadContracts(path string) (*ContractsConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg ContractsConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

// corsMiddleware 处理跨域请求
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func main() {
	// 获取可执行文件所在目录
	exePath, err := os.Executable()
	if err != nil {
		log.Fatalf("Failed to get executable path: %v", err)
	}
	exeDir := filepath.Dir(exePath)

	// go run 时 os.Executable() 指向临时构建目录，回退到当前工作目录查找配置与数据库
	cwd, _ := os.Getwd()
	if _, err := os.Stat(filepath.Join(exeDir, "contracts.json")); err != nil {
		if _, err2 := os.Stat(filepath.Join(cwd, "contracts.json")); err2 == nil {
			exeDir = cwd
		}
	}

	dbPath := filepath.Join(exeDir, "rwa_exchange.db")
	db, err := database.NewSQLite(dbPath)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := database.MigrateSQLite(db); err != nil {
		log.Fatalf("Failed to migrate: %v", err)
	}

	// 加载合约地址
	contractsPath := filepath.Join(exeDir, "contracts.json")
	contracts, err := loadContracts(contractsPath)
	if err != nil {
		log.Printf("WARNING: Failed to load contracts.json: %v (blockchain features disabled)", err)
		contracts = nil
	}

	// 初始化区块链客户端
	var bcClient *blockchain.Client
	if contracts != nil {
		rpcURL := os.Getenv("ETH_RPC_URL")
		if rpcURL == "" {
			rpcURL = "http://localhost:8545" // 默认 Hardhat 本地网络
		}
		chainID := int64(31337) // Hardhat 默认 chain ID

		privKey := os.Getenv("ETH_PRIVATE_KEY")
		// 支持从文件加载私钥（KMS 挂载/密钥文件场景）
		if privKey == "" {
			if kf := os.Getenv("ETH_PRIVATE_KEY_FILE"); kf != "" {
				if kb, err := os.ReadFile(kf); err == nil {
					privKey = strings.TrimSpace(string(kb))
				} else {
					log.Printf("WARNING: cannot read ETH_PRIVATE_KEY_FILE %s: %v", kf, err)
				}
			}
		}
		// 安全加固：默认开发私钥仅在显式允许时使用；生产必须通过环境变量/文件注入
		if privKey == "" {
			if os.Getenv("ALLOW_DEV_PRIVATE_KEY") == "true" {
				privKey = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
				log.Println("WARNING: using HARDHAT DEV private key (ALLOW_DEV_PRIVATE_KEY=true) - NEVER use in production")
			} else {
				log.Println("WARNING: ETH_PRIVATE_KEY not set - blockchain features disabled (production must inject key)")
				bcClient = nil
				contracts = nil
			}
		}
		if privKey != "" {
			privKey = strings.TrimPrefix(privKey, "0x")
		}

		bcClient, err = blockchain.NewClient(blockchain.Config{
			RPCURL:     rpcURL,
			ChainID:    chainID,
			PrivateKey: privKey,
		})
		if err != nil {
			log.Printf("WARNING: Failed to connect to blockchain: %v (blockchain features disabled)", err)
			bcClient = nil
		} else {
			log.Printf("Blockchain client connected to %s (chain=%d)", rpcURL, chainID)
			log.Printf("  Signer (platform): %s", bcClient.Signer().Address().Hex())
			log.Printf("  IdentityRegistry: %s", contracts.IdentityRegistry)
			log.Printf("  ComplianceModule: %s", contracts.ComplianceModule)
			log.Printf("  RWAToken: %s", contracts.RWAToken)
		}
	}

	// JWT 密钥：必须通过环境变量注入；拒绝默认/空值（防止硬编码密钥伪造 admin token）
	// 必须在 userHandler（签发侧）和 AuthMiddleware（验证侧）之前解析，保证两侧一致
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" || jwtSecret == "change-me-in-production" {
		if os.Getenv("ALLOW_DEV_SECRET") == "true" {
			jwtSecret = "change-me-in-production"
			log.Println("WARNING: using INSECURE default JWT secret (ALLOW_DEV_SECRET=true) - NEVER use in production")
		} else {
			log.Fatalf("FATAL: JWT_SECRET must be set to a strong random value (e.g. openssl rand -hex 32). Refusing to start with default secret.")
		}
	}

	// 初始化各模块
	userRepo := user.NewRepository(db)
	userSvc := user.NewService(userRepo)
	userHandler := user.NewHandler(userSvc, jwtSecret)

	kycRepo := kyc.NewRepository(db)
	kycSvc := kyc.NewService(kycRepo)
	kycSvc.SetSanctions(compliance.NewSanctionsChecker("")) // 生产可传 OFAC 名单文件路径
	kycHandler := kyc.NewHandler(kycSvc)

	// 链上身份/白名单操作器（KYC 通过后自动注册投资者）
	if bcClient != nil && contracts != nil {
		identityOp := blockchain.NewIdentityOperator(bcClient)
		complianceOp := blockchain.NewComplianceOperator(bcClient)
		kycSvc.SetOnChainOps(identityOp, complianceOp,
			common.HexToAddress(contracts.IdentityRegistry),
			common.HexToAddress(contracts.ComplianceModule))
		log.Println("On-chain KYC operators injected (identity + whitelist)")
	}

	assetRepo := asset.NewRepository(db)
	assetSvc := asset.NewService(assetRepo)
	assetHandler := asset.NewHandler(assetSvc)

	tradeRepo := trade.NewRepository(db)
	tradeSvc := trade.NewService(tradeRepo)
	tradeHandler := trade.NewHandler(tradeSvc)

	dividendRepo := dividend.NewRepository(db)
	dividendSvc := dividend.NewService(dividendRepo)
	dividendHandler := dividend.NewHandler(dividendSvc)

	redeemRepo := redeem.NewRepository(db)
	redeemSvc := redeem.NewService(redeemRepo)
	redeemHandler := redeem.NewHandler(redeemSvc)

	revenueRepo := revenue.NewRepository(db)
	revenueSvc := revenue.NewService(revenueRepo)
	revenueHandler := revenue.NewHandler(revenueSvc)

	// EIP-2771 元交易中继（平台代付 gas）
	var relayHandler *relay.Handler
	if bcClient != nil && contracts != nil {
		relaySvc := relay.NewService(
			bcClient,
			common.HexToAddress(contracts.Forwarder),
			common.HexToAddress(contracts.RWAToken),
			revenueSvc,
		)
		relayHandler = relay.NewHandler(relaySvc)
		log.Println("EIP-2771 meta-transaction relayer enabled (forwarder: " + contracts.Forwarder + ")")
	}

	// 如果区块链客户端可用，注入到 asset handler
	if bcClient != nil {
		tokenOp := blockchain.NewTokenOperator(bcClient)
		tokenAddr := common.HexToAddress(contracts.RWAToken)
		assetHandler.SetBlockchain(tokenOp, tokenAddr)
		assetHandler.SetRevenue(revenueSvc)
		assetHandler.SetUserRepo(userRepo)
		log.Println("Blockchain operator injected into asset handler")
	}

	// JWT 密钥已在上方解析（签发/验证共用），此处只组装验证侧中间件
	authMW := middleware.AuthMiddleware(jwtSecret, func(uid string) (string, string, string, error) {
		id, err := uuid.Parse(uid)
		if err != nil {
			return "", "", "", err
		}
		u, err := userRepo.FindByID(id)
		if err != nil {
			return "", "", "", err
		}
		return string(u.Role), string(u.Status), u.WalletAddress, nil
	})
	adminMW := middleware.RoleMiddleware("admin", "compliance")

	r := gin.Default()

	// CORS 中间件必须在所有路由之前
	r.Use(corsMiddleware())

	// 敏感接口限流：登录/注册 60 次/分钟/IP（防暴力破解与撞库；
	// 防爆破核心是失败锁定，总次数阈值给合法客户端与自动化测试留余量）
	loginLimiter := middleware.NewRateLimiter(60*1e9, 60) // 1 分钟窗口
	api := r.Group("/api")

	auth := api.Group("/auth")
	auth.Use(middleware.RateLimitMiddleware(loginLimiter))
	{
		auth.POST("/register", userHandler.Register)
		auth.POST("/login", userHandler.Login)
	}

	protected := api.Group("")
	protected.Use(authMW)
	{
		protected.GET("/portfolio", assetHandler.ListPortfolio)
		protected.GET("/fees", revenueHandler.GetFees)
		protected.POST("/auth/bind-wallet", userHandler.BindWallet)

		if relayHandler != nil {
			protected.POST("/relay/execute", relayHandler.Execute)
		}

		protected.POST("/kyc/submit", kycHandler.Submit)
		protected.GET("/kyc/status/:user_id", kycHandler.GetStatus)
		protected.GET("/kyc/accreditation/:user_id", kycHandler.GetAccreditation)
		protected.POST("/kyc/documents", kycHandler.UploadDocument)

		// /assets (list all) must be before /assets/:id to avoid route conflict
		protected.GET("/assets", assetHandler.ListAllAssets)
		protected.POST("/assets", middleware.RoleMiddleware("issuer", "admin"), assetHandler.CreateAsset)
		protected.GET("/assets/live", assetHandler.ListLiveAssets)
		protected.GET("/assets/issuer", assetHandler.ListIssuerAssets)
		protected.GET("/assets/:id", assetHandler.GetAsset)
		protected.POST("/assets/:id/submit", middleware.RoleMiddleware("issuer", "admin"), assetHandler.SubmitForReview)
		protected.POST("/assets/:id/start-issuance", middleware.RoleMiddleware("issuer", "admin"), assetHandler.StartIssuance)
		protected.POST("/assets/:id/go-live", middleware.RoleMiddleware("issuer", "admin"), assetHandler.GoLive)
		protected.POST("/assets/:id/documents", middleware.RoleMiddleware("issuer", "admin"), assetHandler.AddDocument)
		protected.GET("/assets/:id/rounds", assetHandler.GetRounds)

		protected.POST("/trades/orders", tradeHandler.PlaceOrder)
		protected.GET("/trades/orders/:id", tradeHandler.GetOrder)
		protected.GET("/trades/orders", tradeHandler.ListUserOrders)
		protected.POST("/trades/orders/:id/cancel", tradeHandler.CancelOrder)
		protected.GET("/trades/asset/:id", tradeHandler.ListAssetTrades)
		protected.GET("/trades/history", tradeHandler.ListUserTrades)

		protected.POST("/assets/:id/dividends/plans", middleware.RoleMiddleware("issuer", "admin"), dividendHandler.CreatePlan)
		protected.GET("/assets/:id/dividends/plans", dividendHandler.GetPlansByAsset)
		protected.GET("/dividends/plans/:plan_id", dividendHandler.GetPlan)
		protected.POST("/dividends/plans/:plan_id/pay", dividendHandler.PayDividend)
		protected.POST("/dividends/plans/:plan_id/accrue", dividendHandler.AccrueInterest)
		protected.GET("/dividends/users/:user_id/records", dividendHandler.GetUserRecords)
		protected.GET("/dividends/plans/:plan_id/accruals/:user_id", dividendHandler.GetUserAccrual)

		protected.POST("/redeems/calculate", redeemHandler.CalculateRedeem)
		protected.POST("/redeems/requests", redeemHandler.SubmitRequest)
		protected.GET("/redeems/requests/:request_id", redeemHandler.GetRequest)
		protected.GET("/redeems/users/:user_id/requests", redeemHandler.GetUserRequests)
		protected.GET("/redeems/rules/:id", redeemHandler.GetRule)
	}

	admin := api.Group("/admin")
	admin.Use(authMW, adminMW)
	{
		admin.POST("/kyc/review", kycHandler.Review)
		admin.GET("/kyc/pending", kycHandler.ListPending)
		admin.GET("/users", userHandler.ListUsers)
		admin.POST("/assets/:id/approve", assetHandler.Approve)
		admin.POST("/assets/:id/reject", assetHandler.Reject)
		admin.POST("/trades/orders/:id/match", tradeHandler.MatchOrder)
		admin.POST("/trades/whitelist", tradeHandler.AddToWhitelist)
		admin.DELETE("/trades/whitelist", tradeHandler.RemoveFromWhitelist)

		admin.POST("/redeems/:request_id/approve", redeemHandler.ApproveRequest)
		admin.POST("/redeems/:request_id/reject", redeemHandler.RejectRequest)
		admin.POST("/redeems/:request_id/complete", redeemHandler.CompleteRequest)
		admin.POST("/redeems/:request_id/ship", redeemHandler.ShipPhysical)
		admin.POST("/redeems/rules", redeemHandler.UpsertRule)
		admin.GET("/redeems/pending", redeemHandler.GetPendingRequests)

		admin.GET("/fees", revenueHandler.GetFees)
		admin.PUT("/fees", revenueHandler.UpdateFees)
		admin.GET("/revenue", revenueHandler.ListRevenue)
		admin.GET("/gas", revenueHandler.ListGas)
		admin.GET("/audit", revenueHandler.ListAudit)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("RWA Exchange API starting on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
