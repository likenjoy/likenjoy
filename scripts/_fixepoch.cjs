const fs = require("fs");
const path = "C:/Users/Administrator/Desktop/rwa-exchange/backend/pkg/database/migrate.go";
let c = fs.readFileSync(path, "utf8");

// epochs 表（插在 asset_price_history 前）
const epochsTable = `
		\`CREATE TABLE IF NOT EXISTS epochs (
			id TEXT PRIMARY KEY,
			asset_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'open',
			created_by TEXT NOT NULL DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			closed_at DATETIME NOT NULL DEFAULT '',
			FOREIGN KEY (asset_id) REFERENCES assets(id)
		)\`,`;
const needle = "		`CREATE TABLE IF NOT EXISTS asset_price_history (";
if (!c.includes("epochs (") && c.includes(needle)) {
  c = c.replace(needle, epochsTable + "\n" + needle);
  console.log("epochs table inserted");
}

// trade_orders 兼容旧库：加 epoch_id 列
const alter = `
	// 兼容旧库：trade_orders 补充 epoch_id 列
	if rows3, e3 := db.Query(\`PRAGMA table_info(trade_orders)\`); e3 == nil {
		hasEpoch := false
		for rows3.Next() {
			var cid int
			var name, ctype string
			var notnull, pk int
			var dflt interface{}
			if rows3.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk) == nil && name == "epoch_id" {
				hasEpoch = true
			}
		}
		rows3.Close()
		if !hasEpoch {
			if _, e4 := db.Exec(\`ALTER TABLE trade_orders ADD COLUMN epoch_id TEXT DEFAULT ''\`); e4 != nil {
				log.Printf("WARNING: add trade_orders epoch_id column: %v", e4)
			}
		}
	}
`;
if (!c.includes("epoch_id 列")) {
  // 插在 migration completed 日志前
  c = c.replace('\tlog.Println("Database migration completed successfully")', alter + '\n\tlog.Println("Database migration completed successfully")');
  console.log("epoch_id alter inserted");
}

fs.writeFileSync(path, c, "utf8");
console.log("migrate updated");