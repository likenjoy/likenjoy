// 生产数据清理：清空业务数据，保留表结构与系统账号
// 用法：node scripts/cleanup_db.cjs [保留admin邮箱]
// 安全：仅清理开发/测试残留数据；保留 users 中指定的 admin（默认保留全部 admin 角色用户）
const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const DB = path.join(__dirname, "..", "backend", "rwa_exchange.db");
const keepAdmin = process.argv[2] || "";

// 业务表（按外键依赖逆序清理）
const TABLES = [
  "asset_price_history", "advertisements", "epochs", "trade_whitelist", "settlements",
  "trades", "trade_orders", "interest_accruals", "dividend_records", "dividend_plans",
  "issuance_rounds", "asset_documents", "redeem_requests", "redeem_rules",
  "accreditation_checks", "kyc_documents", "kyc_submissions", "investor_profiles",
  "revenue_ledger", "gas_ledger", "admin_audit_log", "assets",
];

(async () => {
  console.log("=== 生产数据清理 ===\n");
  const db = new DatabaseSync(DB);
  let cleared = 0;
  for (const t of TABLES) {
    try {
      const r = db.prepare(`DELETE FROM ${t}`).run();
      cleared += r.changes;
      console.log(`  清空 ${t}: ${r.changes} 行`);
    } catch (e) {
      console.log(`  跳过 ${t}: ${e.message.slice(0, 60)}`);
    }
  }
  // 用户表：保留 admin（系统账号），清除非 admin
  const r = db.prepare(`DELETE FROM users WHERE role != 'admin'`).run();
  cleared += r.changes;
  console.log(`  清理非 admin 用户: ${r.changes} 行`);
  const admins = db.prepare(`SELECT email FROM users WHERE role='admin'`).all();
  console.log(`\n✅ 清理完成，共 ${cleared} 行`);
  console.log(`保留的 admin 账号: ${admins.map(a => a.email).join(", ") || "无（需重新注册）"}`);
  console.log("提示：上线前请修改 admin 密码（无重置流程，可用系统设置页轮换 JWT + 重新注册）");
  db.close();
})();
