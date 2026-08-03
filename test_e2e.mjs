const BASE = "http://localhost:8080/api";

async function post(path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function get(path, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(BASE + path, { headers });
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  const results = [];
  let token = "";
  let userId = "";
  let assetId = "";

  // 1. Register
  console.log("1. Register...");
  const email = "e2e_" + Date.now() + "@test.com";
  const r1 = await post("/auth/register", { email, password: "Test123456", role: "issuer" });
  results.push({ test: "Register", ok: r1.status === 201, status: r1.status });
  console.log("  ", r1.status);

  // 2. Login
  console.log("2. Login...");
  const r2 = await post("/auth/login", { email, password: "Test123456" });
  token = r2.data.token;
  userId = r2.data.user?.id;
  results.push({ test: "Login", ok: r2.status === 200 && !!token, status: r2.status });
  console.log("  ", r2.status, "userId:", userId);

  if (!token) { console.log("FAILED: No token"); console.table(results); return; }

  // 3. Create Asset
  console.log("3. Create Asset...");
  const symbol = "E2E" + Date.now().toString(36).toUpperCase();
  const r3 = await post("/assets", {
    name: "E2E Test Gold",
    symbol,
    asset_type: "gold",
    total_supply: "1000000",
    price_per_unit: "10.00",
    min_investment: "1000.00",
  }, token);
  assetId = r3.data.id;
  results.push({ test: "Create Asset", ok: r3.status === 201 && !!assetId, status: r3.status });
  console.log("  ", r3.status, "assetId:", assetId);

  // 4. Get Asset
  if (assetId) {
    console.log("4. Get Asset...");
    const r4 = await get(`/assets/${assetId}`, token);
    results.push({ test: "Get Asset", ok: r4.status === 200, status: r4.status });
    console.log("  ", r4.status);
  }

  // 5. List Assets (GET /assets returns {data, total})
  console.log("5. List Assets...");
  const r5 = await get("/assets", token);
  const listOk = r5.status === 200 && Array.isArray(r5.data?.data) && r5.data.data.length > 0;
  results.push({ test: "List Assets", ok: listOk, status: r5.status });
  console.log("  ", r5.status, "count:", r5.data?.data?.length);

  // 6. Create Dividend Plan
  if (assetId) {
    console.log("6. Create Dividend Plan...");
    const r6 = await post(`/assets/${assetId}/dividends/plans`, {
      name: "E2E Monthly Dividend",
      type: "dividend",
      rate: 0.05,
      frequency: "monthly",
      start_date: "2026-08-15",
      total_periods: 12,
    }, token);
    results.push({ test: "Create Dividend Plan", ok: r6.status === 201, status: r6.status });
    console.log("  ", r6.status);
  }

  // 7. Place Order
  if (assetId) {
    console.log("7. Place Order...");
    const r7 = await post("/trades/orders", {
      asset_id: assetId,
      side: "buy",
      order_type: "limit",
      price: "10.00",
      quantity: "100",
    }, token);
    results.push({ test: "Place Order", ok: r7.status === 201, status: r7.status });
    console.log("  ", r7.status);
  }

  // 8. KYC Submit
  console.log("8. KYC Submit...");
  const r8 = await post("/kyc/submit", { user_id: userId }, token);
  results.push({ test: "KYC Submit", ok: r8.status === 201 || r8.status === 200, status: r8.status });
  console.log("  ", r8.status);

  // 9. List Orders
  console.log("9. List Orders...");
  const r9 = await get("/trades/orders", token);
  results.push({ test: "List Orders", ok: r9.status === 200, status: r9.status });
  console.log("  ", r9.status);

  // Summary
  console.log("\n=== RESULTS ===");
  console.table(results);
  const allOk = results.every(r => r.ok);
  console.log(allOk ? "ALL PASSED" : "SOME FAILED");
}

main().catch(console.error);
