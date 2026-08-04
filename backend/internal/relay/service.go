package relay

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"time"

	"rwa-exchange/internal/blockchain"
	"rwa-exchange/internal/revenue"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/math"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
	"github.com/google/uuid"
)

// ForwardRequest EIP-2771 转发请求（与合约 ForwardRequestData 对应）
type ForwardRequest struct {
	From      string `json:"from"`
	To        string `json:"to"`
	Value     string `json:"value"`     // uint256 decimal 字符串
	Gas       uint64 `json:"gas"`
	Nonce     uint64 `json:"nonce"`
	Deadline  uint64 `json:"deadline"`
	Data      string `json:"data"`      // hex（0x 前缀）
	Signature string `json:"signature"` // hex 65 bytes（ethers v6 输出）
}

// Service EIP-2771 元交易中继服务（平台代付 gas）
// 安全要点（安全架构师）：
//  1. from 必须等于登录用户绑定的钱包（防替他人代付滥用）
//  2. to 必须在平台白名单（防转发到任意地址执行任意代码）
//  3. value 必须为 0（MVP 不允许经 forwarder 转移原生资产）
//  4. EIP-712 验签：恢复出的签名者必须等于 from
//  5. nonce 与链上一致（防重放）；deadline 未过期
type Service struct {
	client        *blockchain.Client
	forwarderAddr common.Address
	allowedTarget common.Address // 白名单目标（当前仅 RWAToken）
	revenue       *revenue.Service
}

func NewService(client *blockchain.Client, forwarderAddr, allowedTarget common.Address, rev *revenue.Service) *Service {
	return &Service{
		client:        client,
		forwarderAddr: forwarderAddr,
		allowedTarget: allowedTarget,
		revenue:       rev,
	}
}

// Execute 校验并转发元交易，返回 tx hash
func (s *Service) Execute(ctx context.Context, req *ForwardRequest, boundWallet string, userID uuid.UUID) (string, error) {
	// 1. from 必须等于用户绑定钱包
	if !common.IsHexAddress(req.From) {
		return "", errors.New("invalid from address")
	}
	fromAddr := common.HexToAddress(req.From)
	if !strings.EqualFold(fromAddr.Hex(), boundWallet) {
		return "", errors.New("from must match your bound wallet")
	}

	// 2. to 白名单
	if !common.IsHexAddress(req.To) {
		return "", errors.New("invalid to address")
	}
	toAddr := common.HexToAddress(req.To)
	if toAddr != s.allowedTarget {
		return "", fmt.Errorf("target not allowed: %s", req.To)
	}

	// 3. value 必须为 0（MVP：forwarder 仅用于无值调用）
	value, ok := new(big.Int).SetString(req.Value, 10)
	if !ok || value.Sign() != 0 {
		return "", errors.New("value must be 0")
	}

	// 4. deadline 未过期（本地预检，链上还会再校验）
	if req.Deadline < uint64(time.Now().Unix()) {
		return "", errors.New("request expired")
	}

	// 5. nonce 与链上一致（防重放）
	onChainNonce, err := s.nonceOf(ctx, fromAddr)
	if err != nil {
		return "", fmt.Errorf("read nonce: %w", err)
	}
	if req.Nonce != onChainNonce {
		return "", fmt.Errorf("invalid nonce: expected %d got %d", onChainNonce, req.Nonce)
	}

	// 6. EIP-712 验签
	signer, err := s.recoverSigner(req)
	if err != nil {
		return "", fmt.Errorf("verify signature: %w", err)
	}
	if signer != fromAddr {
		return "", errors.New("signature does not match from")
	}

	// 7. 转发（平台账户支付 gas）
	tx, err := s.executeForward(ctx, req)
	if err != nil {
		return "", fmt.Errorf("execute forward: %w", err)
	}

	// 8. gas 记账（审计留痕）
	_ = s.revenue.RecordGas(&revenue.GasRecord{
		ID:          uuid.New(),
		TxHash:      tx.Hash().Hex(),
		ChainID:     s.client.ChainID().Int64(),
		Action:      "meta_tx_relay",
		UserID:      userID.String(),
		GasUsedWei:  "0", // 实际用量由事件监听器/回执补记
		GasPriceWei: tx.GasPrice().String(),
		CostWei:     new(big.Int).Mul(big.NewInt(int64(tx.Gas())), tx.GasPrice()).String(),
		CreatedAt:   time.Now(),
	})

	return tx.Hash().Hex(), nil
}

