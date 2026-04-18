const { Pool } = require('pg');

// Connection pool — handles concurrent webhooks safely
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,                // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

// Simple query helper
const query = (sql, params = []) => pool.query(sql, params);

// Initialize all tables
const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        agent_id TEXT NOT NULL,
        agent_name TEXT,
        status TEXT DEFAULT 'draft',
        from_phone_number TEXT,
        scheduled_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        webhook_url TEXT,
        batch_id TEXT,
        retry_config JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        contact_number TEXT NOT NULL,
        name TEXT,
        extra_data JSONB DEFAULT '{}',
        status TEXT DEFAULT 'pending',
        execution_id TEXT,
        call_duration INTEGER DEFAULT 0,
        call_cost REAL DEFAULT 0,
        hangup_reason TEXT,
        error_message TEXT,
        called_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS call_logs (
        id TEXT PRIMARY KEY,
        campaign_id TEXT,
        execution_id TEXT,
        status TEXT,
        event_data JSONB DEFAULT '{}',
        received_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS billing (
        id TEXT PRIMARY KEY,
        campaign_id TEXT,
        execution_id TEXT,
        contact_number TEXT,
        duration_seconds INTEGER DEFAULT 0,
        bolna_cost REAL DEFAULT 0,
        platform_cost REAL DEFAULT 0,
        total_cost REAL DEFAULT 0,
        cost_breakdown JSONB DEFAULT '{}',
        billed_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subaccounts (
        id TEXT PRIMARY KEY,
        bolna_sub_account_id TEXT,
        bolna_api_key TEXT,
        name TEXT NOT NULL,
        email TEXT,
        concurrency INTEGER DEFAULT 5,
        total_calls INTEGER DEFAULT 0,
        total_cost REAL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Indexes for performance at scale
      CREATE INDEX IF NOT EXISTS idx_contacts_campaign_id ON contacts(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
      CREATE INDEX IF NOT EXISTS idx_contacts_execution_id ON contacts(execution_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_contact_number ON contacts(contact_number);
      CREATE INDEX IF NOT EXISTS idx_call_logs_campaign_id ON call_logs(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_billing_campaign_id ON billing(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_billing_billed_at ON billing(billed_at);
      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);
    `);
    console.log('✅ PostgreSQL database initialized');
  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
    throw err;
  } finally {
    client.release();
  }
};

// prepare() API — matches existing route usage
// Returns an object with run/get/all methods
const prepare = (sql) => {
  // Convert SQLite ? placeholders to PostgreSQL $1, $2, ...
  const toPg = (sqlStr, args) => {
    let i = 0;
    const pgSql = sqlStr.replace(/\?/g, () => `$${++i}`);
    return { pgSql, args };
  };

  return {
    run: async (...params) => {
      const { pgSql, args } = toPg(sql, params);
      const result = await pool.query(pgSql, args);
      return { rowCount: result.rowCount };
    },
    get: async (...params) => {
      const { pgSql, args } = toPg(sql, params);
      const result = await pool.query(pgSql, args);
      return result.rows[0] || null;
    },
    all: async (...params) => {
      const { pgSql, args } = toPg(sql, params);
      const result = await pool.query(pgSql, args);
      return result.rows;
    },
  };
};

// Initialize on startup
initDB().catch((err) => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});

module.exports = { prepare, query, pool };
