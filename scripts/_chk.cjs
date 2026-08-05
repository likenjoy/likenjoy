const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("C:/Users/Administrator/Desktop/rwa-exchange/backend/rwa_exchange.db");
const a = db.prepare("SELECT id, name FROM assets LIMIT 1").get();
const cnt = db.prepare("SELECT COUNT(*) c FROM asset_price_history").get().c;
console.log("first asset:", a ? a.name + " " + a.id : "none", "| total history points:", cnt);
db.close();