const fs = require("fs");
const path = require("path");

function loadEnvironmentFile() {
  const filePath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function asBoolean(value, fallback = false) {
  if (value === undefined || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

loadEnvironmentFile();

const postgresPort = Number(process.env.POSTGRES_PORT || 5432);

module.exports = Object.freeze({
  http: {
    port: Number(process.env.PORT || 5173),
    allowLegacyLocalData: asBoolean(process.env.MIGRATION_FALLBACK, false)
  },
  database: {
    url: process.env.DATABASE_URL
      || `postgresql://${process.env.POSTGRES_USER || "shihua"}:${process.env.POSTGRES_PASSWORD || "shihua_dev_password"}@${process.env.POSTGRES_HOST || "localhost"}:${postgresPort}/${process.env.POSTGRES_DB || "shihua"}`,
    poolSize: Number(process.env.DB_POOL_SIZE || 12),
    connectTimeoutMs: Number(process.env.DB_CONNECT_TIMEOUT_MS || 5000)
  },
  objectStore: {
    endpoint: process.env.MINIO_ENDPOINT || "localhost",
    port: Number(process.env.MINIO_PORT || 9000),
    useSSL: asBoolean(process.env.MINIO_USE_SSL, false),
    accessKey: process.env.MINIO_ACCESS_KEY || "shihua",
    secretKey: process.env.MINIO_SECRET_KEY || "shihua_minio_password",
    bucket: process.env.MINIO_BUCKET || "shihua-source-data"
  },
  client: {
    tiandituToken: process.env.TDT_TOKEN || ""
  }
});
