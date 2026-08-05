# RWA Exchange — 合规真实世界资产（RWA）代币化交易平台

基于 **ERC-3643（T-REX 合规代币标准）** 的 RWA 全栈平台：资产代币化 → KYC/AML 合规 → 私募交易 → 分红/赎回 → 平台收入管理。

> ⚖️ **许可证**：PolyForm Noncommercial 1.0.0 —— **非商业用途免费；商业用途（部署运营/SaaS/白标）需购买商业授权**（详见 [LICENSE](./LICENSE)）
> 
> 🏷️ **三级授权**：Community（免费演示）/ Pro（商业部署）/ Enterprise（白标+多租户）——功能分级见 `docs/TIER_GUIDE.md`

![Gitee stars](https://gitee.com/likenjoy/likenjoy/badge/star.svg)
![Go](https://img.shields.io/badge/Go-1.26-00ADD8)
![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636)
![Next.js](https://img.shields.io/badge/Next.js-16-black)

## 系统架构

```
┌────────────────────────────────────────────────────────────────┐
│                        用户浏览器 (Web UI)                        │
│  资产发行 / 投资交易 / 分红赎回 / KYC认证 / 钱包连接(wagmi+RainbowKit) │
└──────────────────────────────┬─────────────────────────────────┘
                               │ /api (Next.js 代理，同源无跨域)
┌──────────────────────────────▼─────────────────────────────────┐
│                    Go API 服务 (Gin + SQLite)                    │
│  用户/资产/订单/分红/赎回/收入管理/KYC审核/制裁筛查/审计日志          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ 合规引擎      │  │ 收入管理      │  │ 区块链操作器           │  │
│  │ KYC+制裁+锁区 │  │ 铸造费/gas账本│  │ 平台私钥代付 gas       │  │
│  └──────────────┘  └──────────────┘  └───────────┬──────────┘  │
└───────────────────────────────────────────────────┬────────────┘
                                                    │ RPC (go-ethereum)
┌───────────────────────────────────────────────────▼────────────┐
│                    链上合约 (ERC-3643)                          │
│  IdentityRegistry ── ComplianceModule ── RWAToken               │
│  身份hash注册        白名单/转账合规检查     合规mint/burn        │
└────────────────────────────────────────────────────────────────┘
```

### 核心业务流

```mermaid
graph LR
    A[资产方] -->|1. 资产资料| B[发行资产]
    B -->|2. 链上 mint| C[(RWAToken)]
    B -->|3. 状态 live| D[投资者可见]
    E[投资者] -->|4. KYC/专业投资者认证| F[合规审核]
    F -->|5. 通过| G[认购/交易]
    G -->|6. 结算| C
    C -->|7. 分红/赎回| H[存续期管理]
    H -->|8. 收入| I[平台收入管理]


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
cp .env.example .env   # 填写 ETH_PRIVATE_KEY / JWT_SECRET / ETH_RPC_URL / ETH_CHAIN_ID
docker compose up -d --build
```

**完整部署流程（链选择 → 平台账户 → 合约部署 → 服务器 → HTTPS）见 [`docs/DEPLOY.md`](docs/DEPLOY.md)**。

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
