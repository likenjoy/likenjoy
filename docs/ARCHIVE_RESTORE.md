# 归档与一键调取

## 归档包位置

```
D:\rwa-exchange-archive\
  rwa-exchange-v0.7.2-<时间戳>.tar.gz   ← 完整源码归档（154MB，已排除敏感文件）
```

**已排除**（不含任何密钥/敏感数据）：`node_modules`、`.git`、`.env`、`gen_keys_output.txt`、`backup/`、`.gh-mitm/`、`screenshots/`、`.next/`、`dist/`

## 一键调取（恢复运行）

```powershell
# 1. 解压到目标目录
cd D:\
tar -xzf D:\rwa-exchange-archive\rwa-exchange-v0.7.2-<时间戳>.tar.gz -C rwa-restore

# 2. 安装依赖
cd rwa-restore\frontend; npm install
cd ..\contracts\erc3643; npm install

# 3. 准备环境变量（从生产密钥备份复制，勿用仓库内示例值）
Copy-Item rwa-restore\.env.example rwa-restore\backend\.env
# 编辑 backend/.env 填入：JWT_SECRET / ETH_PRIVATE_KEY / ETH_RPC_URL / ETH_CHAIN_ID

# 4. 启动（三终端）：
cd rwa-restore\contracts\erc3643; npx hardhat node          # 链
cd rwa-restore\backend; go run cmd/api/main.go              # 后端
cd rwa-restore\frontend; npm run dev                        # 前端

# 5. 验证
http://localhost:3000  |  http://localhost:8080/api/health
```

## 测试基线（调取后跑一遍）

```powershell
cd rwa-restore
node scripts/smoke_full_flow.cjs        # 全链路 13 项
node scripts/comprehensive_test.cjs     # API 28 项
cd contracts\erc3643; npx hardhat test  # 合约 37 项
```

## 归档策略

- 每次里程碑版本归档一次（v0.x 打 tag 后）
- 归档包存两处：`D:\rwa-exchange-archive\`（本机）+ 移动硬盘/网盘（异地）
- GitHub 仓库本身就是最新代码的活归档（含全部历史）
