// UI 截图脚本：遍历关键页面截图，供演示/审查
// 用法：node scripts/ui_screenshots.cjs
const puppeteer = require(require("path").join(__dirname, "..", "frontend", "node_modules", "puppeteer-core"));
const fs = require("fs");
const path = require("path");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const OUT_DIR = path.join(__dirname, "..", "screenshots");
const BASE = "http://localhost:3000";

const pages = [
  { path: "/", name: "01-首页" },
  { path: "/login", name: "02-登录" },
  { path: "/dashboard", name: "03-工作台" },
  { path: "/assets", name: "04-资产列表" },
  { path: "/trade", name: "05-交易" },
  { path: "/portfolio", name: "06-持仓(含免gas转账)" },
  { path: "/dividend", name: "07-分红" },
  { path: "/redeem", name: "08-赎回" },
  { path: "/kyc", name: "09-KYC" },
  { path: "/disclosure", name: "10-合规披露" },
  { path: "/admin/fees", name: "11-管理后台-费率" },
  { path: "/admin/investors", name: "12-管理后台-投资者" },
];

(async () => {
  if (!fs.existsSync(EDGE)) { console.error("Edge not found"); process.exit(2); }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const themeId = process.argv[2] || "a"; // 主题：a/b/c
  const tag = themeId === "a" ? "A-金融蓝" : themeId === "b" ? "B-暗黑科技" : "C-浅色极简";
  console.log("主题:", tag);
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900 },
  });

  for (const p of pages) {
    const page = await browser.newPage();
    try {
      await page.goto(BASE + p.path, { waitUntil: "networkidle2", timeout: 30000 });
      // 设置主题并刷新
      await page.evaluate((tid) => { localStorage.setItem("rwa-theme", tid); }, themeId);
      await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
      await new Promise(r => setTimeout(r, 1200));
      const file = path.join(OUT_DIR, `${tag}-${p.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log("OK  " + p.name);
    } catch (e) {
      console.log("ERR " + p.name + " -> " + e.message.slice(0, 80));
    }
    await page.close();
  }

  await browser.close();
  console.log("\n截图完成: " + OUT_DIR);
})().catch(e => { console.error("FATAL:", e.message); process.exit(2); });
