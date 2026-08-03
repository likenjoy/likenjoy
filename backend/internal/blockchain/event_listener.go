package blockchain

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

// EventListener 链上事件监听器
// 监听ERC-3643合约事件并同步到本地数据库
type EventListener struct {
	client     *Client
	tokenAddrs []common.Address // 监听的代币合约地址
	lastBlock  uint64
	stopCh     chan struct{}
}

// NewEventListener 创建事件监听器
func NewEventListener(client *Client) *EventListener {
	return &EventListener{
		client: client,
		stopCh: make(chan struct{}),
	}
}

// WatchToken 添加要监听的代币合约
func (el *EventListener) WatchToken(tokenAddr common.Address) {
	el.tokenAddrs = append(el.tokenAddrs, tokenAddr)
}

// Start 启动事件监听
func (el *EventListener) Start(ctx context.Context) error {
	header, err := el.client.ETHClient().HeaderByNumber(ctx, nil)
	if err != nil {
		return fmt.Errorf("get latest block: %w", err)
	}
	el.lastBlock = header.Number.Uint64()

	log.Printf("[EventListener] Starting from block %d, watching %d tokens", el.lastBlock, len(el.tokenAddrs))

	go el.loop(ctx)
	return nil
}

// Stop 停止事件监听
func (el *EventListener) Stop() {
	close(el.stopCh)
}

func (el *EventListener) loop(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-el.stopCh:
			return
		case <-ticker.C:
			el.poll(ctx)
		case <-ctx.Done():
			return
		}
	}
}

func (el *EventListener) poll(ctx context.Context) {
	currentHeader, err := el.client.ETHClient().HeaderByNumber(ctx, nil)
	if err != nil {
		log.Printf("[EventListener] Failed to get header: %v", err)
		return
	}

	currentBlock := currentHeader.Number.Uint64()
	if currentBlock <= el.lastBlock {
		return
	}

	// 每次最多处理100个区块
	endBlock := currentBlock
	if endBlock-el.lastBlock > 100 {
		endBlock = el.lastBlock + 100
	}

	for _, tokenAddr := range el.tokenAddrs {
		el.processBlocks(ctx, tokenAddr, el.lastBlock+1, endBlock)
	}

	el.lastBlock = endBlock
}

func (el *EventListener) processBlocks(ctx context.Context, tokenAddr common.Address, fromBlock, toBlock uint64) {
	tokenABI := TokenABI()

	// 构建事件过滤器
	query := ethereum.FilterQuery{
		FromBlock: new(big.Int).SetUint64(fromBlock),
		ToBlock:   new(big.Int).SetUint64(toBlock),
		Addresses: []common.Address{tokenAddr},
	}

	logs, err := el.client.ETHClient().FilterLogs(ctx, query)
	if err != nil {
		log.Printf("[EventListener] FilterLogs error: %v", err)
		return
	}

	for _, vLog := range logs {
		el.handleLog(vLog, tokenABI)
	}
}

// EventHandler 事件处理回调
type EventHandler func(eventName string, eventData map[string]interface{})

var eventHandler EventHandler

// SetEventHandler 设置事件处理回调
func SetEventHandler(handler EventHandler) {
	eventHandler = handler
}

func (el *EventListener) handleLog(vLog types.Log, tokenABI interface{}) {
	// 尝试解析已知事件
	// Transfer 事件
	if len(vLog.Topics) == 3 && vLog.Topics[0] == common.HexToHash("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
		from := common.BytesToAddress(vLog.Topics[1].Bytes())
		to := common.BytesToAddress(vLog.Topics[2].Bytes())
		amount := new(big.Int).SetBytes(vLog.Data)

		if eventHandler != nil {
			eventHandler("Transfer", map[string]interface{}{
				"from":   from.Hex(),
				"to":     to.Hex(),
				"amount": amount.String(),
			})
		}
		log.Printf("[EventListener] Transfer: %s -> %s, amount=%s", from.Hex(), to.Hex(), amount.String())
	}
}

// SyncService 链上数据同步服务
// 负责将链上事件同步到本地数据库
type SyncService struct {
	listener *EventListener
	// db *sql.DB  // 本地数据库连接
}

// NewSyncService 创建同步服务
func NewSyncService(listener *EventListener) *SyncService {
	return &SyncService{
		listener: listener,
	}
}

// Start 启动同步
func (s *SyncService) Start(ctx context.Context) error {
	// 注册事件处理回调
	SetEventHandler(func(eventName string, data map[string]interface{}) {
		s.handleChainEvent(eventName, data)
	})

	return s.listener.Start(ctx)
}

// Stop 停止同步
func (s *SyncService) Stop() {
	s.listener.Stop()
}

func (s *SyncService) handleChainEvent(eventName string, data map[string]interface{}) {
	switch eventName {
	case "Transfer":
		// 更新本地数据库中的代币余额
		// TODO: 实现数据库更新逻辑
		log.Printf("[SyncService] Syncing Transfer event: %v", data)
	case "TokenMinted":
		log.Printf("[SyncService] Syncing TokenMinted event: %v", data)
	case "TokenBurned":
		log.Printf("[SyncService] Syncing TokenBurned event: %v", data)
	case "ForcedTransfer":
		log.Printf("[SyncService] Syncing ForcedTransfer event: %v", data)
	case "NAVUpdated":
		log.Printf("[SyncService] Syncing NAVUpdated event: %v", data)
	case "DividendDistributed":
		log.Printf("[SyncService] Syncing DividendDistributed event: %v", data)
	}
}
