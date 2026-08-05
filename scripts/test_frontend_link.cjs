// 前后端链路联通验证：真实浏览器交互（注册→登录→数据渲染→API 调用无错）
// 验证前端页面从后端 API 拉取真实数据并渲染，收集 console 网络错误
const puppeteer = require(require("path").join(__dirname, "..", "frontend", "node_modules", "puppeteer-core"));
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok: !!ok });
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name}${extra ? " | " + extra : ""}`);
}

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const BASE = "http://localhost:3000";
const API = "http://localhost:8080/api";

(async () => {
  console.log("=== 前后端链路联通验证（真实浏览器交互）===\n");
  const u = Date.now().toString(36);
  const email = "ui_link_" + u + "@test.com";
  const password = "Test123456";

  // 1. 预注册用户（API 层）
  await fetch(API + "/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, role: "investor" }),
  }).catch(() => {});

  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,1000"], defaultViewport: { width: 1440, height: 1000 } });
  const apiErrors = [];

  // 2. Landing 页：广告位从后端渲染
  console.log("[1] Landing 页（广告位 = 后端 /api/ads 数据）");
  const p1 = await browser.newPage();
  p1.on("console", (m) => { if (m.type() === "error") apiErrors.push("landing: " + m.text().slice(0, 100)); });
  p1.on("requestfailed", (r) => apiErrors.push("landing reqfail: " + r.url().slice(0, 80)));
  await p1.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 45000 });
  await new Promise((r) => setTimeout(r, 2500));
  const adText = await p1.evaluate(() => document.body.innerText.includes("招商公告") || document.body.innerText.includes("代币化发行"));
  const heroText = await p1.evaluate(() => document.body.innerText.includes("把真实资产"));
  check("Landing 渲染 Hero 标语", heroText);
  check("Landing 广告位渲染后端数据", adText);
  await p1.screenshot({ path: "screenshots/Link-Landing.png" });
  await p1.close();

  // 3. 登录页 → 真实登录 → 跳转 dashboard
  console.log("[2] 登录 → 仪表盘（后端统计数据 + 净值曲线）");
  const p2 = await browser.newPage();
  p2.on("console", (m) => { if (m.type() === "error") apiErrors.push("login: " + m.text().slice(0, 100)); });
  p2.on("requestfailed", (r) => apiErrors.push("login reqfail: " + r.url().slice(0, 80)));
  await p2.goto(BASE + "/login", { waitUntil: "networkidle2", timeout: 45000 });
  // 切到登录 Tab（默认登录），填表后按回车提交
  await p2.type("input[placeholder='邮箱']", email);
  await p2.type("input[placeholder='密码']", password);
  await p2.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 5000));
  const onDashboard = p2.url().includes("/dashboard");
  check("登录后跳转 /dashboard", onDashboard, p2.url());
  if (onDashboard) {
    const statText = await p2.evaluate(() => document.body.innerText);
    const hasStats = statText.includes("资产总数") || statText.includes("注册用户");
    const hasCanvas = await p2.evaluate(() => !!document.querySelector("canvas"));
    check("仪表盘统计卡渲染后端数据", hasStats);
    check("净值曲线 canvas 已渲染", hasCanvas);
    await p2.screenshot({ path: "screenshots/Link-Dashboard.png" });
  }
  await p2.close();

  // 4. 资产列表：网格卡片真实数据
  console.log("[3] 资产列表（后端 /assets/live 数据）");
  const p3 = await browser.newPage();
  p3.on("console", (m) => { if (m.type() === "error") apiErrors.push("assets: " + m.text().slice(0, 100)); });
  p3.on("requestfailed", (r) => apiErrors.push("assets reqfail: " + r.url().slice(0, 80)));
  await p3.goto(BASE + "/assets", { waitUntil: "networkidle2", timeout: 45000 });
  await new Promise((r) => setTimeout(r, 3000));
  const assetCards = await p3.evaluate(() => {
    // 网格卡片里应有资产名（黄金/Test 等）
    const cards = [...document.querySelectorAll(".ant-card")];
    return cards.filter((c) => c.innerText.includes("$") && c.innerText.length > 40).length;
  });
  check("资产网格卡片渲染（含单价）", assetCards >= 1, "cards=" + assetCards);
  await p3.screenshot({ path: "screenshots/Link-Assets.png" });
  await p3.close();

  // 5. 交易页：Epoch 面板 + 下单卡
  console.log("[4] 交易页（Epoch 面板 + 下单卡）");
  const p4 = await browser.newPage();
  p4.on("console", (m) => { if (m.type() === "error") apiErrors.push("trade: " + m.text().slice(0, 100)); });
  p4.on("requestfailed", (r) => apiErrors.push("trade reqfail: " + r.url().slice(0, 80)));
  await p4.goto(BASE + "/trade", { waitUntil: "networkidle2", timeout: 45000 });
  await new Promise((r) => setTimeout(r, 3000));
  const tradeText = await p4.evaluate(() => document.body.innerText);
  check("下单卡片渲染（买入/卖出）", tradeText.includes("买入") && tradeText.includes("卖出"));
  check("Epoch 面板渲染", tradeText.includes("结算周期") || tradeText.includes("Epoch"));
  await p4.screenshot({ path: "screenshots/Link-Trade.png" });
  await p4.close();

  // 6. 汇总 API 错误
  console.log("[5] 前端 API 错误检查");
  check("无 console 错误/请求失败", apiErrors.length === 0, apiErrors.slice(0, 3).join(" ; "));

  await browser.close();
  console.log("\n=== 验证结果 ===");
  const failed = results.filter((r) => !r.ok);
  console.log(`总计 ${results.length} 项：${results.length - failed.length} 通过，${failed.length} 失败`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error("FATAL:", e.message); process.exit(2); });
