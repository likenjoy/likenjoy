// 全功能综合验收测试：覆盖全部业务模块（API 层 + 链上联动）
// 用法：node scripts/comprehensive_test.mjs
const { ethers } = require(require("path").join(__dirname, "..", "contracts", "erc3643", "node_modules", "ethers"));

const BASE = "http://localhost:8080/api";
const IR = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const CM = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const provider = new ethers.JsonRpcProvider("http://localhost:8545");
const WALLET_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"; // Hardhat #2

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok: !!ok });
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name}${extra ? " | " + extra : ""}`);
  return ok;
}
const uniq = Date.now().toString(36);
let token = "", uid = "", assetId = "", adminToken = "", subId = "";

(async () => {
  console.log("=== RWA Exchange 全功能验收 ===\n");

  // 1. 注册 + 登录 issuer
  console.log("[1] 用户体系");
  const issEmail = "iss_" + uniq + "@test.com";
  const r1 = await req("POST", "/auth/register", { email: issEmail, password: "Test123456", role: "issuer" });
  check("issuer 注册", r1.status === 201, "status=" + r1.status);
  const l1 = await req("POST", "/auth/login", { email: issEmail, password: "Test123456" });
  token = l1.data.token; uid = l1.data.user?.id;
  check("issuer 登录", l1.status === 200 && !!token);

  // 2. 资产创建 → mint → live + 铸造费
  console.log("[2] 资产发行（链上 mint + 铸造费）");
  const sym = "ACC" + uniq.toUpperCase().slice(-6);
  const r2 = await req("POST", "/assets", { name: "验收测试资产", symbol: sym, asset_type: "gold", total_supply: "200000", price_per_unit: "10.00", min_investment: "1000" }, token);
  assetId = r2.data.id;
  check("创建资产(201)", r2.status === 201 && !!assetId);
  check("链上 mint 成功", r2.data.mint_result?.startsWith("minted:"), r2.data.mint_result?.slice(0, 30));
  await new Promise(r => setTimeout(r, 2500));
  const r2b = await req("GET", "/assets/" + assetId, null, token);
  check("资产状态 live", r2b.data.status === "live", "status=" + r2b.data.status);

  // 3. 分红计划
  console.log("[3] 分红");
  const r3 = await req("POST", `/assets/${assetId}/dividends/plans`, { name: "验收分红", type: "dividend", rate: 0.05, frequency: "monthly", start_date: "2026-09-01", total_periods: 12 }, token);
  check("创建分红计划", r3.status === 201, "status=" + r3.status);

  // 4. 订单
  console.log("[4] 交易");
  const r4 = await req("POST", "/trades/orders", { asset_id: assetId, side: "buy", order_type: "limit", price: "10.00", quantity: "100" }, token);
  check("下买单", r4.status === 201, "status=" + r4.status);
  const r4b = await req("GET", "/trades/orders", null, token);
  check("订单列表", r4b.status === 200);

  // 5. 投资者注册 + 钱包绑定
  console.log("[5] 投资者 + 钱包绑定");
  const invEmail = "inv_" + uniq + "@test.com";
  await req("POST", "/auth/register", { email: invEmail, password: "Test123456", role: "investor" });
  const l5 = await req("POST", "/auth/login", { email: invEmail, password: "Test123456" });
  const invToken = l5.data.token, invUid = l5.data.user.id;
  const wallet = new ethers.Wallet(WALLET_KEY);
  const bindMsg = `RealVest wallet binding\nAddress: ${wallet.address}\nNonce: ${Date.now()}`;
  const bindSig = await wallet.signMessage(bindMsg);
  const r5 = await req("POST", "/auth/bind-wallet", { wallet_address: wallet.address, signature: bindSig, message: bindMsg }, invToken);
  check("钱包绑定(EIP-191)", r5.status === 200 && r5.data.wallet_address === wallet.address);

  // 6. KYC（专业投资者）
  console.log("[6] KYC + 合规筛查");
  const r6 = await req("POST", "/kyc/submit", { user_id: invUid, full_name: "Zhang Wei", country: "HK", accreditation_level: "professional_investor" }, invToken);
  subId = r6.data.id;
  check("KYC 提交(专业投资者)", r6.status === 201 && r6.data.status === "pending");

  // 7. 制裁名单拦截
  const sanEmail = "san_" + uniq + "@test.com";
  await req("POST", "/auth/register", { email: sanEmail, password: "Test123456", role: "investor" });
  const ls = await req("POST", "/auth/login", { email: sanEmail, password: "Test123456" });
  const r7 = await req("POST", "/kyc/submit", { user_id: ls.data.user.id, full_name: "Osama Bin Laden", country: "HK" }, ls.data.token);
  check("制裁名单拦截", r7.data.status === "rejected" && (r7.data.reject_reason || "").includes("sanctions"));

  // 8. 锁区拦截
  const ruEmail = "ru_" + uniq + "@test.com";
  await req("POST", "/auth/register", { email: ruEmail, password: "Test123456", role: "investor" });
  const lr = await req("POST", "/auth/login", { email: ruEmail, password: "Test123456" });
  const r8 = await req("POST", "/kyc/submit", { user_id: lr.data.user.id, full_name: "Ivan Petrov", country: "RU" }, lr.data.token);
  check("锁区拦截", r8.data.status === "rejected");

  // 9. admin + KYC 审核 → 链上联动
  console.log("[7] admin + KYC 链上联动");
  const admEmail = "adm_" + uniq + "@test.com";
  await req("POST", "/auth/register", { email: admEmail, password: "Admin123456", role: "admin" });
  const la = await req("POST", "/auth/login", { email: admEmail, password: "Admin123456" });
  adminToken = la.data.token;
  const r9 = await req("POST", "/admin/kyc/review", { submission_id: subId, reviewer_id: la.data.user.id, action: "approve" }, adminToken);
  check("KYC 审核通过", r9.status === 200);
  await new Promise(r => setTimeout(r, 3000));
  const onChain = async (addr, sel) => provider.call({ to: addr, data: sel + wallet.address.slice(2).toLowerCase().padStart(64, "0") });
  const verified = await onChain(IR, ethers.id("isVerified(address)").slice(0, 10));
  const whitelisted = await onChain(CM, ethers.id("isWhitelisted(address)").slice(0, 10));
  check("链上身份注册", verified === "0x0000000000000000000000000000000000000000000000000000000000000001");
  check("链上白名单", whitelisted === "0x0000000000000000000000000000000000000000000000000000000000000001");

  // 10. 赎回全流程
  console.log("[8] 赎回");
  const r10 = await req("POST", "/admin/redeems/rules", { asset_id: assetId, min_amount: 10, max_amount: 10000, lock_period_days: 0, fee_rate: 0.01, allow_physical: true, allow_cash: true, processing_days: 2, is_active: true }, adminToken);
  check("配置赎回规则", r10.status === 200);
  const calc = await req("POST", "/redeems/calculate", { asset_id: assetId, amount: 100, unit: "token", price_per_unit: 10.0 }, invToken);
  check("赎回计算", calc.status === 200 && Number(calc.data.total_value) === 1000, "total=" + calc.data.total_value);
  const rd = await req("POST", "/redeems/requests", { asset_id: assetId, type: "cash", amount: 100, unit: "token", price_per_unit: 10.0 }, invToken);
  check("提交赎回申请", rd.status === 201 && rd.data.status === "pending");
  const ap = await req("POST", `/admin/redeems/${rd.data.id}/approve`, {}, adminToken);
  check("赎回审批", ap.status === 200 && ap.data.status === "approved", "status=" + ap.data.status);

  // 11. 收入管理
  console.log("[9] 收入管理");
  const rv = await req("GET", "/admin/revenue", null, adminToken);
  const mintFeeFound = (rv.data.data || []).some(x => x.category === "mint_fee" && x.asset_id === assetId);
  check("铸造费收入记账", mintFeeFound, "total=" + rv.data.total);
  const fees = await req("GET", "/admin/fees", null, adminToken);
  check("费率配置读取", fees.status === 200 && fees.data.mint_fee_rate >= 0);
  const audit = await req("GET", "/admin/audit", null, adminToken);
  check("审计日志", audit.status === 200 && audit.data.total > 0);

  // 12. 持仓 + 用户管理
  console.log("[10] 持仓 + 用户管理");
  const pf = await req("GET", "/portfolio", null, invToken);
  check("投资者持仓", pf.status === 200 && pf.data.wallet === wallet.address, "balance=" + pf.data.balance);
  const users = await req("GET", "/admin/users", null, adminToken);
  check("admin 用户列表", users.status === 200 && users.data.total >= 4);
  const pend = await req("GET", "/admin/kyc/pending", null, adminToken);
  check("admin 待审列表", pend.status === 200);
  const feesPub = await req("GET", "/fees", null, invToken);
  check("费率公开披露", feesPub.status === 200);

  // 13. 权限隔离
  console.log("[11] 权限隔离");
  const r13 = await req("GET", "/admin/fees", null, invToken);
  check("投资者访问 admin 接口 403", r13.status === 403);
  const r13b = await req("POST", "/assets", { name: "x", symbol: "X" + uniq.slice(-4), asset_type: "gold", total_supply: "1", price_per_unit: "1", min_investment: "1" }, invToken);
  check("投资者不能发行资产(403)", r13b.status === 403);

  // 汇总
  console.log("\n=== 验收结果 ===");
  const failed = results.filter(r => !r.ok);
  console.table(results);
  console.log(`总计 ${results.length} 项：${results.length - failed.length} 通过，${failed.length} 失败`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error("FATAL:", e.message); process.exit(2); });
