// 无头浏览器端到端测试：遍历全部页面，捕获运行时错误（pageerror）
// 用法：cd frontend && node ../scripts/browser_e2e.cjs
// 依赖：puppeteer-core（已含） + 系统 Edge/Chrome
const path = require("path");
// puppeteer-core 装在 frontend/node_modules（脚本从项目根/scripts 运行均可）
const puppeteer = require(path.join(__dirname, "..", "frontend", "node_modules", "puppeteer-core"));
const EDGE_CANDIDATES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const pages = [
  "/", "/login", "/dashboard", "/portfolio", "/assets", "/trade",
  "/dividend", "/redeem", "/kyc", "/disclosure", "/admin/fees", "/admin/investors",
];

(async () => {
  const exe = EDGE_CANDIDATES.find(p => require("fs").existsSync(p));
  if (!exe) { console.error("未找到浏览器，请安装 Edge/Chrome"); process.exit(2); }
  const browser = await puppeteer.launch({ executablePath: exe, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
  let crash = 0;
  for (const path of pages) {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message.slice(0, 300)));
    try {
      const resp = await page.goto("http://localhost:3000" + path, { waitUntil: "networkidle2", timeout: 45000 });
      await new Promise(r => setTimeout(r, 1200));
      const status = resp ? resp.status() : "?";
      const ok = status === 200 && pageErrors.length === 0;
      if (!ok) crash++;
      console.log(`${ok ? "PASS" : "FAIL"} ${path} -> ${status}${pageErrors.length ? " | pageerror: " + pageErrors[0] : ""}`);
    } catch (e) {
      crash++;
      console.log(`FAIL ${path} -> NAV-ERR ${e.message.slice(0, 120)}`);
    }
    await page.close();
  }
  await browser.close();
  console.log(`\n=== ${pages.length - crash}/${pages.length} 页面无运行时错误 ===`);
  process.exit(crash ? 1 : 0);
})().catch(e => { console.error("FATAL:", e.message); process.exit(2); });
