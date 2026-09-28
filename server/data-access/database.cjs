const { Pool } = require("pg");

let pool = null;

function getDatabaseUrl() {
  return process.env.DATABASE_URL
    || "postgresql://shihua:shihua_dev_password@localhost:5432/shihua";
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: Number(process.env.DB_POOL_SIZE || 12),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 5000),
      application_name: "shihua-data-platform"
    });
  }
  return pool;
}

async function query(text, values) {
  return getPool().query(text, values);
}

async function withTransaction(work) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function healthcheck() {
  const result = await query("SELECT NOW() AS database_time, PostGIS_Version() AS postgis_version");
  return result.rows[0];
}

async function closeDatabase() {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end();
}

module.exports = {
  getPool,
  query,
  withTransaction,
  healthcheck,
  closeDatabase
};
