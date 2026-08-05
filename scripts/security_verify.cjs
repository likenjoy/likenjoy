// 安全加固验证：模拟攻击者三种攻击路径
// 用 node 内置 crypto 手工构造 JWT（HS256），零依赖
const crypto = require("crypto");

const BASE = "http://localhost:8080/api";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok: !!ok });
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name}${extra ? " | " + extra : ""}`);
}

// 构造 HS256 JWT（攻击者视角）
function forgeJWT(payload, secret) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = crypto.createHmac("sha256", secret).update(header + "." + body).digest("base64url");
  return `${header}.${body}.${sig}`;
}

(async () => {
  console.log("=== 安全加固攻击模拟验证 ===\n");

  // 1. 伪造 admin token（用泄露的旧默认密钥 "change-me-in-production" 签发）
  console.log("[1] 伪造 token 攻击（密钥泄露场景）");
  const forged = forgeJWT(
    { user_id: "00000000-0000-0000-0000-000000000001", email: "attacker@evil.com", role: "admin" },
    "change-me-in-production" // 攻击者假设旧硬编码密钥
  );
  const r1 = await fetch(BASE + "/admin/fees", { headers: { Authorization: "Bearer " + forged } });
  check("旧默认密钥伪造 admin token 被拒", r1.status === 401, "status=" + r1.status);

  // 2. 错误签名 token
  const badSig = forgeJWT(
    { user_id: "00000000-0000-0000-0000-000000000001", email: "a@b.c", role: "admin" },
    "wrong-secret-12345"
  );
  const r2 = await fetch(BASE + "/admin/fees", { headers: { Authorization: "Bearer " + badSig } });
  check("错误密钥签名被拒", r2.status === 401, "status=" + r2.status);

  // 3. alg none 攻击
  const noneToken = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0." +
    Buffer.from(JSON.stringify({ user_id: "00000000-0000-0000-0000-000000000001", email: "a@b.c", role: "admin" })).toString("base64url") + ".";
  const r3 = await fetch(BASE + "/admin/fees", { headers: { Authorization: "Bearer " + noneToken } });
  check("alg=none 攻击被拒", r3.status === 401, "status=" + r3.status);

  // 4. 无 token
  const r4 = await fetch(BASE + "/admin/fees");
  check("无 token 被拒", r4.status === 401, "status=" + r4.status);

  // 5. 登录暴力破解防护：快速连续 25 次登录（错密码）应被拦截
  //    429 = 频率限流 / 423 = 连续失败锁定（两者都是防爆破拦截）
  console.log("\n[2] 登录暴力破解防护");
  let got429 = false;
  for (let i = 0; i < 25; i++) {
    const r = await fetch(BASE + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "brute_victim@test.com", password: "wrongpass" })
    });
    if (r.status === 429 || r.status === 423) { got429 = true; break; }
  }
  check("暴力破解被拦截（限流 429 / 锁定 423）", got429);

  // 6. 角色实时校验：伪造 token 声称 admin，但 DB 无此用户 → 拒绝
  const fakeUid = forgeJWT(
    { user_id: "11111111-1111-1111-1111-111111111111", email: "ghost@x.com", role: "admin" },
    "dev-test-secret-for-local-only-0123456789abcdef"
  );
  const r6 = await fetch(BASE + "/admin/fees", { headers: { Authorization: "Bearer " + fakeUid } });
  check("DB 无此用户的 token 被拒（角色实时校验）", r6.status === 401, "status=" + r6.status);

  console.log("\n=== 验证结果 ===");
  const failed = results.filter(r => !r.ok);
  console.log(`总计 ${results.length} 项：${results.length - failed.length} 通过，${failed.length} 失败`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error("FATAL:", e.message); process.exit(2); });
