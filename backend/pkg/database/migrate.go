package database

import (
	"database/sql"
	"log"
)

func MigrateSQLite(db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			phone TEXT DEFAULT '',
			role TEXT NOT NULL DEFAULT 'investor',
			status TEXT NOT NULL DEFAULT 'pending',
			wallet_address TEXT DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS investor_profiles (
			user_id TEXT PRIMARY KEY,
			full_name TEXT NOT NULL DEFAULT '',
			nationality TEXT NOT NULL DEFAULT '',
			id_type TEXT NOT NULL DEFAULT '',
			id_number TEXT NOT NULL DEFAULT '',
			accreditation_level TEXT NOT NULL DEFAULT 'individual',
			net_worth_tier TEXT NOT NULL DEFAULT '',
			risk_score INTEGER NOT NULL DEFAULT 0,
			FOREIGN KEY (user_id) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS kyc_documents (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			doc_type TEXT NOT NULL,
			file_name TEXT NOT NULL,
			file_hash TEXT NOT NULL DEFAULT '',
			uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS kyc_submissions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'not_submitted',
			submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			reviewed_at DATETIME,
			reviewed_by TEXT,
			reject_reason TEXT DEFAULT '',
			FOREIGN KEY (user_id) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS accreditation_checks (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL UNIQUE,
			level TEXT NOT NULL DEFAULT 'individual',
			net_worth_proof TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'not_submitted',
			checked_at DATETIME,
			checked_by TEXT,
			expires_at DATETIME NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS assets (
			id TEXT PRIMARY KEY,
			issuer_id TEXT NOT NULL,
			name TEXT NOT NULL,
			symbol TEXT NOT NULL UNIQUE,
			asset_type TEXT NOT NULL,
			description TEXT DEFAULT '',
			total_supply TEXT NOT NULL,
			price_per_unit TEXT NOT NULL,
			currency TEXT DEFAULT 'HKD',
			min_investment TEXT NOT NULL,
			max_investment TEXT DEFAULT '',
			lockup_period INTEGER DEFAULT 0,
			contract_address TEXT DEFAULT '',
			chain_id INTEGER DEFAULT 42161,
			status TEXT DEFAULT 'draft',
			metadata_uri TEXT DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (issuer_id) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS asset_documents (
			id TEXT PRIMARY KEY,
			asset_id TEXT NOT NULL,
			doc_type TEXT NOT NULL,
			file_name TEXT NOT NULL,
			file_hash TEXT DEFAULT '',
			file_url TEXT DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (asset_id) REFERENCES assets(id)
		)`,
		`CREATE TABLE IF NOT EXISTS issuance_rounds (
			id TEXT PRIMARY KEY,
			asset_id TEXT NOT NULL,
			round_number INTEGER NOT NULL,
			supply TEXT NOT NULL,
			price_per_unit TEXT NOT NULL,
			start_time DATETIME NOT NULL,
			end_time DATETIME NOT NULL,
			min_alloc TEXT DEFAULT '',
			max_alloc TEXT DEFAULT '',
			sold TEXT DEFAULT '0',
			status TEXT DEFAULT 'upcoming',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (asset_id) REFERENCES assets(id)
		)`,
		`CREATE TABLE IF NOT EXISTS trade_orders (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			asset_id TEXT NOT NULL,
			round_id TEXT,
			side TEXT NOT NULL,
			order_type TEXT NOT NULL,
			price TEXT DEFAULT '',
			quantity TEXT NOT NULL,
			filled_qty TEXT DEFAULT '0',
			total_amount TEXT DEFAULT '',
			status TEXT DEFAULT 'pending',
			expires_at DATETIME,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id),
			FOREIGN KEY (asset_id) REFERENCES assets(id)
		)`,
		`CREATE TABLE IF NOT EXISTS trades (
			id TEXT PRIMARY KEY,
			buy_order_id TEXT NOT NULL,
			sell_order_id TEXT NOT NULL,
			asset_id TEXT NOT NULL,
			price TEXT NOT NULL,
			quantity TEXT NOT NULL,
			amount TEXT NOT NULL,
			buyer_id TEXT NOT NULL,
			seller_id TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (asset_id) REFERENCES assets(id)
		)`,
		`CREATE TABLE IF NOT EXISTS settlements (
			id TEXT PRIMARY KEY,
			trade_id TEXT NOT NULL UNIQUE,
			asset_id TEXT NOT NULL,
			buyer_id TEXT NOT NULL,
			seller_id TEXT NOT NULL,
			quantity TEXT NOT NULL,
			amount TEXT NOT NULL,
			currency TEXT DEFAULT 'HKD',
			tx_hash TEXT DEFAULT '',
			status TEXT DEFAULT 'pending',
			settled_at DATETIME,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (trade_id) REFERENCES trades(id),
			FOREIGN KEY (asset_id) REFERENCES assets(id)
		)`,
		`CREATE TABLE IF NOT EXISTS trade_whitelist (
			id TEXT PRIMARY KEY,
			asset_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			added_by TEXT NOT NULL,
			expires_at DATETIME,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (asset_id) REFERENCES assets(id),
			FOREIGN KEY (user_id) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS dividend_plans (
			id TEXT PRIMARY KEY,
			asset_id TEXT NOT NULL,
			name TEXT NOT NULL,
			type TEXT NOT NULL,
			rate REAL NOT NULL,
			frequency TEXT NOT NULL,
			start_date DATETIME NOT NULL,
			end_date DATETIME,
			next_pay_date DATETIME,
			total_periods INTEGER NOT NULL DEFAULT 0,
			paid_periods INTEGER NOT NULL DEFAULT 0,
			status TEXT DEFAULT 'pending',
			created_by TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (asset_id) REFERENCES assets(id)
		)`,
		`CREATE TABLE IF NOT EXISTS dividend_records (
			id TEXT PRIMARY KEY,
			plan_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			asset_id TEXT NOT NULL,
			period_num INTEGER NOT NULL,
			amount REAL NOT NULL,
			holding_amount REAL NOT NULL,
			rate REAL NOT NULL,
			status TEXT DEFAULT 'pending',
			paid_at DATETIME,
			tx_hash TEXT DEFAULT '',
			remark TEXT DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (plan_id) REFERENCES dividend_plans(id),
			FOREIGN KEY (user_id) REFERENCES users(id),
			FOREIGN KEY (asset_id) REFERENCES assets(id)
		)`,
		`CREATE TABLE IF NOT EXISTS interest_accruals (
			id TEXT PRIMARY KEY,
			plan_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			asset_id TEXT NOT NULL,
			principal REAL NOT NULL,
			accrued_amount REAL NOT NULL DEFAULT 0,
			paid_amount REAL NOT NULL DEFAULT 0,
			last_accrual_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (plan_id) REFERENCES dividend_plans(id),
			FOREIGN KEY (user_id) REFERENCES users(id),
			FOREIGN KEY (asset_id) REFERENCES assets(id)
		)`,
		`CREATE TABLE IF NOT EXISTS redeem_requests (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			asset_id TEXT NOT NULL,
			type TEXT NOT NULL,
			amount REAL NOT NULL,
			unit TEXT NOT NULL,
			price_per_unit REAL DEFAULT 0,
			total_value REAL NOT NULL,
			fee REAL DEFAULT 0,
			net_amount REAL DEFAULT 0,
			status TEXT DEFAULT 'pending',
			delivery_method TEXT DEFAULT '',
			delivery_address TEXT DEFAULT '',
			tracking_number TEXT DEFAULT '',
			tx_hash TEXT DEFAULT '',
			approved_by TEXT,
			approved_at DATETIME,
			completed_at DATETIME,
			remark TEXT DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id),
			FOREIGN KEY (asset_id) REFERENCES assets(id)
		)`,
		`CREATE TABLE IF NOT EXISTS redeem_rules (
			id TEXT PRIMARY KEY,
			asset_id TEXT NOT NULL UNIQUE,
			min_amount REAL NOT NULL,
			max_amount REAL,
			lock_period_days INTEGER DEFAULT 0,
			fee_rate REAL DEFAULT 0,
			allow_physical INTEGER DEFAULT 0,
			allow_cash INTEGER DEFAULT 1,
			physical_min_unit REAL DEFAULT 0,
			processing_days INTEGER DEFAULT 3,
			is_active INTEGER DEFAULT 1,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (asset_id) REFERENCES assets(id)
		)`,
		`CREATE TABLE IF NOT EXISTS platform_fees (
			id TEXT PRIMARY KEY,
			mint_fee_rate INTEGER NOT NULL DEFAULT 100,
			transfer_fee_rate INTEGER NOT NULL DEFAULT 0,
			gas_markup_rate INTEGER NOT NULL DEFAULT 0,
			treasury_address TEXT NOT NULL DEFAULT '',
			updated_by TEXT NOT NULL DEFAULT '',
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS revenue_ledger (
			id TEXT PRIMARY KEY,
			category TEXT NOT NULL,
			asset_id TEXT DEFAULT '',
			user_id TEXT DEFAULT '',
			amount TEXT NOT NULL DEFAULT '0',
			currency TEXT NOT NULL DEFAULT 'HKD',
			tx_hash TEXT DEFAULT '',
			gas_used_wei TEXT DEFAULT '0',
			detail TEXT DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS gas_ledger (
			id TEXT PRIMARY KEY,
			tx_hash TEXT NOT NULL,
			chain_id INTEGER NOT NULL DEFAULT 31337,
			action TEXT NOT NULL,
			asset_id TEXT DEFAULT '',
			user_id TEXT DEFAULT '',
			gas_used_wei TEXT NOT NULL DEFAULT '0',
			gas_price_wei TEXT NOT NULL DEFAULT '0',
			cost_wei TEXT NOT NULL DEFAULT '0',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS admin_audit_log (
			id TEXT PRIMARY KEY,
			admin_id TEXT NOT NULL,
			action TEXT NOT NULL,
			target TEXT DEFAULT '',
			detail TEXT DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_accreditation_user ON accreditation_checks(user_id)`,
	}

	// 兼容旧库：为已存在的 users 表补充 wallet_address 列
	var cols []string
	rows, err := db.Query(`PRAGMA table_info(users)`)
	if err == nil {
		for rows.Next() {
			var cid int
			var name, ctype string
			var notnull, pk int
			var dflt interface{}
			if rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk) == nil {
				cols = append(cols, name)
			}
		}
		rows.Close()
	}
	if err == nil {
		found := false
		for _, c := range cols {
			if c == "wallet_address" {
				found = true
				break
			}
		}
		if !found {
			if _, e := db.Exec(`ALTER TABLE users ADD COLUMN wallet_address TEXT DEFAULT ''`); e != nil {
				log.Printf("WARNING: add wallet_address column: %v", e)
			}
		}
	}


	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	log.Println("Database migration completed successfully")
	return nil
}
