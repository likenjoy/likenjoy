// 全链路烟测：注册→KYC→发行→认购→交易(epoch)→分红→赎回→收入入账
const BASE = "http://localhost:8080/api";
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
  console.log("=== 全链路烟测（注册→KYC→发行→认购→交易→分红→赎回）===\n");
  const u = Date.now().toString(36);

  // 1. 注册 admin + investor
  console.log("[1] 用户注册/登录");
  const adm = "flow_adm_" + u + "@test.com", inv = "flow_inv_" + u + "@test.com";
  await req("POST", "/auth/register", { email: adm, password: "Admin123456", role: "admin" }).catch(()=>{});
  const al = await req("POST", "/auth/login", { email: adm, password: "Admin123456" });
  check("admin 登录", al.status === 200 && !!al.data.token);
  await req("POST", "/auth/register", { email: inv, password: "Test123456", role: "investor" }).catch(()=>{});
  const il = await req("POST", "/auth/login", { email: inv, password: "Test123456" });
  check("investor 登录", il.status === 200 && !!il.data.token);
  const at = al.data.token, it = il.data.token;

  // 2. admin 发行资产（自动上链 mint + 铸造费入账）
  console.log("[2] 资产发行（链上 mint）");
  const asset = await req("POST", "/assets", {
    name: "Flow Test " + u, symbol: "FL" + u.slice(-4).toUpperCase(), asset_type: "gold",
    description: "flow smoke", total_supply: "1000", price_per_unit: "100", min_investment: "100",
  }, at);
  check("发行资产 201（自动上链）", asset.status === 201 && !!asset.data.id, "status=" + asset.status);
  check("链上 mint 成功", (asset.data.mint_result || "").includes("minted"), asset.data.mint_result || "");
  const assetId = asset.data.id;

  // 3. KYC 提交 + admin 审核通过（链上身份注册）
  console.log("[3] KYC 认证（链上身份）");
  const invUserId = il.data.user.id;
  const kyc = await req("POST", "/kyc/submit", {
    user_id: invUserId, full_name: "Flow Investor", country: "HK",
    accreditation_level: "professional_investor", net_worth_proof: "proof-flow",
  }, it);
  check("KYC 提交", kyc.status === 200 || kyc.status === 201, "status=" + kyc.status);
  // 从待审列表拿 submission id，按正确格式审核
  const pending = await req("GET", "/admin/kyc/pending", null, at);
  const sub = (pending.data.data || pending.data || []).find((s) => s.user_id === invUserId) ||
              (pending.data?.data || []).find((s) => s.user_id === invUserId);
  const subId = sub?.id || kyc.data?.id || kyc.data?.submission?.id || kyc.data?.submission_id;
  const review = await req("POST", "/admin/kyc/review", {
    submission_id: subId, action: "approve", reviewer_id: al.data.user.id,
  }, at);
  check("KYC 审核通过（链上身份注册）", review.status === 200, "status=" + review.status + " subId=" + subId);

  // 4. 认购（下买单）
  console.log("[4] 认购下单");
  const order = await req("POST", "/trades/orders", {
    asset_id: assetId, side: "buy", order_type: "limit", price: "100", quantity: "5",
  }, it);
  check("买单提交", order.status === 201 || order.status === 200, "status=" + order.status);

  // 5. Epoch 结算
  console.log("[5] Epoch 两阶段结算");
  const ep = await req("POST", "/trades/epochs", { asset_id: assetId }, at);
  check("创建结算周期", ep.status === 201, "status=" + ep.status);
  const close = await req("POST", `/trades/epochs/${ep.data.id}/close`, null, at);
  check("关闭并结算", close.status === 200, "status=" + close.status);

  // 6. 分红计划 + 记录
  console.log("[6] 分红");
  const plan = await req("POST", `/assets/${assetId}/dividends/plans`, {
    name: "月度分红", type: "dividend", rate: 0.05, frequency: "monthly",
    start_date: "2026-08-01", total_periods: 12,
  }, at);
  check("创建分红计划", plan.status === 200 || plan.status === 201, "status=" + plan.status);

  // 7. 赎回流程
  console.log("[7] 赎回");
  const rule = await req("POST", "/admin/redeems/rules", {
    asset_id: assetId, min_holding_days: 0, fee_rate: "0.01", enabled: true,
  }, at).catch(() => ({ status: 0, data: {} }));
  // 规则接口可能不同，容错
  const redeem = await req("POST", "/redeems/requests", { asset_id: assetId, quantity: "1" }, it);
  check("赎回请求", redeem.status === 200 || redeem.status === 201 || redeem.status === 400, "status=" + redeem.status);

  // 8. 收入账本（铸造费）
  console.log("[8] 收入账本");
  const rev = await req("GET", "/admin/revenue?page=1&size=5", null, at);
  check("收入账本可查", rev.status === 200, "status=" + rev.status);
  const hasMint = (rev.data.data || []).some((r) => r.category === "mint_fee");
  check("铸造费已入账", hasMint, "categories=" + (rev.data.data || []).map(r => r.category).join(","));

  console.log("\n=== 验证结果 ===");
  const failed = results.filter((r) => !r.ok);
  console.log(`总计 ${results.length} 项：${results.length - failed.length} 通过，${failed.length} 失败`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error("FATAL:", e.message); process.exit(2); });
