package license

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// Tier 等级：community / pro / enterprise
type Tier string

const (
	TierCommunity  Tier = "community"
	TierPro        Tier = "pro"
	TierEnterprise Tier = "enterprise"
)

// Feature 功能点
const (
	FeatureTrading    = "trading"    // 交易（订单/Epoch）
	FeatureDividend   = "dividend"   // 分红
	FeatureAdmin      = "admin"      // 管理后台
	FeatureAdvertising = "advertising" // 广告系统
	FeatureSysConfig  = "sysconfig"  // 系统设置
	FeatureWhiteLabel = "whitelabel" // 白标（企业版）
	FeatureMultiTenant = "multitenant" // 多租户（企业版）
)

// tierFeatures 三级功能矩阵
var tierFeatures = map[Tier][]string{
	TierCommunity:  {},
	TierPro:        {FeatureTrading, FeatureDividend, FeatureAdmin, FeatureAdvertising, FeatureSysConfig},
	TierEnterprise: {FeatureTrading, FeatureDividend, FeatureAdmin, FeatureAdvertising, FeatureSysConfig, FeatureWhiteLabel, FeatureMultiTenant},
}

// Current 返回当前授权等级（从环境变量读取，默认 pro 便于演示）
func Current() Tier {
	t := Tier(strings.ToLower(strings.TrimSpace(os.Getenv("LICENSE_TIER"))))
	switch t {
	case TierCommunity, TierPro, TierEnterprise:
		return t
	default:
		return TierPro
	}
}

// HasFeature 当前等级是否含某功能
func HasFeature(feature string) bool {
	for _, f := range tierFeatures[Current()] {
		if f == feature {
			return true
		}
	}
	return false
}

// FeatureList 当前等级功能列表
func FeatureList() []string {
	return tierFeatures[Current()]
}

// RequireFeature 中间件：无权限返回 403
func RequireFeature(feature string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !HasFeature(feature) {
			c.JSON(http.StatusForbidden, gin.H{"error": "当前授权等级不包含此功能，请升级（LICENSE_TIER）"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// Handler GET /api/license
func Handler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"tier":     Current(),
		"features": FeatureList(),
		"tiers": gin.H{
			"community":  tierFeatures[TierCommunity],
			"pro":        tierFeatures[TierPro],
			"enterprise": tierFeatures[TierEnterprise],
		},
	})
}
