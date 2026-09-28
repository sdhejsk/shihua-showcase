const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { getPool, closeDatabase } = require("../server/data-access/database.cjs");

const FIELD_CSV_NAME = "FIELD_FULL_N_A_100000381602.csv";

function normalize(value) {
  return value == null ? "" : String(value).trim();
}

function toNumber(value) {
  const numeric = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

async function insertFields(client, sourceAssetId, rows) {
  const batchSize = 200;
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const values = [];
    const placeholders = batch.map((row, index) => {
      const base = index * 12;
      values.push(
        start + index + 1,
        normalize(row["Field Id"]) || null,
        normalize(row["Field Name"]),
        normalize(row["Country Names"]) || null,
        normalize(row["Basin Name"]) || null,
        normalize(row["Prod Status"]) || null,
        normalize(row["Cur Operator Names"]) || null,
        normalize(row["Cur Contract Block Names"]) || null,
        toNumber(row["Stan Lat In Decimal Deg"] ?? row["Latitude Dec Deg"]),
        toNumber(row["Stan Long In Decimal Deg"] ?? row["Longitude Dec Deg"]),
        JSON.stringify(row),
        sourceAssetId
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}::jsonb, $${base + 12})`;
    });
    await client.query(
      `INSERT INTO shihua.africa_field
        (source_row_number, field_id, field_name, country_name, basin_name, production_status, operator_name, contract_block_names, latitude, longitude, payload, source_asset_id)
       VALUES ${placeholders.join(", ")}`,
      values
    );
  }
}

async function run() {
  const client = await getPool().connect();
  try {
    const assetResult = await client.query(
      "SELECT id, source_path FROM shihua.source_asset WHERE file_name = $1 ORDER BY id DESC LIMIT 1",
      [FIELD_CSV_NAME]
    );
    const asset = assetResult.rows[0];
    if (!asset) throw new Error(`数据库中未登记 ${FIELD_CSV_NAME}`);
    if (!fs.existsSync(asset.source_path)) throw new Error(`原始油气田 CSV 不存在：${asset.source_path}`);

    const rows = parse(fs.readFileSync(asset.source_path, "utf8"), {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      trim: true
    });
    if (!rows.length) throw new Error("原始油气田 CSV 未读取到记录");

    await client.query("BEGIN");
    await client.query("DELETE FROM shihua.africa_field WHERE source_asset_id = $1", [asset.id]);
    await insertFields(client, asset.id, rows);
    await client.query("COMMIT");
    console.log(`经济评价油气田数据已刷新：${rows.length} 条，来源：${path.basename(asset.source_path)}`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await closeDatabase();
  }
}

run().catch(error => {
  console.error(`经济评价字段刷新失败：${error.stack || error.message}`);
  process.exitCode = 1;
});
