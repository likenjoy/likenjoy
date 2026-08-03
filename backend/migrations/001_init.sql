-- RWA Exchange: Initial Schema
-- PostgreSQL

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'investor',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    phone VARCHAR(50),
    country VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 投资者画像
CREATE TABLE IF NOT EXISTS investor_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    accreditation_type VARCHAR(100),
    net_worth DECIMAL(20,2),
    annual_income DECIMAL(20,2),
    investment_experience VARCHAR(50),
    risk_tolerance VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- KYC 提交
CREATE TABLE IF NOT EXISTS kyc_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    full_name VARCHAR(255),
    id_number VARCHAR(100),
    id_type VARCHAR(50),
    nationality VARCHAR(100),
    residence_country VARCHAR(100),
    source_of_funds VARCHAR(255),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    reject_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- KYC 文档
CREATE TABLE IF NOT EXISTS kyc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES kyc_submissions(id),
    doc_type VARCHAR(100) NOT NULL,
    file_url TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 合格投资者认证
CREATE TABLE IF NOT EXISTS accreditation_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    check_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    result TEXT,
    checked_by UUID REFERENCES users(id),
    checked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 资产表
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issuer_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(50) UNIQUE NOT NULL,
    asset_type VARCHAR(50) NOT NULL,
    underlying_type VARCHAR(100),
    total_supply DECIMAL(30,6) NOT NULL,
    available_supply DECIMAL(30,6) NOT NULL,
    min_investment DECIMAL(20,2),
    max_investment DECIMAL(20,2),
    price_per_token DECIMAL(20,6),
    currency VARCHAR(10) DEFAULT 'HKD',
    contract_address VARCHAR(255),
    chain VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 交易订单
CREATE TABLE IF NOT EXISTS trade_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    asset_id UUID NOT NULL REFERENCES assets(id),
    order_type VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL,
    quantity DECIMAL(30,6) NOT NULL,
    price DECIMAL(20,6),
    filled_quantity DECIMAL(30,6) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ,
    tx_hash VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 持仓表
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    asset_id UUID NOT NULL REFERENCES assets(id),
    quantity DECIMAL(30,6) NOT NULL,
    avg_price DECIMAL(20,6),
    locked_quantity DECIMAL(30,6) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, asset_id)
);

-- 分红计划
CREATE TABLE IF NOT EXISTS dividend_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id),
    schedule_type VARCHAR(50) NOT NULL,
    rate DECIMAL(10,4) NOT NULL,
    payment_cycle VARCHAR(50) NOT NULL,
    next_payment_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 分红记录
CREATE TABLE IF NOT EXISTS dividend_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES dividend_schedules(id),
    user_id UUID NOT NULL REFERENCES users(id),
    asset_id UUID NOT NULL REFERENCES assets(id),
    holding_amount DECIMAL(30,6) NOT NULL,
    rate DECIMAL(10,4) NOT NULL,
    amount DECIMAL(20,6) NOT NULL,
    currency VARCHAR(10) DEFAULT 'HKD',
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    tx_hash VARCHAR(255),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 计息资产
CREATE TABLE IF NOT EXISTS interest_bearings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id),
    user_id UUID NOT NULL REFERENCES users(id),
    principal DECIMAL(30,6) NOT NULL,
    rate DECIMAL(10,4) NOT NULL,
    accrued_start TIMESTAMPTZ NOT NULL,
    last_accrued_at TIMESTAMPTZ NOT NULL,
    accrued_amount DECIMAL(30,6) DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 赎回规则
CREATE TABLE IF NOT EXISTS redeem_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id),
    min_amount DECIMAL(30,6) NOT NULL,
    max_amount DECIMAL(30,6) NOT NULL,
    lockup_period INT DEFAULT 0,
    redeem_fee DECIMAL(10,4) DEFAULT 0,
    allowed_types TEXT[] NOT NULL DEFAULT '{}',
    requires_kyc BOOLEAN DEFAULT TRUE,
    requires_approval BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 赎回申请
CREATE TABLE IF NOT EXISTS redeem_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    asset_id UUID NOT NULL REFERENCES assets(id),
    token_amount DECIMAL(30,6) NOT NULL,
    redeem_type VARCHAR(50) NOT NULL,
    delivery_addr TEXT,
    bank_account VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    reject_reason TEXT,
    tracking_no VARCHAR(255),
    tx_hash VARCHAR(255),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 实物交割
CREATE TABLE IF NOT EXISTS physical_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    redeem_request_id UUID NOT NULL REFERENCES redeem_requests(id),
    carrier VARCHAR(255) NOT NULL,
    tracking_no VARCHAR(255),
    pickup_addr TEXT NOT NULL,
    delivery_addr TEXT NOT NULL,
    estimated_days INT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending_pickup',
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user ON kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status ON kyc_submissions(status);
CREATE INDEX IF NOT EXISTS idx_assets_issuer ON assets(issuer_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_trade_orders_user ON trade_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_orders_asset ON trade_orders(asset_id);
CREATE INDEX IF NOT EXISTS idx_trade_orders_status ON trade_orders(status);
CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_dividend_records_user ON dividend_records(user_id);
CREATE INDEX IF NOT EXISTS idx_dividend_records_asset ON dividend_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_redeem_requests_user ON redeem_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_redeem_requests_status ON redeem_requests(status);
CREATE INDEX IF NOT EXISTS idx_physical_deliveries_request ON physical_deliveries(redeem_request_id);
