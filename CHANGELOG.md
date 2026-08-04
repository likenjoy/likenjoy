# Changelog

本项目所有显著变更均记录于此文件，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [0.4.0] - 2026-08-04

### ⛽ EIP-2771 元交易（gas 代付）

**合约层**
- 新增 `TrustedForwarder`（OZ `ERC2771Forwarder` 本地包装）：EIP-712 类型化签名、nonce 防重放、deadline 过期校验、批量执行
- `RWAToken` 支持 ERC-2771：`setTrustedForwarder` / `_msgSender()` 还原真实签名者 / `isTrustedForwarder()` 标准接口
- Hardhat EVM 目标升级 `cancun`（OZ 5.x 依赖 `mcopy` 指令）
- 部署脚本：自动部署 forwarder 并绑定 RWAToken，地址写入 `contracts.json`

**后端 Go relayer**
- 新增 `internal/relay` 模块：`POST /api/relay/execute`（平台代付 gas 转发元交易）
- 六层安全检查：from=登录用户绑定钱包 / to 平台白名单 / value=0 / deadline 未过期 / nonce 链上一致 / EIP-712 验签（v=27/28→recid 转换）
- gas 账本审计留痕（`meta_tx_relay` 记录）
- `blockchain.Client.SendRaw`：通用发送（复用 nonce 锁 + gas 估算 + 等确认加固路径）
- AuthMiddleware 扩展：上下文注入绑定钱包地址

**测试**
- 合约单测新增元交易 3 项（gas-less 转账/错误签名/过期）
- 新增 `scripts/test_relay_e2e.cjs`：端到端 12 项（正常链路 + 5 类攻击面拦截）
- 验收成绩：合约 25/25、API 28/28、安全模拟 6/6、元交易 e2e 12/12

**其他**
- 登录/注册限流阈值调至 60 次/分钟（防爆破核心靠失败锁定，总次数为合法客户端留余量）

## [0.3.0] - 2026-08-04

### 🔐 安全加固（P0，安全架构师审计驱动）

**CRITICAL 修复**
- **移除 JWT 密钥硬编码** `"change-me-in-production"`：密钥改为环境变量 `JWT_SECRET` 注入，缺失或使用默认值时**拒绝启动**（开发模式需显式 `ALLOW_DEV_SECRET=true`）
- 统一签发（user handler）与验证（中间件）两侧密钥，杜绝两侧不一致导致的鉴权绕过

**认证与鉴权**
- JWT 锁定 `HS256` 签名算法：拦截 `alg=none` / 算法混淆攻击
- **角色与账户状态实时查库校验**：管理员降权/用户封禁/注销立即生效，不信任 token 内嵌角色，不存在用户（幽灵 token）直接拒绝
- 登录/注册接口限流：20 次/分钟/IP（防暴力破解与撞库）

**区块链操作层**
- 交易发送全局互斥锁：修复并发调用 `PendingNonceAt` 撞 nonce 导致交易互相覆盖
- Gas 估算：`EstimateGas` + 30% 缓冲替代固定 300,000（防复杂转账 out of gas）
- 等待交易确认落块后才返回（防 RPC 层丢交易）

**合约合规**
- **锁定期双向约束**：修复"认购当天即转让"绕过漏洞——发送方锁定期内不得转出，接收方锁定期内不得接收；`mint` 首次认购场景放行
- **司法管辖区锁区链上兜底**：新增 `setRestrictedCountry` / `isCountryRestricted`，后端 KYC 被绕过时链上仍可拦截锁区用户转账
- **紧急熔断**：新增 `pause` / `unpause`（安全事件/合规整改时暂停全部代币操作）
- `updateNAV` 校验净值必须为正

**测试**
- 新增 `scripts/security_verify.cjs`：攻击模拟验证（伪造 token / alg=none / 暴力破解 / 幽灵用户）
- 合约单测新增锁定期、锁区、熔断、NAV 用例
- 验收成绩：合约单测 22/22、API 全功能验收 28/28、安全攻击模拟 6/6

## [0.2.0] - 2026-08-03

### 修复
- KYC 链上注册幂等化：避免重复 `registerIdentity` revert（fc54611）
- **权限漏洞修复**：资产发行/分红等接口增加角色权限，投资者不可创建资产（6fb38c7）
- 重建 Sidebar.tsx：修复编码损坏 + WalletOutlined 热更新报错（5a46238）
- antd `destroyOnHidden` 迁移（8e46538）
- 编译产物 `artifacts/`、`cache/` 移出版本库，`.gitignore` 托管（b96561b）

### 新增
- 钱包扫码登录（WalletConnect）+ 投资者持仓页（196dcfc）
- KYC 通过后自动链上注册投资者身份 + 白名单（registerIdentity + addToWhitelist）（2bae3f4）
- 全功能验收脚本 `scripts/comprehensive_test.cjs`、无头浏览器 e2e 脚本（8e46538, 6fb38c7）

### 文档
- README 增加架构图与徽章（融资展示用）（467e6c0）
- 添加 LICENSE（eae55a1）

## [0.1.0] - 2026-08-03

### 初始版本

RWA Exchange 完整平台 MVP：

- **合约层**：ERC-3643 合规代币标准（IdentityRegistry / ComplianceModule / RWAToken），Hardhat 部署
- **后端**：Go + Gin + SQLite，覆盖用户、资产、订单、分红、赎回、KYC、收入管理、审计日志
- **前端**：Next.js 16 + antd + wagmi/RainbowKit 钱包连接，10+ 页面
- **合规体系**：KYC 专业投资者认证、制裁名单本地筛查、国家锁区、链上身份注册与白名单
- **收入模块**：铸造费/赎回费/gas 加价费率表（万分数）、收入流水、gas 账本、审计日志
- **安全基线**：私钥环境变量注入（开发私钥需显式允许）、部署包（Docker/nginx/备份脚本）

## 路线图

- [x] ~~EIP-2771 元交易 + 自建 Go relayer（gas 代付）~~（v0.4.0 完成）
- [x] ~~前端「免 gas 转账」交互~~（持仓页 GaslessTransfer 组件，v0.4.1 完成）
- [ ] 登录失败锁定（连续失败 N 次锁 IP/账户）
- [ ] 法币入金通道（Transak / MoonPay，香港 HKD 支持）
- [ ] 商业 KYC 服务接入（Shufti Pro / Sumsub）+ OpenSanctions 增强
- [ ] ERC-1271 合约钱包签名支持（托管钱包/多签客户验签）
- [ ] 文档哈希上链 + 链下存证（SFC 审计留痕）
- [ ] 分红升级为 RDT 式线性释放（ERC-4626）
- [ ] 订单簿两阶段「订单-结算」模式（Centrifuge epoch 参考）
- [ ] Safe 多签金库 / 托管账户
