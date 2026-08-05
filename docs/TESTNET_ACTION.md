# 测试网部署行动卡（Arbitrum Sepolia）

> 目标：把合约部署到真实测试网，验证全链路在真实链上工作。
> 前置：已完成 `scripts/gen_keys.cjs` 生成平台账户（gen_keys_output.txt）。

## 行动 1：给平台账户领测试网 ETH（约 2 分钟，需人工）

平台地址：**0x57A189d77883E43b1D505135d481178Ae9107d0b**（如重新生成请以 gen_keys_output.txt 为准）

任选一个 faucet（打开链接 → 粘贴地址 → 验证 → 领取 0.2-0.5 ETH）：

| Faucet | 链接 | 说明 |
|--------|------|------|
| Arbitrum 官方 | https://faucet.arbitrum.io | 首选，支持 GitHub/邮箱登录领水 |
| Chainlink | https://faucets.chain.link/arbitrum-sepolia | 需连接钱包 |
| Alchemy | https://faucet.alchemy.com/faucets/arbitrum-sepolia | 需注册 |

**验证到账**：
```bash
node -e "fetch('https://sepolia-rollup.arbitrum.io/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',method:'eth_getBalance',params:['0x57A189d77883E43b1D505135d481178Ae9107d0b','latest'],id:1})}).then(r=>r.json()).then(d=>console.log('余额:',parseInt(d.result,16)/1e18,'ETH'))"
```

## 行动 2：部署合约（约 1 分钟）

```bash
cd C:\Users\Administrator\Desktop\rwa-exchange\contracts\erc3643
# 私钥从 gen_keys_output.txt 复制（ETH_PRIVATE_KEY 那行）
$env:DEPLOYER_PRIVATE_KEY="0x<你的平台私钥>"
npx hardhat run scripts/deploy.cjs --network arbitrumSepolia
```

成功输出：4 个合约地址 + `Addresses saved to backend/contracts.json`

**验证**：在 https://sepolia.arbiscan.io 搜索部署地址/交易 hash，确认合约已创建。

## 行动 3：后端连接测试网

```bash
cd C:\Users\Administrator\Desktop\rwa-exchange\backend
$env:ALLOW_DEV_PRIVATE_KEY="true"   # 仅测试网阶段豁免；主网必须去掉
$env:JWT_SECRET="<gen_keys_output.txt 的 JWT_SECRET>"
$env:ETH_RPC_URL="https://sepolia-rollup.arbitrum.io/rpc"
$env:ETH_CHAIN_ID="421614"
$env:ETH_PRIVATE_KEY="0x<平台私钥>"
go run cmd/api/main.go
```

启动后验证：
```bash
curl http://localhost:8080/api/health   # {"chain":"connected","contracts_loaded":true}
```

## 行动 4：真实链全链路验证

1. 浏览器打开 http://localhost:3000 → 注册 → KYC → 发行资产（链上 mint 到测试网！）
2. 到 https://sepolia.arbiscan.io 搜索 mint 交易确认上链
3. 全链路烟测：`node scripts/smoke_full_flow.cjs`（后端连测试网时跑）

## ⚠️ 注意事项

- 测试网私钥与主网**必须不同**（测试网可泄露，主网严格保密）
- 部署后 `backend/contracts.json` 被覆盖为测试网地址——本地开发前需重新部署 Hardhat 链
- 主网部署流程见 `docs/DEPLOY.md` + `docs/MAINNET_CHECKLIST.md`（**合约审计通过前禁止主网**）
