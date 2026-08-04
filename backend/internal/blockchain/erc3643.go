package blockchain

import (
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
)

// ERC3643ABI ERC-3643 代币合约 ABI
const ERC3643TokenABI = `[
	{"type":"function","name":"name","inputs":[],"outputs":[{"type":"string"}],"stateMutability":"view"},
	{"type":"function","name":"symbol","inputs":[],"outputs":[{"type":"string"}],"stateMutability":"view"},
	{"type":"function","name":"decimals","inputs":[],"outputs":[{"type":"uint8"}],"stateMutability":"view"},
	{"type":"function","name":"totalSupply","inputs":[],"outputs":[{"type":"uint256"}],"stateMutability":"view"},
	{"type":"function","name":"balanceOf","inputs":[{"type":"address"}],"outputs":[{"type":"uint256"}],"stateMutability":"view"},
	{"type":"function","name":"assetId","inputs":[],"outputs":[{"type":"bytes32"}],"stateMutability":"view"},
	{"type":"function","name":"nav","inputs":[],"outputs":[{"type":"uint256"}],"stateMutability":"view"},
	{"type":"function","name":"owner","inputs":[],"outputs":[{"type":"address"}],"stateMutability":"view"},
	{"type":"function","name":"identityRegistry","inputs":[],"outputs":[{"type":"address"}],"stateMutability":"view"},
	{"type":"function","name":"complianceModule","inputs":[],"outputs":[{"type":"address"}],"stateMutability":"view"},
	{"type":"function","name":"mint","inputs":[{"type":"address","name":"to"},{"type":"uint256","name":"amount"},{"type":"bytes32","name":"assetId"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"burn","inputs":[{"type":"address","name":"from"},{"type":"uint256","name":"amount"},{"type":"string","name":"reason"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"forcedTransfer","inputs":[{"type":"address","name":"from"},{"type":"address","name":"to"},{"type":"uint256","name":"amount"},{"type":"string","name":"reason"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"updateNAV","inputs":[{"type":"uint256","name":"newNAV"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"distributeDividends","inputs":[{"type":"address","name":"token"},{"type":"uint256","name":"totalAmount"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"pause","inputs":[],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"unpause","inputs":[],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"paused","inputs":[],"outputs":[{"type":"bool"}],"stateMutability":"view"},
	{"type":"function","name":"addAgent","inputs":[{"type":"address","name":"agent"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"removeAgent","inputs":[{"type":"address","name":"agent"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"isAgent","inputs":[{"type":"address","name":"account"}],"outputs":[{"type":"bool"}],"stateMutability":"view"},
	{"type":"function","name":"transferOwnership","inputs":[{"type":"address","name":"newOwner"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"event","name":"Transfer","inputs":[{"type":"address","name":"from","indexed":true},{"type":"address","name":"to","indexed":true},{"type":"uint256","name":"amount","indexed":false}],"anonymous":false},
	{"type":"event","name":"TokenMinted","inputs":[{"type":"address","name":"to","indexed":true},{"type":"uint256","name":"amount","indexed":false},{"type":"bytes32","name":"assetId","indexed":true}],"anonymous":false},
	{"type":"event","name":"TokenBurned","inputs":[{"type":"address","name":"from","indexed":true},{"type":"uint256","name":"amount","indexed":false},{"type":"string","name":"reason","indexed":false}],"anonymous":false},
	{"type":"event","name":"ForcedTransfer","inputs":[{"type":"address","name":"from","indexed":true},{"type":"address","name":"to","indexed":true},{"type":"uint256","name":"amount","indexed":false},{"type":"string","name":"reason","indexed":false}],"anonymous":false},
	{"type":"event","name":"NAVUpdated","inputs":[{"type":"uint256","name":"oldNAV","indexed":false},{"type":"uint256","name":"newNAV","indexed":false},{"type":"uint256","name":"timestamp","indexed":false}],"anonymous":false},
	{"type":"event","name":"DividendDistributed","inputs":[{"type":"uint256","name":"totalAmount","indexed":false},{"type":"uint256","name":"timestamp","indexed":false}],"anonymous":false},
	{"type":"event","name":"Paused","inputs":[{"type":"address","name":"by","indexed":true}],"anonymous":false},
	{"type":"event","name":"Unpaused","inputs":[{"type":"address","name":"by","indexed":true}],"anonymous":false}
]`

// IdentityRegistryABI 身份注册表 ABI
const IdentityRegistryABI = `[
	{"type":"function","name":"isVerified","inputs":[{"type":"address"}],"outputs":[{"type":"bool"}],"stateMutability":"view"},
	{"type":"function","name":"investorCountry","inputs":[{"type":"address"}],"outputs":[{"type":"uint16"}],"stateMutability":"view"},
	{"type":"function","name":"identityHash","inputs":[{"type":"address"}],"outputs":[{"type":"bytes32"}],"stateMutability":"view"},
	{"type":"function","name":"registerIdentity","inputs":[{"type":"address","name":"investor"},{"type":"bytes32","name":"identityHash"},{"type":"uint16","name":"countryCode"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"updateIdentity","inputs":[{"type":"address","name":"investor"},{"type":"bytes32","name":"identityHash"},{"type":"uint16","name":"countryCode"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"removeIdentity","inputs":[{"type":"address","name":"investor"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"event","name":"IdentityRegistered","inputs":[{"type":"address","name":"investor","indexed":true},{"type":"bytes32","name":"identityHash","indexed":false},{"type":"uint16","name":"countryCode","indexed":false}],"anonymous":false},
	{"type":"event","name":"IdentityUpdated","inputs":[{"type":"address","name":"investor","indexed":true},{"type":"bytes32","name":"newIdentityHash","indexed":false},{"type":"uint16","name":"newCountryCode","indexed":false}],"anonymous":false},
	{"type":"event","name":"IdentityRemoved","inputs":[{"type":"address","name":"investor","indexed":true}],"anonymous":false}
]`

