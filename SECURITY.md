# RWA Exchange 安全与合规手册

## 一、上线前安全 Checklist（必须逐项完成）

### 私钥与密钥
- [ ] `ETH_PRIVATE_KEY` 通过环境变量/KMS/HSM 注入，**禁止硬编码**（代码已强制：无密钥且未显式 `ALLOW_DEV_PRIVATE_KEY=true` 时禁用区块链功能）
- [ ] 平台签名地址使用**多签钱包**（Gnosis Safe 等），单私钥签名是上线大忌
- [ ] `JWT_SECRET` 改为长随机串：`openssl rand -hex 32`
- [ ] 数据库文件权限 600，仅应用用户可读

### 智能合约（建议第三方审计：CertiK / 慢雾 / Quantstamp）
- [ ] 合约经第三方审计并出报告
- [ ] 审计重点：mint/burn 权限（onlyAgent/onlyOwner）、合规检查绕过、重入、整数溢出
- [ ] 平台金库 `treasury_address` 用多签
- [ ] 链上身份（identityHash）只存 hash，个人数据永不上链（ERC-3643 设计已满足）

### 基础设施
- [ ] HTTPS（Let's Encrypt / 云证书），HSTS
- [ ] 数据库定时备份（`backend/scripts/backup.sh`，建议 cron 每日）
- [ ] 日志审计保留期 ≥ 7 年（金融监管常见要求）
- [ ] 依赖漏洞扫描：`npm audit`、`govulncheck`
- [ ] 渗透测试（上线前至少一轮）

### 业务合规
- [ ] 代币法律定性意见书（证券/非证券）
- [ ] 牌照：香港 SFC / 新加坡 MAS / 目标司法辖区（律所主导）
- [ ] 制裁名单接入完整版（OFAC SDN / 联合国），替换内置示例名单：
  - OFAC: https://www.treasury.gov/ofac/downloads/sdn.csv
  - UN: https://scsanctions.un.org/resources/xml/en/consolidated.xml
- [ ] 专业投资者认证材料审核流程（净资产证明）
- [ ] 投资者锁区清单按监管要求更新（`pkg/compliance/countries.go`）
- [ ] 披露文件、隐私政策、用户协议（法务审阅）
- [ ] 资产托管协议 + 定期储备证明审计

## 二、架构安全设计（当前已实现）

| 项 | 状态 |
|---|---|
| 链上只存身份 hash（隐私） | ✅ |
| KYC 角色分离（admin/compliance） | ✅ |
| 制裁名单筛查 + 锁区 | ✅（内置示例名单） |
| 专业投资者认证流程 | ✅ |
| 费率变更审计日志 | ✅ |
| 私钥强制环境变量 + 指纹核对日志 | ✅ |
| 前端同源代理（无直接暴露后端） | ✅ |

## 三、漏洞报告流程

发现安全问题请发邮件至 security@yourdomain.com（附复现步骤），勿公开披露。

## 四、已知风险与生产替换项

1. 内置制裁名单为**示例**，上线必须换完整 OFAC/UN 名单
2. SQLite 单机部署，规模增长后迁移 PostgreSQL（代码已兼容 PG 语法）
3. 平台代付 gas 为单热钱包，量产后建议升级 EIP-2771 元交易 + Paymaster
4. 合约未经第三方审计
