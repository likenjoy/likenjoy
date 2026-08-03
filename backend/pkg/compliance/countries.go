package compliance

import "strings"

// 禁止/受限国家（制裁与合规考虑）
// 生产环境按监管要求与业务司法辖区配置（如 OFAC 全面制裁国家清单）
var restrictedCountries = map[string]bool{
	"ir":  true, // 伊朗
	"kp":  true, // 朝鲜
	"cu":  true, // 古巴
	"sy":  true, // 叙利亚
	"ru":  true, // 俄罗斯（制裁相关，按政策）
	"by":  true, // 白俄罗斯
	"ve":  true, // 委内瑞拉
}

// CountryRestricted 检查国家代码（ISO 3166-1 alpha-2，小写）是否受限
func CountryRestricted(countryCode string) bool {
	return restrictedCountries[strings.ToLower(strings.TrimSpace(countryCode))]
}

// RestrictedCountryHint 返回受限国家提示
func RestrictedCountryHint() string {
	return "your country is restricted"
}
