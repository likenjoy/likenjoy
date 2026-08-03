# RWA Exchange — 合规真实世界资产（RWA）代币化交易平台

基于 **ERC-3643（T-REX 合规代币标准）** 的 RWA 全栈平台：资产代币化 → KYC/AML 合规 → 私募交易 → 分红/赎回 → 平台收入管理。

## 技术栈

| 层 | 技术 |
|---|---|
| 合约 | Solidity 0.8 + ERC-3643（IdentityRegistry / ComplianceModule / RWAToken），Hardhat |
| 后端 | Go + Gin + SQLite（可迁移 PostgreSQL），go-ethereum 链上交互 |
| 前端 | Next.js 16（Turbopack）+ React 19 + antd + wagmi/RainbowKit 钱包连接 |

## 核心能力

- **资产发行**：创建资产 → 自动链上 mint → 状态流转（draft → live）
- **合规体系**：KYC + 专业投资者认证 + 制裁名单筛查 + 国家锁区 + 审计日志
- **钱包集成**：连接钱包（wagmi/RainbowKit）+ EIP-191 签名绑定
- **收入管理**：铸造费/赎回费/gas 加价（万分数），收入流水 + gas 账本 + 审计
- **交易与存续期**：私募订单、分红计划、实物/现金赎回（admin 审核流）

## 快速启动（本地开发）

```bash
# 1. 合约链
cd contracts/erc3643 && npx hardhat node
# 2. 部署（另开终端）
cd contracts/erc3643 && npx hardhat run scripts/deploy.cjs --network localhost
# 3. 后端（另开终端，开发私钥需显式允许）
cd backend && $env:ALLOW_DEV_PRIVATE_KEY="true"; go run cmd/api/main.go
# 4. 前端（另开终端）
cd frontend && npm run dev
```

访问 http://localhost:3000 （前端统一入口，/api 由 Next 代理到后端）

## 生产部署

```bash
cp .env.example .env   # 填写 ETH_PRIVATE_KEY / JWT_SECRET / ETH_RPC_URL
docker compose up -d --build
```

详见 `SECURITY.md`（上线安全 Checklist）。

## 目录结构

```
contracts/erc3643/   ERC-3643 合约 + Hardhat
backend/             Go API（asset/trade/dividend/redeem/kyc/revenue/user）
frontend/            Next.js 前端（10+ 页面）
test_e2e.mjs         端到端测试
```

## 合规说明

平台采用"中心化运营 + 链上合规执行"架构（参考 Centrifuge / Tokeny T-REX 模式）：
KYC/AML、费率、审核由中心化后台管理；链上只存身份 hash（隐私），转账受白名单与身份校验约束。
**上线前必须完成**：智能合约第三方审计、牌照申请、完整制裁名单接入（见 SECURITY.md）。

> 免责声明：本项目为技术演示，不构成任何投资建议或法律意见。