// recoverSigner 恢复 EIP-712 签名者（与 OZ ERC2771Forwarder 域一致）
func (s *Service) recoverSigner(req *ForwardRequest) (common.Address, error) {
	typedData := apitypes.TypedData{
		Types: apitypes.Types{
			"EIP712Domain": []apitypes.Type{
				{Name: "name", Type: "string"},
				{Name: "version", Type: "string"},
				{Name: "chainId", Type: "uint256"},
				{Name: "verifyingContract", Type: "address"},
			},
			"ForwardRequest": []apitypes.Type{
				{Name: "from", Type: "address"},
				{Name: "to", Type: "address"},
				{Name: "value", Type: "uint256"},
				{Name: "gas", Type: "uint256"},
				{Name: "nonce", Type: "uint256"},
				{Name: "deadline", Type: "uint48"},
				{Name: "data", Type: "bytes"},
			},
		},
		PrimaryType: "ForwardRequest",
		Domain: apitypes.TypedDataDomain{
			Name:              "RWAExchangeForwarder",
			Version:           "1",
			ChainId:           math.NewHexOrDecimal256(s.client.ChainID().Int64()),
			VerifyingContract: s.forwarderAddr.String(),
		},
		Message: apitypes.TypedDataMessage{
			"from":     req.From,
			"to":       req.To,
			"value":    req.Value,
			"gas":      strconv.FormatUint(req.Gas, 10),
			"nonce":    strconv.FormatUint(req.Nonce, 10),
			"deadline": strconv.FormatUint(req.Deadline, 10),
			"data":     req.Data,
		},
	}

	// TypedDataAndHash 返回 (hash []byte, rawData string, err)——第一个是 EIP-712 哈希
	hash, _, err := apitypes.TypedDataAndHash(typedData)
	if err != nil {
		return common.Address{}, err
	}

	sig := common.FromHex(req.Signature)
	if len(sig) != 65 {
		return common.Address{}, errors.New("signature must be 65 bytes")
	}
	// ethers v6 返回 v=27/28，libsecp256k1 的 recid 需要 0/1
	if sig[64] == 27 || sig[64] == 28 {
		sig[64] -= 27
	}
	pubkey, err := crypto.SigToPub(hash, sig)
	if err != nil {
		return common.Address{}, err
	}
	return crypto.PubkeyToAddress(*pubkey), nil
}

// nonceOf 读取转发器上某地址的当前 nonce
func (s *Service) nonceOf(ctx context.Context, from common.Address) (uint64, error) {
	abi := blockchain.ForwarderABI()
	data, err := abi.Pack("nonces", from)
	if err != nil {
		return 0, err
	}
	out, err := s.client.ETHClient().CallContract(ctx, ethereum.CallMsg{To: &s.forwarderAddr, Data: data}, nil)
	if err != nil {
		return 0, err
	}
	return new(big.Int).SetBytes(out).Uint64(), nil
}

// executeForward 发送 forwarder.execute 交易（平台支付 gas）
func (s *Service) executeForward(ctx context.Context, req *ForwardRequest) (*types.Transaction, error) {
	abi := blockchain.ForwarderABI()

	value := new(big.Int)
	value.SetString(req.Value, 10)

	requestData := struct {
		From      common.Address
		To        common.Address
		Value     *big.Int
		Gas       *big.Int // uint256 → *big.Int（go-ethereum abi 反射要求）
		Deadline  *big.Int // uint48 → *big.Int
		Data      []byte
		Signature []byte
	}{
		From:      common.HexToAddress(req.From),
		To:        common.HexToAddress(req.To),
		Value:     value,
		Gas:       big.NewInt(int64(req.Gas)),
		Deadline:  big.NewInt(int64(req.Deadline)),
		Data:      common.FromHex(req.Data),
		Signature: common.FromHex(req.Signature),
	}

	data, err := abi.Pack("execute", requestData)
	if err != nil {
		return nil, fmt.Errorf("pack execute: %w", err)
	}

	return s.client.SendRaw(ctx, s.forwarderAddr, data)
}