// ComplianceModuleABI 合规模块 ABI
const ComplianceModuleABI = `[
	{"type":"function","name":"canTransfer","inputs":[{"type":"address","name":"from"},{"type":"address","name":"to"},{"type":"uint256","name":"amount"}],"outputs":[{"type":"bool","name":"allowed"},{"type":"string","name":"reason"}],"stateMutability":"view"},
	{"type":"function","name":"isWhitelisted","inputs":[{"type":"address","name":"investor"}],"outputs":[{"type":"bool"}],"stateMutability":"view"},
	{"type":"function","name":"maxHolding","inputs":[{"type":"address","name":"investor"}],"outputs":[{"type":"uint256"}],"stateMutability":"view"},
	{"type":"function","name":"lockupEnd","inputs":[{"type":"address","name":"investor"}],"outputs":[{"type":"uint256"}],"stateMutability":"view"},
	{"type":"function","name":"addToWhitelist","inputs":[{"type":"address","name":"investor"},{"type":"uint256","name":"maxHold"},{"type":"uint256","name":"lockupEndTime"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"removeFromWhitelist","inputs":[{"type":"address","name":"investor"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"setMaxHolding","inputs":[{"type":"address","name":"investor"},{"type":"uint256","name":"maxHold"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"setLockupEnd","inputs":[{"type":"address","name":"investor"},{"type":"uint256","name":"lockupEndTime"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"function","name":"isCountryRestricted","inputs":[{"type":"uint16","name":"countryCode"}],"outputs":[{"type":"bool"}],"stateMutability":"view"},
	{"type":"function","name":"setRestrictedCountry","inputs":[{"type":"uint16","name":"countryCode"},{"type":"bool","name":"restricted"}],"outputs":[],"stateMutability":"nonpayable"},
	{"type":"event","name":"CountryRestrictionSet","inputs":[{"type":"uint16","name":"countryCode","indexed":true},{"type":"bool","name":"restricted","indexed":false}],"anonymous":false}
]`

// TrustedForwarderABI EIP-2771 元交易转发器 ABI
const TrustedForwarderABI = `[
	{"type":"function","name":"execute","inputs":[{"type":"tuple","components":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"gas","type":"uint256"},{"internalType":"uint48","name":"deadline","type":"uint48"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"request"}],"outputs":[],"stateMutability":"payable"},
	{"type":"function","name":"nonces","inputs":[{"internalType":"address","name":"owner","type":"address"}],"outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view"},
	{"type":"function","name":"verify","inputs":[{"type":"tuple","components":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"gas","type":"uint256"},{"internalType":"uint48","name":"deadline","type":"uint48"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"request"}],"outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view"},
	{"type":"event","name":"ExecutedForwardRequest","inputs":[{"internalType":"address","name":"signer","type":"address","indexed":true},{"internalType":"uint256","name":"nonce","type":"uint256","indexed":false},{"internalType":"bool","name":"success","type":"bool","indexed":false}],"anonymous":false}
]`

// ParseABI 解析ABI字符串
func ParseABI(abiStr string) (abi.ABI, error) {
	parsed, err := abi.JSON(strings.NewReader(abiStr))
	if err != nil {
		return abi.ABI{}, fmt.Errorf("parse abi: %w", err)
	}
	return parsed, nil
}

// MustParseABI 解析ABI，失败时panic
func MustParseABI(abiStr string) abi.ABI {
	parsed, err := ParseABI(abiStr)
	if err != nil {
		panic(fmt.Sprintf("parse abi: %v", err))
	}
	return parsed
}

// TokenABI 返回ERC-3643代币ABI
func TokenABI() abi.ABI { return MustParseABI(ERC3643TokenABI) }

// IdentityABI 返回身份注册表ABI
func IdentityABI() abi.ABI { return MustParseABI(IdentityRegistryABI) }

// ComplianceABI 返回合规模块ABI
func ComplianceABI() abi.ABI { return MustParseABI(ComplianceModuleABI) }

// ForwarderABI 返回元交易转发器ABI
func ForwarderABI() abi.ABI { return MustParseABI(TrustedForwarderABI) }

// TokenInfo 代币基本信息
type TokenInfo struct {
	Name     string
	Symbol   string
	Decimals uint8
	Supply   *big.Int
	AssetID  [32]byte
	NAV      *big.Int
}

// GetTokenInfo 获取代币基本信息（只读）
// 注意：需要实际的eth_call实现，此处为骨架
func GetTokenInfo(client *Client, tokenAddr common.Address) (*TokenInfo, error) {
	tokenABI := TokenABI()

	// 批量调用只读方法
	calls := []struct {
		method string
		args   []interface{}
	}{
		{"name", nil},
		{"symbol", nil},
		{"decimals", nil},
		{"totalSupply", nil},
		{"assetId", nil},
		{"nav", nil},
	}

	for _, call := range calls {
		data, err := tokenABI.Pack(call.method, call.args...)
		if err != nil {
			return nil, fmt.Errorf("pack %s: %w", call.method, err)
		}
		// TODO: 实际的eth_call实现
		_ = data
	}

	return &TokenInfo{}, nil
}
