// 转账手续费端到端测试：admin 设置费率 → 链上强制扣收 → 验证
const { ethers } = require(require("path").join(__dirname, "..", "contracts", "erc3643", "node_modules", "ethers"));
const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:8080/api";
const contracts = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "backend", "contracts.json"), "utf8"));
const provider = new ethers.JsonRpcProvider("http://localhost:8545");

const PK_PLATFORM = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // 平台=部署者
const PK_SENDER = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // #1
const PK_RECEIVER = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"; // #2

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok: !!ok });
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name}${extra ? " | " + extra : ""}`);
}
async function req(method, p, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(BASE + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

(async () => {
  console.log("=== 转账手续费（T-REX TransferFees）端到端测试 ===\n");
  const platform = new ethers.Wallet(PK_PLATFORM, provider);
  const sender = new ethers.Wallet(PK_SENDER, provider);
  const receiver = new ethers.Wallet(PK_RECEIVER, provider);
  const tokenAddr = contracts.rwaToken;
  const token = new ethers.Contract(tokenAddr, [
    "function transferFeeRate() view returns (uint256)",
    "function feeCollector() view returns (address)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256) returns (bool)",
    "function mint(address,uint256,bytes32)",
  ], provider);
  const treasury = platform.address; // 平台账户作为手续费收款方

  // 1. 链上准备：sender/receiver 身份+白名单+mint
  console.log("[1] 链上准备");
  const iface = new ethers.Interface([
    "function registerIdentity(address,bytes32,uint16)",
    "function addToWhitelist(address,uint256,uint256)",
    "function mint(address,uint256,bytes32)",
    "function isVerified(address) view returns (bool)",
    "function isWhitelisted(address) view returns (bool)",
  ]);
  const ir = new ethers.Contract(contracts.identityRegistry, iface, platform);
  const cm = new ethers.Contract(contracts.complianceModule, iface, platform);
  let pnonce = await provider.getTransactionCount(platform.address, "pending");
  const send = async (c, m, a) => { const tx = await c[m](...a, { nonce: pnonce++ }); await tx.wait(); };
  for (const w of [sender, receiver]) {
    if (!(await ir.isVerified(w.address))) await send(ir, "registerIdentity", [w.address, ethers.keccak256(ethers.toUtf8Bytes(w.address + "-kyc")), 344]);
    if (!(await cm.isWhitelisted(w.address))) await send(cm, "addToWhitelist", [w.address, 0, 0]);
  }
  const senderBal = await token.balanceOf(sender.address);
  if (senderBal < 1000n) await send(token.connect(platform), "mint", [sender.address, ethers.parseEther("1000"), contracts.assetId]);
  check("sender 有 1000 余额", (await token.balanceOf(sender.address)) >= 1000n);

  // 2. admin 设置费率（transfer_fee_rate=50 = 0.5%，treasury=平台账户）
  console.log("[2] admin 设置费率 → 链上联动");
  const adminEmail = "fee_adm_" + Date.now().toString(36) + "@test.com";
  await req("POST", "/auth/register", { email: adminEmail, password: "Admin123456", role: "admin" });
  const al = await req("POST", "/auth/login", { email: adminEmail, password: "Admin123456" });
  check("admin 登录", al.status === 200 && !!al.data.token);

  const r2 = await req("PUT", "/admin/fees", {
    mint_fee_rate: 30, transfer_fee_rate: 50, gas_markup_rate: 100, treasury_address: treasury,
  }, al.data.token);
  check("更新费率 200（含链上同步）", r2.status === 200, "status=" + r2.status + " " + JSON.stringify(r2.data).slice(0, 100));

  // 3. 验证链上费率生效
  console.log("[3] 链上费率验证");
  const onChainRate = await token.transferFeeRate();
  const onChainCollector = await token.feeCollector();
  check("链上费率=50（0.5%）", onChainRate === 50n, "rate=" + onChainRate);
  check("链上收款方=平台账户", onChainCollector.toLowerCase() === treasury.toLowerCase(), onChainCollector);

  // 4. 转账扣费验证
  console.log("[4] 转账自动扣费");
  const amount = ethers.parseEther("100");
  const fee = (amount * 50n) / 10000n; // 0.5
  const balBefore = await token.balanceOf(receiver.address);
  const balTreasuryBefore = await token.balanceOf(treasury);
  await (await token.connect(sender).transfer(receiver.address, amount)).wait();
  const balAfter = await token.balanceOf(receiver.address);
  const balTreasuryAfter = await token.balanceOf(treasury);
  check("接收方收到净额 99.5", balAfter === balBefore + amount - fee, `net=${ethers.formatEther(balAfter - balBefore)}`);
  check("平台 treasury 收到 0.5 手续费", balTreasuryAfter === balTreasuryBefore + fee, `fee=${ethers.formatEther(balTreasuryAfter - balTreasuryBefore)}`);

  // 5. 费率表（DB）与链上一致
  console.log("[5] DB 费率表一致性");
  const fees = await req("GET", "/admin/fees", null, al.data.token);
  check("DB transfer_fee_rate=50", fees.data.transfer_fee_rate === 50, "db=" + fees.data.transfer_fee_rate);
  check("DB treasury=平台账户", (fees.data.treasury_address || "").toLowerCase() === treasury.toLowerCase());

  console.log("\n=== 验证结果 ===");
  const failed = results.filter(r => !r.ok);
  console.log(`总计 ${results.length} 项：${results.length - failed.length} 通过，${failed.length} 失败`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error("FATAL:", e.message); process.exit(2); });
