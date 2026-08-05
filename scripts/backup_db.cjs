// SQLite 备份脚本：拷贝数据库到 backup/ 目录（带时间戳），保留最近 N 份
// 用法：node scripts/backup_db.cjs [保留份数=14]
// 建议：配合计划任务每日执行（见 docs/BACKUP.md）
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const DB = path.join(__dirname, "..", "backend", "rwa_exchange.db");
const BACKUP_DIR = path.join(__dirname, "..", "backup");
const KEEP = parseInt(process.argv[2] || "14", 10);

(async () => {
  if (!fs.existsSync(DB)) { console.error("数据库不存在:", DB); process.exit(2); }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const dest = path.join(BACKUP_DIR, `rwa_exchange_${ts}.db`);

  // SQLite 在线备份（VACUUM INTO：无需停服，生成一致性快照）
  try {
    const { DatabaseSync } = require("node:sqlite");
    const src = new DatabaseSync(DB, { readOnly: true });
    src.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
    src.close();
  } catch (e) {
    console.error("备份失败:", e.message);
    process.exit(2);
  }

  // 清理旧备份
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".db")).sort().reverse();
  for (const f of files.slice(KEEP)) fs.unlinkSync(path.join(BACKUP_DIR, f));

  console.log(`✅ 备份完成: ${dest} (${(fs.statSync(dest).size / 1e6).toFixed(1)}MB)`);
  console.log(`   保留最近 ${KEEP} 份，当前共 ${files.length} 份`);
})();
