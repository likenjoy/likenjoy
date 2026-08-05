const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("C:/Users/Administrator/Desktop/rwa-exchange/backend/rwa_exchange.db");
// 为"黄金一号"和其他主要资产种 30 天价格历史（演示曲线）
const assets = db.prepare("SELECT id, price_per_unit FROM assets").all();
const crypto = require("crypto");
let n = 0;
for (const a of assets.slice(0, 3)) {
  const base = parseFloat(a.price_per_unit) || 10;
  const cnt = db.prepare("SELECT COUNT(*) c FROM asset_price_history WHERE asset_id = ?").get(a.id).c;
  if (cnt > 0) continue;
  for (let i = 29; i >= 0; i--) {
    const drift = (Math.random() - 0.42) * 0.012; // 温和上行
    const price = base * (1 + (29 - i) * 0.002 + drift * (30 - i) * 0.5);
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10) + " " + new Date(Date.now() - i * 86400000).toTimeString().slice(0, 8);
    db.prepare("INSERT INTO asset_price_history (id, asset_id, price, recorded_at) VALUES (?, ?, ?, ?)")
      .run(crypto.randomUUID(), a.id, price.toFixed(2), date);
    n++;
  }
}
console.log("seeded", n, "price points");
db.close();