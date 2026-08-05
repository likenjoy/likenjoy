// 压力测试：并发请求 API（读接口为主 + 认证写接口），统计吞吐/延迟分位/错误率
// 用法：node scripts/stress_test.cjs [并发数] [轮数]
const BASE = "http://localhost:8080/api";
const CONCURRENCY = parseInt(process.argv[2] || "50", 10);
const ROUNDS = parseInt(process.argv[3] || "10", 10);

async function timed(fn) {
  const t0 = performance.now();
  try {
    const r = await fn();
    return { ok: r.status < 500, status: r.status, ms: performance.now() - t0 };
  } catch (e) {
    return { ok: false, status: 0, ms: performance.now() - t0, err: e.message };
  }
}

(async () => {
  console.log(`=== 压力测试：${CONCURRENCY} 并发 × ${ROUNDS} 轮 ===\n`);

  // 读接口（公开，无鉴权，适合高并发）
  const readApis = [
    ["GET /api/health", () => fetch(BASE + "/health")],
    ["GET /api/ads", () => fetch(BASE + "/ads?position=home_banner")],
    ["GET /api/fees", () => fetch(BASE + "/fees")],
    ["GET /api/config/contracts", () => fetch(BASE + "/config/contracts")],
  ];

  // 认证写接口（轻量并发，避免触发限流/锁定）
  const uniq = Date.now().toString(36);
  let token = "";
  const authApis = [
    ["POST /api/auth/register", () => fetch(BASE + "/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `stress_${Math.random().toString(36).slice(2, 8)}@test.com`, password: "Test123456", role: "investor" }),
    })],
    ["POST /api/auth/login", () => fetch(BASE + "/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `stress_fixed_${uniq}@test.com`, password: "Test123456" }),
    })],
  ];

  // 预注册一个固定用户用于登录压测
  await fetch(BASE + "/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `stress_fixed_${uniq}@test.com`, password: "Test123456", role: "investor" }),
  }).catch(() => {});

  const allApis = [
    ...readApis,
    ...authApis,
    ["GET /api/assets/live (登录)", () => fetch(BASE + "/assets/live", { headers: { Authorization: "Bearer " + token } })],
  ];

  const results = new Map(); // apiName -> {count, ok, fail, times[]}

  for (const [name, fn] of allApis) {
    results.set(name, { count: 0, ok: 0, fail: 0, times: [] });
  }

  for (let round = 0; round < ROUNDS; round++) {
    const tasks = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      const [name, fn] = allApis[i % allApis.length];
      tasks.push(
        timed(fn).then((res) => {
          const r = results.get(name);
          r.count++;
          if (res.ok) r.ok++; else r.fail++;
          r.times.push(res.ms);
          if (!res.ok && res.status === 0) console.log(`  [round ${round}] ${name} -> 网络错误: ${res.err}`);
        })
      );
    }
    await Promise.all(tasks);
    // 登录拿 token 供后续请求
    if (!token) {
      const l = await fetch(BASE + "/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `stress_fixed_${uniq}@test.com`, password: "Test123456" }),
      }).catch(() => null);
      if (l && l.status === 200) token = (await l.json()).token;
    }
  }

  console.log("\n=== 结果 ===");
  let totalOk = 0, totalFail = 0, totalCount = 0;
  for (const [name, r] of results) {
    totalCount += r.count; totalOk += r.ok; totalFail += r.fail;
    const sorted = r.times.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
    const avg = r.times.length ? (r.times.reduce((s, t) => s + t, 0) / r.times.length).toFixed(1) : 0;
    const rate = r.count ? ((r.ok / r.count) * 100).toFixed(1) : 0;
    console.log(`  ${name}`);
    console.log(`    请求 ${r.count} | 成功 ${r.ok} (${rate}%) | 失败 ${r.fail} | 延迟 avg=${avg}ms p50=${p50.toFixed(0)}ms p95=${p95.toFixed(0)}ms p99=${p99.toFixed(0)}ms`);
  }
  console.log(`\n总计 ${totalCount} 请求：成功 ${totalOk} (${((totalOk / totalCount) * 100).toFixed(1)}%)，失败 ${totalFail}`);
  console.log(`并发 ${CONCURRENCY} × ${ROUNDS} 轮完成`);
  process.exit(totalFail > totalCount * 0.02 ? 1 : 0); // 允许 2% 以内失败（限流等）
})();
