package compliance

import (
	"log"
	"strings"
)

// SanctionsChecker 制裁名单筛查（本地名单，生产可替换为完整 OFAC SDN / 联合国名单）
type SanctionsChecker struct {
	names map[string]bool // 全小写去空格后的姓名集合
}

// 内置示例名单（公开案例，生产请替换为最新完整名单：
//  美国 OFAC SDN: https://www.treasury.gov/ofac/downloads/sdn.csv
//  联合国安理会综合名单: https://scsanctions.un.org/resources/xml/en/consolidated.xml
var builtinSanctions = []string{
	"bin laden",
	"osama bin laden",
	"al qaeda",
	"isis",
	"kim jong un",
	"bashar al assad",
	"mohammad reza zahedi",
}

// NewSanctionsChecker 创建检查器（内置名单 + 可选外部文件）
func NewSanctionsChecker(extraFile string) *SanctionsChecker {
	c := &SanctionsChecker{names: map[string]bool{}}
	for _, n := range builtinSanctions {
		c.names[normalize(n)] = true
	}
	if extraFile != "" {
		if lines, err := loadLines(extraFile); err == nil {
			for _, l := range lines {
				l = strings.TrimSpace(l)
				if l != "" && !strings.HasPrefix(l, "#") {
					c.names[normalize(l)] = true
				}
			}
			log.Printf("[compliance] sanctions list loaded: %d entries", len(lines))
		} else {
			log.Printf("[compliance] WARNING: cannot load sanctions file %s: %v", extraFile, err)
		}
	}
	return c
}

// Check 检查姓名是否命中制裁名单。返回 (是否命中, 命中条目)
func (c *SanctionsChecker) Check(fullName string) (bool, string) {
	if c == nil {
		return false, ""
	}
	norm := normalize(fullName)
	if norm == "" {
		return false, ""
	}
	// 精确匹配
	if c.names[norm] {
		return true, norm
	}
	// 包含匹配（名单条目作为全名的一部分）
	for entry := range c.names {
		if strings.Contains(norm, entry) || strings.Contains(entry, norm) {
			return true, entry
		}
	}
	return false, ""
}

func normalize(s string) string {
	s = strings.ToLower(s)
	// 去空格与常见变体
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "-", "")
	s = strings.ReplaceAll(s, "_", "")
	return s
}

func loadLines(path string) ([]string, error) {
	data, err := readFile(path)
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(data), "\n")
	return lines, nil
}
