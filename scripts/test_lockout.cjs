// 登录失败锁定验证：连续失败 5 次 → 第 6 次即使密码正确也被 423 锁定
// 同时验证：不同账户互不影响（IP|email 双维度 key）
const BASE = "http://localhost:8080/api";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok: !!ok });
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name}${extra ? " | " + extra : ""}`);
}
async function login(email, password) {
  const res = await fetch(BASE + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

(async () => {
  console.log("=== 登录失败锁定验证 ===\n");
  const uniq = Date.now().toString(36);
  const email = "lock_" + uniq + "@test.com";
  const otherEmail = "lock_other_" + uniq + "@test.com";

  // 注册两个用户
  await fetch(BASE + "/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Test123456", role: "investor" }),
  });
  await fetch(BASE + "/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: otherEmail, password: "Test123456", role: "investor" }),
  });

  console.log("[1] 连续 5 次错误密码");
  let lockedAt = null;
  for (let i = 1; i <= 5; i++) {
    const r = await login(email, "wrong-pass-" + i);
    if (r.status === 423) { lockedAt = i; break; }
  }
  check("第 5 次失败触发锁定(423)", lockedAt === 5, "locked at attempt=" + lockedAt);

  console.log("[2] 锁定期间正确密码也被拒");
  const r2 = await login(email, "Test123456");
  check("锁定期间正确密码 423", r2.status === 423, "status=" + r2.status);

  console.log("[3] 其他账户不受影响（IP|email 维度隔离）");
  const r3 = await login(otherEmail, "Test123456");
  check("其他账户正常登录 200", r3.status === 200, "status=" + r3.status);

  console.log("[4] 失败计数不跨账户累计");
  const r4 = await login(otherEmail, "wrong-1");
  const r5 = await login(otherEmail, "wrong-2");
  const r6 = await login(otherEmail, "wrong-3");
  const r7 = await login(otherEmail, "wrong-4");
  const r8 = await login(otherEmail, "Test123456"); // 第 5 次（若跨账户累计会锁）
  check("其他账户第 5 次尝试未锁（独立计数）", r8.status === 200, "status=" + r8.status);

  console.log("\n=== 验证结果 ===");
  const failed = results.filter(r => !r.ok);
  console.log(`总计 ${results.length} 项：${results.length - failed.length} 通过，${failed.length} 失败`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error("FATAL:", e.message); process.exit(2); });
