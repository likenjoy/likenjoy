const fs = require("fs");
const path = "C:/Users/Administrator/Desktop/rwa-exchange/backend/pkg/database/migrate.go";
let lines = fs.readFileSync(path, "utf8").split("\n");
// 找 asset_price_history 块（0-indexed）
let start = lines.findIndex(l => l.includes("asset_price_history"));
console.log("found at line:", start + 1);
if (start >= 0) {
  // 修正起始行：补反引号
  lines[start] = "\t\t`CREATE TABLE IF NOT EXISTS asset_price_history (";
  // 找到该块的结束行（下一个 `)` 或 `);`）
  let end = start;
  for (let i = start; i < lines.length; i++) {
    if (lines[i].includes("FOREIGN KEY (asset_id) REFERENCES assets(id)")) { end = i + 1; break; }
  }
  lines[end] = "\t\t)`,";
  console.log("end line:", end + 1, "->", lines[end]);
}
fs.writeFileSync(path, lines.join("\n"), "utf8");
console.log("fixed");