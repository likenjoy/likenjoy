const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("C:/Users/Administrator/Desktop/rwa-exchange/backend/rwa_exchange.db");
const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%price%'").all();
console.log("price tables:", JSON.stringify(t));
const e = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='epochs'").all();
console.log("epochs table:", JSON.stringify(e));
db.close();