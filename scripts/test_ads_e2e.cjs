// 广告系统端到端测试：admin 创建/更新/停用 → 公开接口 → 权限隔离
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
  console.log("=== 广告系统端到端测试 ===\n");
  const uniq = Date.now().toString(36);

  // 1. 注册 admin + investor
  console.log("[1] 用户准备");
  const admEmail = "ad_adm_" + uniq + "@test.com";
  await req("POST", "/auth/register", { email: admEmail, password: "Admin123456", role: "admin" });
  const al = await req("POST", "/auth/login", { email: admEmail, password: "Admin123456" });
  check("admin 登录", al.status === 200 && !!al.data.token);

  const invEmail = "ad_inv_" + uniq + "@test.com";
  await req("POST", "/auth/register", { email: invEmail, password: "Test123456", role: "investor" });
  const il = await req("POST", "/auth/login", { email: invEmail, password: "Test123456" });
  check("investor 登录", il.status === 200 && !!il.data.token);

  // 2. admin 创建广告
  console.log("[2] admin 创建广告");
  const r2 = await req("POST", "/admin/ads", {
    title: "测试广告：黄金基金代币化发行", image_url: "", link_url: "https://example.com/gold",
    position: "home_banner", enabled: true, sort_order: 1,
  }, al.data.token);
  check("创建广告 201", r2.status === 201 && !!r2.data.id, "status=" + r2.status);
  const adId = r2.data.id;

  // 3. 公开接口可查（Landing 展示）
  console.log("[3] 公开查询（Landing 数据源）");
  const r3 = await req("GET", "/ads?position=home_banner", null, null);
  check("公开接口 200 无鉴权", r3.status === 200);
  check("广告出现在 home_banner", (r3.data.data || []).some((a) => a.id === adId));

  // 4. 更新广告（改标题 + 停用）
  console.log("[4] 更新/停用");
  const r4 = await req("PUT", `/admin/ads/${adId}`, {
    title: "更新后的广告标题", image_url: "", link_url: "",
    position: "home_banner", enabled: false, sort_order: 2,
  }, al.data.token);
  check("更新广告 200", r4.status === 200);
  const r4b = await req("GET", "/ads?position=home_banner", null, null);
  check("停用后公开接口不再返回", !(r4b.data.data || []).some((a) => a.id === adId));

  // 5. 重新启用 → 公开接口恢复
  await req("PUT", `/admin/ads/${adId}`, {
    title: "更新后的广告标题", image_url: "", link_url: "",
    position: "home_banner", enabled: true, sort_order: 2,
  }, al.data.token);
  const r5 = await req("GET", "/ads?position=home_banner", null, null);
  check("重新启用后恢复展示", (r5.data.data || []).some((a) => a.id === adId));

  // 6. 权限隔离：投资者不能操作广告
  console.log("[5] 权限隔离");
  const r6 = await req("POST", "/admin/ads", { title: "x", position: "home_banner", enabled: true }, il.data.token);
  check("投资者创建广告被拒 403", r6.status === 403, "status=" + r6.status);
  const r6b = await req("GET", "/admin/ads", null, il.data.token);
  check("投资者查看管理列表被拒 403", r6b.status === 403);

  // 7. 删除
  console.log("[6] 删除");
  const r7 = await req("DELETE", `/admin/ads/${adId}`, null, al.data.token);
  check("删除广告 200", r7.status === 200);
  const r7b = await req("GET", "/admin/ads", null, al.data.token);
  check("删除后列表为空", !(r7b.data.data || []).some((a) => a.id === adId));

  console.log("\n=== 验证结果 ===");
  const failed = results.filter((r) => !r.ok);
  console.log(`总计 ${results.length} 项：${results.length - failed.length} 通过，${failed.length} 失败`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error("FATAL:", e.message); process.exit(2); });
