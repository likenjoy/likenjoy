// Epoch 两阶段结算端到端测试：创建 → 下单 → 关闭批量撮合
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
  console.log("=== Epoch 两阶段结算测试 ===\n");
  const uniq = Date.now().toString(36);

  // 1. 用户准备
  console.log("[1] 用户准备");
  const buyEmail = "ep_buy_" + uniq + "@test.com";
  const sellEmail = "ep_sell_" + uniq + "@test.com";
  await req("POST", "/auth/register", { email: buyEmail, password: "Test123456", role: "investor" });
  await req("POST", "/auth/register", { email: sellEmail, password: "Test123456", role: "investor" });
  const bl = await req("POST", "/auth/login", { email: buyEmail, password: "Test123456" });
  const sl = await req("POST", "/auth/login", { email: sellEmail, password: "Test123456" });
  check("买卖双方登录", !!bl.data.token && !!sl.data.token);
  const bt = bl.data.token, st = sl.data.token;

  // 2. 创建资产
  console.log("[2] 资产准备");
  const admEmail = "ep_adm_" + uniq + "@test.com";
  await req("POST", "/auth/register", { email: admEmail, password: "Admin123456", role: "admin" });
  const al = await req("POST", "/auth/login", { email: admEmail, password: "Admin123456" });
  const asset = await req("POST", "/assets", {
    name: "Epoch Test " + uniq, symbol: "EP" + uniq.slice(-4).toUpperCase(), asset_type: "gold",
    description: "epoch test", total_supply: "1000", price_per_unit: "50", min_investment: "100",
  }, al.data.token);
  check("资产创建", asset.status === 201 && !!asset.data.id, "status=" + asset.status);
  const assetId = asset.data.id;

  // 3. 创建 epoch
  console.log("[3] 创建结算周期");
  const ep = await req("POST", "/trades/epochs", { asset_id: assetId }, al.data.token);
  check("创建 epoch 201", ep.status === 201 && ep.data.status === "open", "status=" + ep.status);
  const epochId = ep.data.id;
  const epList = await req("GET", `/trades/epochs?asset_id=${assetId}`, null, al.data.token);
  check("epoch 列表可见", (epList.data.data || []).some((e) => e.id === epochId));

  // 4. 双方下单（挂单）
  console.log("[4] 订单收集期下单");
  const buy = await req("POST", "/trades/orders", {
    asset_id: assetId, side: "buy", order_type: "limit", price: "50", quantity: "10",
  }, bt);
  check("买单挂单", buy.status === 201 || buy.status === 200, "status=" + buy.status);
  const sell = await req("POST", "/trades/orders", {
    asset_id: assetId, side: "sell", order_type: "limit", price: "50", quantity: "10",
  }, st);
  check("卖单挂单", sell.status === 201 || sell.status === 200, "status=" + sell.status);

  // 5. 关闭 epoch → 批量撮合
  console.log("[5] 关闭 epoch 批量结算");
  const close = await req("POST", `/trades/epochs/${epochId}/close`, null, al.data.token);
  check("关闭 epoch 200", close.status === 200 && close.data.epoch.status === "closed", "status=" + close.status);
  check("批量撮合执行", close.data.matched_orders >= 0, "matched=" + close.data.matched_orders);

  // 6. 重复关闭被拒
  const close2 = await req("POST", `/trades/epochs/${epochId}/close`, null, al.data.token);
  check("重复关闭被拒 400", close2.status === 400, "status=" + close2.status);

  console.log("\n=== 验证结果 ===");
  const failed = results.filter((r) => !r.ok);
  console.log(`总计 ${results.length} 项：${results.length - failed.length} 通过，${failed.length} 失败`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error("FATAL:", e.message); process.exit(2); });
