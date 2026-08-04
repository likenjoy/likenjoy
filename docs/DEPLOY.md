# RWA Exchange 一键部署详细流程

> 目标读者：运营者本人。从零到上线（含合约部署、链配置、服务器部署、HTTPS）。
> 架构：单机 Docker（nginx + frontend + backend + SQLite）+ EVM 公链（L2 为主）。
>
> **图例：🔑 = 需要你生成/填写的值　✍️ = 需要你执行的命令　⚠️ = 需要你决策的事项**

---

## 0. 架构总览

```
用户浏览器 → HTTPS → nginx(443) → frontend(Next.js, 3000) → backend(Go, 8080)
                                                        └→ SQLite(数据卷)
                                                        └→ 链上 RPC (Arbitrum/Base)
链上：IdentityRegistry + ComplianceModule + RWAToken + TrustedForwarder
```

- **⚠️ 链的选择**：测试网用 **Arbitrum Sepolia**（免费）；主网建议 **Arbitrum 或 Base**（L2 gas 便宜，支撑"平台代付 gas"模式）
- **⚠️ 三账户模型**（务必先理解，见第 1 节）

---

## 1. 第一步：生成平台账户（关键！不是你的个人钱包）

平台账户 = 部署合约 + mint/burn + 代付 gas 的运营账户。**必须独立于你的个人钱包**。

🔑 **执行以下命令生成平台私钥（自己保管，绝不外传）：**

```bash
# ✍️ 在本机 contracts/erc3643 目录下执行
node -e "const c=require('crypto');console.log('0x'+c.randomBytes(32).toString('hex'))"
```

🔑 **记录输出（示例 `0x1a2b...`）→ 这就是平台私钥，冷存储备份（纸笔/加密U盘）**

🔑 **算出平台地址（二选一）：**
- 把私钥导入 MetaMask（Add account → Import private key）→ 看到地址
- 或：`node -e "const {Wallet}=require('ethers');console.log(new Wallet('0x1a2b...').address)"`

> ⚠️ 铁律：个人钱包私钥永不进服务器；平台私钥永不用于个人资产。

---

## 2. 第二步：给平台账户领测试网代币（免费）

🔑 **平台地址填入水龙头领取测试 ETH：**
- https://faucet.arbitrum.io （或 https://www.alchemy.com/faucets/arbitrum-sepolia）
- 输入第 1 步算出的**平台地址** → 领取（每日有额度，够部署用）

> ⚠️ 主网部署前：平台账户需持有真实 ETH/ARB（部署 gas + 后续代付 gas 储备）。

---

## 3. 第三步：部署合约（在本机执行）

### 3.1 部署到测试网（Arbitrum Sepolia）

🔑 **把第 1 步生成的平台私钥填入下面命令（替换 `0x平台私钥`）：**

```bash
# ✍️ 在 contracts/erc3643 目录下
cd contracts/erc3643

# 方式一：私钥直接作为环境变量（临时、不回显）
DEPLOYER_PRIVATE_KEY=0x平台私钥 npx hardhat run scripts/deploy.cjs --network arbitrumSepolia

# 方式二：私钥写入 contracts/erc3643/.env（推荐，避免 shell 历史泄露）
#   🔑 创建 .env 文件，内容：DEPLOYER_PRIVATE_KEY=0x平台私钥
npx hardhat run scripts/deploy.cjs --network arbitrumSepolia
```

### 3.2 部署成功的标志（确认输出包含以下全部）

```
IdentityRegistry deployed to: 0x...          ← 记录这四个地址
ComplianceModule deployed to: 0x...
RWAToken deployed to: 0x...
ERC2771Forwarder deployed to: 0x...
TrustedForwarder bound to RWAToken
Platform identity registered: 0x平台账户     ← 应为第 1 步的地址
Platform whitelisted on ComplianceModule
Addresses saved to backend/contracts.json
```

