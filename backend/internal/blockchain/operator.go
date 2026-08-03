package blockchain

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

// TokenOperator ERC-3643代币操作器
type TokenOperator struct {
	client   *Client
	tokenABI string
}

// NewTokenOperator 创建代币操作器
func NewTokenOperator(client *Client) *TokenOperator {
	return &TokenOperator{
		client:   client,
		tokenABI: ERC3643TokenABI,
	}
}

// Client 返回底层区块链客户端
func (op *TokenOperator) Client() *Client {
	return op.client
}

// Mint 发行代币
func (op *TokenOperator) Mint(ctx context.Context, tokenAddr, to common.Address, amount *big.Int, assetID [32]byte) (*types.Transaction, error) {
	abi := TokenABI()
	data, err := abi.Pack("mint", to, amount, assetID)
	if err != nil {
		return nil, fmt.Errorf("pack mint: %w", err)
	}
	return op.sendTransaction(ctx, tokenAddr, data)
}

// BalanceOf 查询账户代币余额（wei）
func (op *TokenOperator) BalanceOf(ctx context.Context, tokenAddr, account common.Address) (*big.Int, error) {
	abi := TokenABI()
	data, err := abi.Pack("balanceOf", account)
	if err != nil {
		return nil, fmt.Errorf("pack balanceOf: %w", err)
	}
	out, err := op.client.ETHClient().CallContract(ctx, ethereum.CallMsg{To: &tokenAddr, Data: data}, nil)
	if err != nil {
		return nil, fmt.Errorf("call balanceOf: %w", err)
	}
	return new(big.Int).SetBytes(out), nil
}

// Burn 销毁代币（赎回）
func (op *TokenOperator) Burn(ctx context.Context, tokenAddr, from common.Address, amount *big.Int, reason string) (*types.Transaction, error) {
	abi := TokenABI()
	data, err := abi.Pack("burn", from, amount, reason)
	if err != nil {
		return nil, fmt.Errorf("pack burn: %w", err)
	}
	return op.sendTransaction(ctx, tokenAddr, data)
}

// ForcedTransfer 强制转账
func (op *TokenOperator) ForcedTransfer(ctx context.Context, tokenAddr, from, to common.Address, amount *big.Int, reason string) (*types.Transaction, error) {
	abi := TokenABI()
	data, err := abi.Pack("forcedTransfer", from, to, amount, reason)
	if err != nil {
		return nil, fmt.Errorf("pack forcedTransfer: %w", err)
	}
	return op.sendTransaction(ctx, tokenAddr, data)
}

// UpdateNAV 更新资产净值
func (op *TokenOperator) UpdateNAV(ctx context.Context, tokenAddr common.Address, newNAV *big.Int) (*types.Transaction, error) {
	abi := TokenABI()
	data, err := abi.Pack("updateNAV", newNAV)
	if err != nil {
		return nil, fmt.Errorf("pack updateNAV: %w", err)
	}
	return op.sendTransaction(ctx, tokenAddr, data)
}

// DistributeDividends 分红发放
func (op *TokenOperator) DistributeDividends(ctx context.Context, tokenAddr, dividendToken common.Address, totalAmount *big.Int) (*types.Transaction, error) {
	abi := TokenABI()
	data, err := abi.Pack("distributeDividends", dividendToken, totalAmount)
	if err != nil {
		return nil, fmt.Errorf("pack distributeDividends: %w", err)
	}
	return op.sendTransaction(ctx, tokenAddr, data)
}

// IdentityOperator 身份注册表操作器
type IdentityOperator struct {
	client *Client
}

// NewIdentityOperator 创建身份操作器
func NewIdentityOperator(client *Client) *IdentityOperator {
	return &IdentityOperator{client: client}
}

// RegisterIdentity 注册链上身份
// IsVerified 查询地址是否已注册链上身份
func (op *IdentityOperator) IsVerified(ctx context.Context, registryAddr, investor common.Address) (bool, error) {
	abi := IdentityABI()
	data, err := abi.Pack("isVerified", investor)
	if err != nil {
		return false, fmt.Errorf("pack isVerified: %w", err)
	}
	out, err := op.client.ETHClient().CallContract(ctx, ethereum.CallMsg{To: &registryAddr, Data: data}, nil)
	if err != nil {
		return false, fmt.Errorf("call isVerified: %w", err)
	}
	return new(big.Int).SetBytes(out).Sign() == 1, nil
}

// Client 返回底层区块链客户端
func (op *IdentityOperator) Client() *Client {
	return op.client
}

