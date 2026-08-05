// 生产密钥生成器：JWT_SECRET + 平台账户（私钥+地址）
// 用法：node scripts/gen_keys.cjs
// 输出：写入 gen_keys_output.txt（请立即转移到安全位置，然后删除该文件！）
// 安全说明：密钥只在本地生成，绝不上传仓库；生成后立即冷存储备份
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { ethers } = require(path.join(__dirname, "..", "contracts", "erc3643", "node_modules", "ethers"));

function genJWTSecret(len = 48) {
  return crypto.randomBytes(len).toString("hex");
}

// 生成平台账户（EVM）
function genAccount() {
  const wallet = ethers.Wallet.createRandom();
  return { address: wallet.address, privateKey: wallet.privateKey };
}

(async () => {
  console.log("=== 生产密钥生成器 ===\n");
  const jwt = genJWTSecret();
  const acct = genAccount();
  const out = `# ===== RealVest 生产密钥（绝密，冷存储备份后删除本文件）=====
# 生成时间: ${new Date().toISOString()}

# 1. JWT_SECRET（后端 .env 使用；≥32 字符强随机）
JWT_SECRET=${jwt}

# 2. 平台账户（后端 ETH_PRIVATE_KEY 使用；合约部署 DEPLOYER_PRIVATE_KEY 使用）
#    地址（公钥，可公开）：${acct.address}
ETH_PRIVATE_KEY=${acct.privateKey}

# ===== 使用说明 =====
# 1. 测试网部署：DEPLOYER_PRIVATE_KEY=${acct.privateKey} npx hardhat run scripts/deploy.cjs --network arbitrumSepolia
# 2. 后端 .env：ETH_PRIVATE_KEY=${acct.privateKey}
# 3. 领水：给地址 ${acct.address} 领取测试网 ETH（Arbitrum Sepolia faucet）
# 4. ⚠️ 私钥已在本机生成，未经过任何网络传输；请立即冷存储（离线保险箱/密码管理器）
# 5. 使用后删除 gen_keys_output.txt
`;
  const f = path.join(__dirname, "..", "gen_keys_output.txt");
  fs.writeFileSync(f, out, { encoding: "utf8", mode: 0o600 });
  console.log("✅ 已生成并写入:", f);
  console.log("   JWT_SECRET: " + jwt.slice(0, 12) + "...（" + jwt.length + " 字符）");
  console.log("   平台地址: " + acct.address);
  console.log("   平台私钥: " + acct.privateKey.slice(0, 10) + "...（已写入文件）");
  console.log("\n⚠️ 立即打开 gen_keys_output.txt 备份到安全位置，然后删除该文件！");
})();
