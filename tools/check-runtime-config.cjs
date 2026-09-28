#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const config = require("../server/config.cjs");
const { healthcheck, closeDatabase } = require("../server/data-access/database.cjs");
const { ensureBucket } = require("../server/data-access/object-store.cjs");

const root = path.resolve(__dirname, "..");
const verifyMigrationSource = process.argv.includes("--migration");
let failed = false;

function report(name, ok, detail) {
  console.log(`${ok ? "OK" : "FAIL"}  ${name}: ${detail}`);
  if (!ok) failed = true;
}

function resolveProjectPath(value) {
  return path.resolve(root, value || "");
}

async function run() {
  report("HTTP port", Number.isInteger(config.http.port) && config.http.port > 0, String(config.http.port));
  report("PostgreSQL URL", Boolean(config.database.url), "configured");
  report("MinIO endpoint", Boolean(config.objectStore.endpoint), `${config.objectStore.endpoint}:${config.objectStore.port}`);
  report("MinIO bucket", Boolean(config.objectStore.bucket), config.objectStore.bucket || "not configured");
  report("TianDiTu token", Boolean(config.client.tiandituToken), config.client.tiandituToken ? "configured" : "not configured");

  const postgresDataDir = resolveProjectPath(process.env.POSTGRES_DATA_DIR || "runtime-data/postgres");
  const minioDataDir = resolveProjectPath(process.env.MINIO_DATA_DIR || "runtime-data/minio");
  report("PostgreSQL data directory", fs.existsSync(postgresDataDir), postgresDataDir);
  report("MinIO data directory", fs.existsSync(minioDataDir), minioDataDir);

  if (verifyMigrationSource) {
    const sourceRoot = String(process.env.SHIHUA_SOURCE_ROOT || "").trim();
    report("Migration source directory", Boolean(sourceRoot) && fs.existsSync(sourceRoot), sourceRoot || "not configured");
  }

  try {
    const database = await healthcheck();
    report("PostgreSQL/PostGIS connection", Boolean(database.postgis_version), database.postgis_version || "PostGIS unavailable");
  } catch (error) {
    report("PostgreSQL/PostGIS connection", false, error.message);
  }

  try {
    const bucket = await ensureBucket();
    report("MinIO connection", true, bucket);
  } catch (error) {
    report("MinIO connection", false, error.message);
  }
}

run()
  .catch(error => {
    report("Configuration check", false, error.message);
  })
  .finally(async () => {
    await closeDatabase();
    process.exitCode = failed ? 1 : 0;
  });
