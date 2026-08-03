package blockchain

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// Client 区块链客户端封装
type Client struct {
	eth      *ethclient.Client
	chainID  *big.Int
	signer   *Signer
}

// Config 区块链配置
type Config struct {
	RPCURL     string // 以太坊RPC地址（Infura/Alchemy/本地节点）
	ChainID    int64  // 链ID（1=主网, 5=Goerli, 11155111=Sepolia, 137=Polygon）
	PrivateKey string // 平台私钥（用于签名交易）
}

// NewClient 创建区块链客户端
func NewClient(cfg Config) (*Client, error) {
	eth, err := ethclient.Dial(cfg.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("dial eth client: %w", err)
	}

	chainID := big.NewInt(cfg.ChainID)

	privateKey, err := crypto.HexToECDSA(cfg.PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("parse private key: %w", err)
	}

	publicKey := privateKey.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("cast public key to ECDSA")
	}

	signer := &Signer{
		privateKey: privateKey,
		address:    crypto.PubkeyToAddress(*publicKeyECDSA),
	}

	return &Client{
		eth:     eth,
		chainID: chainID,
		signer:  signer,
	}, nil
}

// Close 关闭连接
func (c *Client) Close() {
	c.eth.Close()
}

// ETHClient 返回底层ethclient
func (c *Client) ETHClient() *ethclient.Client {
	return c.eth
}

// ChainID 返回链ID
func (c *Client) ChainID() *big.Int {
	return c.chainID
}

// Signer 返回签名器
func (c *Client) Signer() *Signer {
	return c.signer
}

// PlatformAddress 返回平台地址
func (c *Client) PlatformAddress() common.Address {
	return c.signer.Address()
}

// Signer 交易签名器
type Signer struct {
	privateKey *ecdsa.PrivateKey
	address    common.Address
}

// Address 返回签名者地址
func (s *Signer) Address() common.Address {
	return s.address
}

// PrivateKey 返回私钥
func (s *Signer) PrivateKey() *ecdsa.PrivateKey {
	return s.privateKey
}

// Ping 检查RPC连接
func (c *Client) Ping(ctx context.Context) error {
	_, err := c.eth.BlockNumber(ctx)
	return err
}