🔑 **验证**：在 [Arbitrum Sepolia 区块浏览器](https://sepolia.arbiscan.io) 输入合约地址可查看。
部署脚本已自动完成：平台账户链上注册身份（国家=HK 344）+ 白名单 + 绑定转发器。

### 3.3 主网部署（上线阶段）

> ⚠️ **先决条件：合约已通过第三方审计（强制，见第 7 节）。**

```bash
# ✍️ 在 contracts/erc3643 目录下（🔑 需先配置 DEPLOYER_PRIVATE_KEY）
npx hardhat run scripts/deploy.cjs --network arbitrum
# 或 --network base / --network polygon
```

> ⚠️ 每次部署产物覆盖 `backend/contracts.json`——多环境（测试/生产）请分别保存。

---

## 4. 第四步：配置后端（服务器上）

### 4.1 拉取代码

```bash
# ✍️ 服务器上执行；🔑 若仓库为私有需配置 Gitee 凭据
git clone https://gitee.com/likenjoy/likenjoy.git
cd likenjoy
```

### 4.2 填写环境变量（🔑 全部需要你填！）

```bash
cp .env.example .env
```

🔑 **编辑 `.env`，逐项填写：**

```ini
# ① RPC 地址（与部署合约的链一致！）
#    测试网：https://sepolia-rollup.arbitrum.io/rpc
#    主网 Arbitrum：https://arb1.arbitrum.io/rpc
ETH_RPC_URL=这里填你的RPC地址

# ② 链 ID（必须与 RPC 对应！）
#    Arbitrum Sepolia=421614 / Arbitrum=42161 / Base=8453 / Base Sepolia=84532 / Polygon=137 / Polygon Amoy=80002
ETH_CHAIN_ID=这里填链ID数字

# ③ 平台私钥（必须与部署合约的账户一致！否则无 agent 权限，mint 会失败）
ETH_PRIVATE_KEY=这里填第1步生成的平台私钥

# ④ JWT 密钥（先执行 openssl rand -hex 32 生成，再粘贴）
JWT_SECRET=这里粘贴openssl rand -hex 32的输出
```

> 启动安全校验（已内置）：JWT_SECRET 缺失/默认值 → 拒绝启动；非本地 RPC 未设 ETH_CHAIN_ID → 拒绝启动。

### 4.3 确认合约配置

🔑 **检查 `backend/contracts.json` 是否为目标链的部署产物**（第 3 步生成，内含四个合约地址）。

---

## 5. 第五步：服务器一键启动

### 5.1 服务器要求

- ⚠️ **香港 VPS**（数据留在港，合规友好）；2 核 4G 起步
- 系统：Ubuntu 22.04 / Debian 12
- 开放端口：80、443（SSH 22）

### 5.2 安装 Docker

```bash
# ✍️ 服务器上执行
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
# 国内网络加速（可选）
mkdir -p /etc/docker && tee /etc/docker/daemon.json <<'EOF'
{"registry-mirrors":["https://docker.m.daocloud.io","https://dockerproxy.com"]}
EOF
systemctl restart docker
```

### 5.3 启动

```bash
# ✍️ 在项目根目录（.env 已配好）
cd ~/likenjoy
docker compose up -d --build
docker compose ps        # 三个服务都应为 running
```

### 5.4 验证

```bash
# ✍️ 🔑 把 服务器IP 换成你的实际 IP
curl -I http://你的服务器IP            # nginx 响应 200/301
curl -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"test@x.com","password":"x"}'   # 400/401 即后端正常（不应 502）
docker compose logs -f backend   # 应看到 Signer 地址（= 平台账户）与合约地址
```

---

## 6. 第六步：HTTPS + 域名

### 6.1 域名解析

🔑 **在域名服务商（阿里云/腾讯云/Cloudflare）添加 A 记录：**
- 主机记录：`app`（示例）
- 记录值：你的服务器 IP
- 完成后 `ping app.yourdomain.com` 能通

### 6.2 申请证书（Certbot 自动）

```bash
# ✍️ 服务器上执行；🔑 把 app.yourdomain.com 换成你的域名
apt install -y certbot
certbot certonly --standalone -d app.yourdomain.com   # 按提示操作
# 证书路径：/etc/letsencrypt/live/app.yourdomain.com/
```

### 6.3 配置 nginx

🔑 **编辑项目根 `nginx.conf`，改两处：**
1. `server_name` → 你的域名（如 `app.yourdomain.com`）
2. SSL 证书路径 → `/etc/letsencrypt/live/app.yourdomain.com/fullchain.pem` 和 `privkey.pem`

重启生效：

```bash
# ✍️ 服务器上执行
docker compose restart nginx
```

🔑 **浏览器访问 `https://app.yourdomain.com` → 登录页 + 绿锁 = 成功**

---

## 7. 上线前检查清单（必读）

### 安全（已内置，确认配置即可）
- [ ] `JWT_SECRET` 为强随机值（启动时强制校验）
- [ ] `ETH_PRIVATE_KEY` 为平台专用账户，服务器权限最小化（仅 root 可读 .env）
- [ ] 平台账户 gas 代币余额充足（代付模式需要持续储备）

### 合规（⚠️ 上线前必须完成，需你决策）
- [ ] **智能合约第三方审计**（CertiK / SlowMist / 本地审计所）——不审计不上主网
- [ ] 商业 KYC/AML 接入（当前为自建筛查，牌照期需升级）
- [ ] 制裁名单接入完整数据源（当前为内置示例）
- [ ] 锁定期/白名单/国家锁区按产品规则配置
- [ ] 文档哈希上链 + 审计留痕（SFC 要求）

### 运维
- [ ] SQLite 数据卷定期备份（`backend/scripts/backup.sh`）
- [ ] 日志收集 + 链上交易失败告警
- [ ] 平台私钥多签化（Safe）后置计划

---

## 8. 常见问题（FAQ）

| 现象 | 原因 | 解决 |
|------|------|------|
| 后端启动 Fatal: ETH_CHAIN_ID | 非本地 RPC 未声明链 ID | `.env` 加 `ETH_CHAIN_ID=421614`（或对应链） |
| 后端启动 Fatal: JWT_SECRET | 密钥缺失/默认值 | `openssl rand -hex 32` 生成填入 |
| 交易一直 pending / 失败 | 平台账户无 gas 代币 | 给平台账户转 ETH/ARB |
| mint 报 "Receiver not verified" | 投资者未完成 KYC 链上注册 | 走 KYC 审核流程（自动注册） |
| 前端连不上后端 | 浏览器访问的 API 域名/端口 | nginx 代理 `/api` 到 8080（已配置） |
| 国内访问慢 | 境外服务器网络 | 换香港节点 / CDN 加速 |

---

## 9. 部署拓扑备忘

```
[测试网阶段]  本机 Hardhat（开发） → Arbitrum Sepolia（预演） → 主网 L2（正式）
[服务器]      Gitee 代码 → git pull → docker compose up -d
[监控]        docker compose logs + 区块浏览器
```