func (op *IdentityOperator) RegisterIdentity(ctx context.Context, registryAddr, investor common.Address, identityHash [32]byte, countryCode uint16) (*types.Transaction, error) {
	abi := IdentityABI()
	data, err := abi.Pack("registerIdentity", investor, identityHash, countryCode)
	if err != nil {
		return nil, fmt.Errorf("pack registerIdentity: %w", err)
	}
	return op.sendTransaction(ctx, registryAddr, data)
}

// RemoveIdentity 移除链上身份
func (op *IdentityOperator) RemoveIdentity(ctx context.Context, registryAddr, investor common.Address) (*types.Transaction, error) {
	abi := IdentityABI()
	data, err := abi.Pack("removeIdentity", investor)
	if err != nil {
		return nil, fmt.Errorf("pack removeIdentity: %w", err)
	}
	return op.sendTransaction(ctx, registryAddr, data)
}

// ComplianceOperator 合规模块操作器
type ComplianceOperator struct {
	client *Client
}

// NewComplianceOperator 创建合规操作器
func NewComplianceOperator(client *Client) *ComplianceOperator {
	return &ComplianceOperator{client: client}
}

// AddToWhitelist 添加白名单
// IsWhitelisted 查询地址是否已加入白名单
func (op *ComplianceOperator) IsWhitelisted(ctx context.Context, complianceAddr, investor common.Address) (bool, error) {
	abi := ComplianceABI()
	data, err := abi.Pack("isWhitelisted", investor)
	if err != nil {
		return false, fmt.Errorf("pack isWhitelisted: %w", err)
	}
	out, err := op.client.ETHClient().CallContract(ctx, ethereum.CallMsg{To: &complianceAddr, Data: data}, nil)
	if err != nil {
		return false, fmt.Errorf("call isWhitelisted: %w", err)
	}
	return new(big.Int).SetBytes(out).Sign() == 1, nil
}

// Client 返回底层区块链客户端
func (op *ComplianceOperator) Client() *Client {
	return op.client
}

func (op *ComplianceOperator) AddToWhitelist(ctx context.Context, complianceAddr, investor common.Address, maxHold *big.Int, lockupEnd uint64) (*types.Transaction, error) {
	abi := ComplianceABI()
	data, err := abi.Pack("addToWhitelist", investor, maxHold, big.NewInt(int64(lockupEnd)))
	if err != nil {
		return nil, fmt.Errorf("pack addToWhitelist: %w", err)
	}
	return op.sendTransaction(ctx, complianceAddr, data)
}

// RemoveFromWhitelist 移除白名单
func (op *ComplianceOperator) RemoveFromWhitelist(ctx context.Context, complianceAddr, investor common.Address) (*types.Transaction, error) {
	abi := ComplianceABI()
	data, err := abi.Pack("removeFromWhitelist", investor)
	if err != nil {
		return nil, fmt.Errorf("pack removeFromWhitelist: %w", err)
	}
	return op.sendTransaction(ctx, complianceAddr, data)
}

// sendTransaction 发送交易（通用）
func (op *TokenOperator) sendTransaction(ctx context.Context, contractAddr common.Address, data []byte) (*types.Transaction, error) {
	eth := op.client.ETHClient()
	signer := op.client.Signer()
	chainID := op.client.ChainID()

	nonce, err := eth.PendingNonceAt(ctx, signer.Address())
	if err != nil {
		return nil, fmt.Errorf("get nonce: %w", err)
	}

	gasPrice, err := eth.SuggestGasPrice(ctx)
	if err != nil {
		return nil, fmt.Errorf("get gas price: %w", err)
	}

	tx := types.NewTx(&types.LegacyTx{
		Nonce:    nonce,
		To:       &contractAddr,
		Value:    big.NewInt(0),
		Gas:      300000,
		GasPrice: gasPrice,
		Data:     data,
	})

	signedTx, err := types.SignTx(tx, types.LatestSignerForChainID(chainID), signer.PrivateKey())
	if err != nil {
		return nil, fmt.Errorf("sign tx: %w", err)
	}

	err = eth.SendTransaction(ctx, signedTx)
	if err != nil {
		return nil, fmt.Errorf("send tx: %w", err)
	}

	return signedTx, nil
}

func (op *IdentityOperator) sendTransaction(ctx context.Context, contractAddr common.Address, data []byte) (*types.Transaction, error) {
	tmp := &TokenOperator{client: op.client}
	return tmp.sendTransaction(ctx, contractAddr, data)
}

func (op *ComplianceOperator) sendTransaction(ctx context.Context, contractAddr common.Address, data []byte) (*types.Transaction, error) {
	tmp := &TokenOperator{client: op.client}
	return tmp.sendTransaction(ctx, contractAddr, data)
}

// WaitMined 等待交易被打包
func WaitMined(ctx context.Context, client *Client, tx *types.Transaction) (*types.Receipt, error) {
	return bind.WaitMined(ctx, client.ETHClient(), tx)
}
