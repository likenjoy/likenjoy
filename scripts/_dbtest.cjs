const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("C:/Users/Administrator/Desktop/rwa-exchange/backend/rwa_exchange.db");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%price%'").all();
console.log("price tables:", JSON.stringify(tables));
const all = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("all tables:", all.map(t => t.name).join(", "));
db.close();