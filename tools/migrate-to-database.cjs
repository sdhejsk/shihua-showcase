#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const shapefile = require("shapefile");
const XLSX = require("xlsx");
const { getPool, closeDatabase } = require("../server/data-access/database.cjs");
const { uploadFile } = require("../server/data-access/object-store.cjs");

const ROOT = path.resolve(__dirname, "..");
const LOCAL_DATA_ROOT = path.join(ROOT, "data");
const SOURCE_DATA_ROOT = path.resolve(process.env.SHIHUA_SOURCE_ROOT || "D:\\shihua_data");
const args = new Set(process.argv.slice(2));
const uploadOnly = args.has("--upload-only");
const uploadObjects = args.has("--upload-objects") || uploadOnly;
const skipHash = args.has("--skip-hash");
const dryRun = args.has("--dry-run");
const batchId = crypto.randomUUID();

const MIME_TYPES = {
  ".csv": "text/csv",
  ".dbf": "application/octet-stream",
  ".geojson": "application/geo+json",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".shp": "application/octet-stream",
  ".svg": "image/svg+xml",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

const SETTINGS = [
  ["structure_base_table", "structure_base_table.json"],
  ["system_overview", "system_overview.json"],
  ["map_service_config", "map_service_config.json"],
  ["data_inventory", "data_inventory.json"],
  ["regional_story", "regional_story_africa.json"],
  ["evaluation_models", "evaluation_models.json"]
];

const ENTITY_DATASETS = [
  { entityType: "well", fileName: "well_excel_profiles.json", profilesOnly: true },
  { entityType: "well", fileName: "well_integrated_tables.json" },
  { entityType: "basin", fileName: "basin_integrated_tables.json" },
  { entityType: "block", fileName: "block_integrated_tables.json" },
  { entityType: "contract", fileName: "contract_integrated_tables.json" },
  { entityType: "field", fileName: "field_integrated_tables.json" }
];

const SPATIAL_LAYERS = [
  { relativePath: "Africa/Africa Basins-2025/African Basins-2025.shp", layerKey: "basins", nameKeys: ["BASIN_NAME", "basin_name", "NAME"] },
  { relativePath: "Africa/04-非洲合同区块-2478个/Africa Contract Blocks.shp", layerKey: "contract_blocks", nameKeys: ["BLOCK_NAME", "block_name", "CON_BLK_NM", "CONTRACT"] },
  { relativePath: "Africa/非洲油气田-4567个/Fields_poly.shp", layerKey: "fields", nameKeys: ["FIELD_NAME", "field_name", "NAME"] },
  { relativePath: "Africa/非洲钻井-2025/Wells_point.shp", layerKey: "wells", nameKeys: ["WELL_NAME", "well_name", "NAME"] }
];
const ECONOMIC_FIELD_CSV_NAME = "FIELD_FULL_N_A_100000381602.csv";

function printUsage() {
  console.log("Usage: node tools/migrate-to-database.cjs [--upload-objects|--upload-only] [--skip-hash] [--dry-run]");
}

function normalize(value) {
  return value == null ? "" : String(value).trim();
}

function pickValue(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return "";
}

function toNumber(value) {
  const numeric = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function extensionOf(filePath) {
  return path.extname(filePath).toLowerCase();
}

function mediaTypeFor(filePath) {
  return MIME_TYPES[extensionOf(filePath)] || "application/octet-stream";
}

function objectKeyFor(relativePath) {
  return `source/${relativePath.replace(/\\/g, "/").split("/").map(encodeURIComponent).join("/")}`;
}

function getShapefileSrid(shpPath) {
  const prjPath = shpPath.replace(/\.shp$/i, ".prj");
  if (!fs.existsSync(prjPath)) return 4326;
  const wkt = fs.readFileSync(prjPath, "utf8");
  if (/Web_Mercator|Mercator_Auxiliary_Sphere|3857/i.test(wkt)) return 3857;
  return 4326;
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", chunk => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function walkFiles(rootPath) {
  if (!fs.existsSync(rootPath)) return [];
  const files = [];
  const walk = current => {
    fs.readdirSync(current, { withFileTypes: true }).forEach(entry => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile()) files.push(fullPath);
    });
  };
  walk(rootPath);
  return files;
}

async function upsertSourceAsset(client, sourceRoot, filePath) {
  const stat = fs.statSync(filePath);
  const relativePath = path.relative(sourceRoot, filePath).replace(/\\/g, "/");
  const sourcePath = path.resolve(filePath);
  const sha256 = skipHash ? null : await sha256File(filePath);
  const objectKey = objectKeyFor(relativePath);
  let storageStatus = "metadata_only";

  if (uploadObjects) {
    const existing = !dryRun && uploadOnly
      ? await client.query("SELECT storage_status FROM shihua.source_asset WHERE source_path = $1", [sourcePath])
      : null;
    if (existing?.rows[0]?.storage_status === "uploaded") {
      storageStatus = "uploaded";
    } else {
      await uploadFile(objectKey, filePath, stat.size, {
        "content-type": mediaTypeFor(filePath),
        "source-sha256": sha256 || ""
      });
      storageStatus = "uploaded";
    }
  }

  if (dryRun) {
    return { id: null, sourcePath, relativePath, objectKey, sizeBytes: stat.size, storageStatus };
  }

  const result = await client.query(
    `INSERT INTO shihua.source_asset
       (import_batch_id, source_path, relative_path, file_name, media_type, file_extension, size_bytes, sha256, object_key, storage_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (source_path) DO UPDATE SET
       import_batch_id = EXCLUDED.import_batch_id,
       relative_path = EXCLUDED.relative_path,
       file_name = EXCLUDED.file_name,
       media_type = EXCLUDED.media_type,
       file_extension = EXCLUDED.file_extension,
       size_bytes = EXCLUDED.size_bytes,
       sha256 = COALESCE(EXCLUDED.sha256, shihua.source_asset.sha256),
       object_key = EXCLUDED.object_key,
       storage_status = EXCLUDED.storage_status,
       updated_at = NOW()
     RETURNING id`,
    [batchId, sourcePath, relativePath, path.basename(filePath), mediaTypeFor(filePath), extensionOf(filePath), stat.size, sha256, objectKey, storageStatus]
  );
  return { id: result.rows[0].id, sourcePath, relativePath, objectKey, sizeBytes: stat.size, storageStatus };
}

async function insertRows(client, statementPrefix, rows, valuesForRow, valuesPerRow, suffix = "", chunkSize = 250) {
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const values = [];
    const placeholders = chunk.map((row, rowIndex) => {
      const base = rowIndex * valuesPerRow;
      values.push(...valuesForRow(row));
      return `(${Array.from({ length: valuesPerRow }, (_, index) => `$${base + index + 1}`).join(", ")})`;
    });
    await client.query(`${statementPrefix} VALUES ${placeholders.join(", ")} ${suffix}`, values);
  }
}

async function importSetting(client, settingKey, fileName, assets) {
  const filePath = path.join(LOCAL_DATA_ROOT, fileName);
  if (!fs.existsSync(filePath)) return;
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const asset = assets.get(path.resolve(filePath));
  if (dryRun) return;
  await client.query(
    `INSERT INTO shihua.app_setting (setting_key, setting_value, source_asset_id)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, source_asset_id = EXCLUDED.source_asset_id, updated_at = NOW()`,
    [settingKey, JSON.stringify(payload), asset?.id || null]
  );
}

async function importEntityDataset(client, config, assets) {
  const filePath = path.join(LOCAL_DATA_ROOT, config.fileName);
  if (!fs.existsSync(filePath)) return;
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const assetId = assets.get(path.resolve(filePath))?.id || null;
  const profiles = payload.profiles || (config.profilesOnly ? payload : {});
  const tables = payload.tables || {};
  if (dryRun) return;

  for (const [entityKey, profile] of Object.entries(profiles)) {
    if (!profile || typeof profile !== "object") continue;
    await client.query(
      `INSERT INTO shihua.entity_profile (entity_type, entity_key, profile, source_asset_id)
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (entity_type, entity_key) DO UPDATE SET profile = EXCLUDED.profile, source_asset_id = EXCLUDED.source_asset_id, updated_at = NOW()`,
      [config.entityType, entityKey, JSON.stringify(profile), assetId]
    );
  }

  for (const [entityKey, tablesPayload] of Object.entries(tables)) {
    await client.query(
      `INSERT INTO shihua.entity_detail (entity_type, entity_key, detail_key, payload, source_asset_id)
       VALUES ($1, $2, 'tables', $3::jsonb, $4)
       ON CONFLICT (entity_type, entity_key, detail_key) DO UPDATE SET payload = EXCLUDED.payload, source_asset_id = EXCLUDED.source_asset_id, updated_at = NOW()`,
      [config.entityType, entityKey, JSON.stringify(tablesPayload || {}), assetId]
    );
  }
}

async function importWellLogs(client, assets) {
  const filePath = path.join(LOCAL_DATA_ROOT, "well_logs.csv");
  if (!fs.existsSync(filePath)) return;
  const rows = parse(fs.readFileSync(filePath, "utf8"), { columns: true, skip_empty_lines: true, trim: true });
  const assetId = assets.get(path.resolve(filePath))?.id || null;
  if (dryRun) return;
  await client.query("DELETE FROM shihua.well_log_measurement WHERE source_asset_id IS NOT DISTINCT FROM $1", [assetId]);
  await insertRows(
    client,
    "INSERT INTO shihua.well_log_measurement (well_id, well_name, depth_m, payload, source_asset_id)",
    rows,
    row => [row.well_id || null, row.well_name, toNumber(row.depth_m), JSON.stringify(row), assetId],
    5,
    "ON CONFLICT (source_asset_id, well_name, depth_m) DO UPDATE SET payload = EXCLUDED.payload, well_id = EXCLUDED.well_id"
  );
}

async function importAfricaIndex(client, assets) {
  const indexPath = path.join(LOCAL_DATA_ROOT, "africa_integrated_index.json");
  if (!fs.existsSync(indexPath)) return;
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const metadata = { ...index };
  metadata.tables = Object.fromEntries(Object.entries(index.tables || {}).map(([key, value]) => {
    const copy = { ...(value || {}) };
    delete copy.records;
    return [key, copy];
  }));
  delete metadata.pdfIndex;

  const indexAssetId = assets.get(path.resolve(indexPath))?.id || null;
  const fieldSourcePath = index.sourceFiles?.fieldTable?.path ? path.resolve(index.sourceFiles.fieldTable.path) : null;
  const wellSourcePath = index.sourceFiles?.wellTable?.path ? path.resolve(index.sourceFiles.wellTable.path) : null;
  const rawFieldAsset = [...assets.values()].find(asset => path.basename(asset.sourcePath) === ECONOMIC_FIELD_CSV_NAME);
  const rawFieldPath = rawFieldAsset?.sourcePath || fieldSourcePath;
  const fieldAssetId = rawFieldAsset?.id || assets.get(fieldSourcePath)?.id || indexAssetId;
  const wellAssetId = assets.get(wellSourcePath)?.id || indexAssetId;
  const rawFieldRows = rawFieldPath && fs.existsSync(rawFieldPath)
    ? parse(fs.readFileSync(rawFieldPath, "utf8"), { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true, trim: true })
    : null;
  const fields = (rawFieldRows || index.tables?.fields?.records || []).map((payload, index) => ({ rowNumber: index + 1, payload }));
  const wells = (index.tables?.wells?.records || []).map((payload, index) => ({ rowNumber: index + 1, payload }));
  if (dryRun) return;

  await client.query(
    `INSERT INTO shihua.app_setting (setting_key, setting_value, source_asset_id)
     VALUES ('africa_index_metadata', $1::jsonb, $2)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, source_asset_id = EXCLUDED.source_asset_id, updated_at = NOW()`,
    [JSON.stringify(metadata), indexAssetId]
  );
  await client.query("DELETE FROM shihua.africa_field WHERE source_asset_id IS NOT DISTINCT FROM $1", [fieldAssetId]);
  await client.query("DELETE FROM shihua.africa_well WHERE source_asset_id IS NOT DISTINCT FROM $1", [wellAssetId]);

  await insertRows(
    client,
    "INSERT INTO shihua.africa_field (source_row_number, field_id, field_name, country_name, basin_name, production_status, operator_name, contract_block_names, latitude, longitude, payload, source_asset_id)",
    fields,
    row => [
      row.rowNumber,
      normalize(row.payload["Field Id"] ?? row.payload.fieldId) || null,
      normalize(row.payload["Field Name"] ?? row.payload.name),
      normalize(row.payload["Country Names"] ?? row.payload.country) || null,
      normalize(row.payload["Basin Name"] ?? row.payload.basin) || null,
      normalize(row.payload["Prod Status"] ?? row.payload.status) || null,
      normalize(row.payload["Cur Operator Names"] ?? row.payload.operator) || null,
      normalize(row.payload["Cur Contract Block Names"] ?? row.payload.block) || null,
      toNumber(row.payload["Stan Lat In Decimal Deg"] ?? row.payload["Latitude Dec Deg"] ?? row.payload.latitude),
      toNumber(row.payload["Stan Long In Decimal Deg"] ?? row.payload["Longitude Dec Deg"] ?? row.payload.longitude),
      JSON.stringify(row.payload),
      fieldAssetId
    ],
    12,
    "ON CONFLICT (source_asset_id, source_row_number) DO UPDATE SET payload = EXCLUDED.payload, field_name = EXCLUDED.field_name, country_name = EXCLUDED.country_name, basin_name = EXCLUDED.basin_name, production_status = EXCLUDED.production_status, operator_name = EXCLUDED.operator_name, contract_block_names = EXCLUDED.contract_block_names, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude"
  );

  await insertRows(
    client,
    "INSERT INTO shihua.africa_well (source_row_number, well_id, well_name, country_name, basin_name, block_name, field_name, operator_name, technical_status, latitude, longitude, payload, source_asset_id)",
    wells,
    row => [
      row.rowNumber,
      normalize(row.payload["WEL_ID"] ?? row.payload.wel_id ?? row.payload["Well Id"]) || null,
      normalize(row.payload["WELL_NAME"] ?? row.payload.well_name ?? row.payload["Well Name"]),
      normalize(row.payload.COUNTRY ?? row.payload.country ?? row.payload["Country Names"]) || null,
      normalize(row.payload.BASIN_NAME ?? row.payload.basin_name ?? row.payload["Basin Name"]) || null,
      normalize(row.payload.BLOCK_NAME ?? row.payload.block_name ?? row.payload["Block Name"]) || null,
      normalize(row.payload.FIELD_NAME ?? row.payload.field_name ?? row.payload["Field Name"]) || null,
      normalize(row.payload.OPERATOR ?? row.payload.operator ?? row.payload["Operator Name"]) || null,
      normalize(row.payload.TCH_STAT ?? row.payload.technical_status ?? row.payload["Technical Status"]) || null,
      toNumber(row.payload.LAT_DEC ?? row.payload.lat_dec ?? row.payload["Latitude Dec Deg"]),
      toNumber(row.payload.LONG_DEC ?? row.payload.long_dec ?? row.payload["Longitude Dec Deg"]),
      JSON.stringify(row.payload),
      wellAssetId
    ],
    13,
    "ON CONFLICT (source_asset_id, source_row_number) DO UPDATE SET payload = EXCLUDED.payload, well_name = EXCLUDED.well_name, country_name = EXCLUDED.country_name, basin_name = EXCLUDED.basin_name, block_name = EXCLUDED.block_name, field_name = EXCLUDED.field_name, operator_name = EXCLUDED.operator_name, technical_status = EXCLUDED.technical_status, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude"
  );
}

async function importTabularAsset(client, asset) {
  const extension = extensionOf(asset.sourcePath);
  if (!asset.id || ![".csv", ".xlsx"].includes(extension)) return;
  if (dryRun) return;
  await client.query("DELETE FROM shihua.source_tabular_record WHERE source_asset_id = $1", [asset.id]);
  const sheets = [];
  if (extension === ".csv") {
    const rows = parse(fs.readFileSync(asset.sourcePath, "utf8"), { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true, trim: true });
    sheets.push({ name: "", rows });
  } else {
    const workbook = XLSX.readFile(asset.sourcePath, { cellDates: true });
    workbook.SheetNames.forEach(sheetName => {
      sheets.push({ name: sheetName, rows: XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null, raw: false }) });
    });
  }
  for (const sheet of sheets) {
    const indexedRows = sheet.rows.map((payload, index) => ({ rowNumber: index + 1, payload }));
    await insertRows(
      client,
      "INSERT INTO shihua.source_tabular_record (source_asset_id, sheet_name, row_number, payload)",
      indexedRows,
      row => [asset.id, sheet.name, row.rowNumber, JSON.stringify(row.payload)],
      4,
      "ON CONFLICT (source_asset_id, sheet_name, row_number) DO UPDATE SET payload = EXCLUDED.payload"
    );
  }
}

async function importSpatialLayer(client, sourceRoot, layer, assets) {
  const shpPath = path.join(sourceRoot, layer.relativePath);
  if (!fs.existsSync(shpPath)) return;
  const assetId = assets.get(path.resolve(shpPath))?.id;
  if (!assetId || dryRun) return;
  await client.query("DELETE FROM shihua.spatial_feature WHERE source_asset_id = $1 AND layer_key = $2", [assetId, layer.layerKey]);
  const dbfPath = shpPath.replace(/\.shp$/i, ".dbf");
  const sourceSrid = getShapefileSrid(shpPath);
  const source = await shapefile.open(shpPath, dbfPath);
  const features = [];
  let rowNumber = 0;
  while (true) {
    const next = await source.read();
    if (next.done) break;
    rowNumber += 1;
    const properties = next.value?.properties || {};
    const featureName = normalize(pickValue(properties, layer.nameKeys));
    const sourceIdentifier = normalize(pickValue(properties, ["OBJECTID", "objectid", "ID", "id"])) || featureName || "feature";
    // Some published layers reuse object IDs. Preserve every source row by making
    // the source key unique within its Shapefile while retaining the original ID in properties.
    const sourceFeatureKey = `${sourceIdentifier}:${rowNumber}`;
    features.push({
      sourceFeatureKey,
      featureName: featureName || null,
      countryName: normalize(pickValue(properties, ["COUNTRY", "country", "COUNTRIES", "countries", "COUNTRY_NAME"])) || null,
      basinName: normalize(pickValue(properties, ["BASIN_NAME", "basin_name", "BAS_NAMES", "bas_names"])) || null,
      properties,
      geometry: next.value?.geometry || null
    });
    if (features.length >= 200) {
      await flushSpatialFeatures(client, assetId, layer.layerKey, sourceSrid, features);
      features.length = 0;
    }
  }
  if (features.length) await flushSpatialFeatures(client, assetId, layer.layerKey, sourceSrid, features);
}

async function flushSpatialFeatures(client, assetId, layerKey, sourceSrid, features) {
  const values = [];
  const placeholders = features.map((feature, index) => {
    const base = index * 9;
    values.push(assetId, layerKey, feature.sourceFeatureKey, feature.featureName, feature.countryName, feature.basinName, JSON.stringify(feature.properties), JSON.stringify(feature.geometry), sourceSrid);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}::jsonb, CASE WHEN $${base + 8}::jsonb IS NULL THEN NULL ELSE ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($${base + 8}::jsonb), $${base + 9}), 4326) END)`;
  });
  await client.query(
    `INSERT INTO shihua.spatial_feature (source_asset_id, layer_key, source_feature_key, feature_name, country_name, basin_name, properties, geometry)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (source_asset_id, layer_key, source_feature_key) DO UPDATE SET
       feature_name = EXCLUDED.feature_name,
       country_name = EXCLUDED.country_name,
       basin_name = EXCLUDED.basin_name,
       properties = EXCLUDED.properties,
       geometry = EXCLUDED.geometry`,
    values
  );
}

async function indexDocuments(client, assets) {
  if (dryRun) return;
  const documents = [...assets.values()].filter(asset => extensionOf(asset.sourcePath) === ".pdf" && asset.id);
  for (const asset of documents) {
    const parts = asset.relativePath.split("/");
    const pdfIndex = parts.findIndex(part => part.toLowerCase() === "pdf");
    const basinName = pdfIndex >= 0 && parts[pdfIndex + 1] ? parts[pdfIndex + 1] : null;
    await client.query(
      `INSERT INTO shihua.document_catalog (source_asset_id, document_type, basin_name, title)
       VALUES ($1, 'pdf', $2, $3)
       ON CONFLICT (source_asset_id) DO UPDATE SET basin_name = EXCLUDED.basin_name, title = EXCLUDED.title, indexed_at = NOW()`,
      [asset.id, basinName, path.basename(asset.sourcePath, ".pdf")]
    );
  }
}

async function run() {
  if (args.has("--help")) {
    printUsage();
    return;
  }
  if (!fs.existsSync(SOURCE_DATA_ROOT)) {
    throw new Error(`未找到源数据目录：${SOURCE_DATA_ROOT}`);
  }
  const client = dryRun ? null : await getPool().connect();
  const assets = new Map();
  try {
    if (!dryRun) {
      await client.query(
        "INSERT INTO shihua.import_batch (id, status, source_root, manifest) VALUES ($1, 'running', $2, $3::jsonb)",
        [batchId, SOURCE_DATA_ROOT, JSON.stringify({ uploadObjects, uploadOnly, skipHash, localDataRoot: LOCAL_DATA_ROOT })]
      );
    }

    const sourceFiles = [
      ...walkFiles(LOCAL_DATA_ROOT).map(filePath => ({ sourceRoot: ROOT, filePath })),
      ...walkFiles(SOURCE_DATA_ROOT).map(filePath => ({ sourceRoot: SOURCE_DATA_ROOT, filePath }))
    ];
    console.log(`Registering ${sourceFiles.length} source assets...`);
    for (const sourceFile of sourceFiles) {
      const asset = await upsertSourceAsset(client, sourceFile.sourceRoot, sourceFile.filePath);
      assets.set(path.resolve(sourceFile.filePath), asset);
    }

    if (uploadOnly) {
      if (!dryRun) {
        await client.query("UPDATE shihua.import_batch SET status = 'completed', completed_at = NOW() WHERE id = $1", [batchId]);
      }
      console.log(`Object upload ${dryRun ? "validated" : "completed"}: ${batchId}`);
      return;
    }

    console.log("Importing platform settings and curated entity tables...");
    for (const [settingKey, fileName] of SETTINGS) await importSetting(client, settingKey, fileName, assets);
    for (const dataset of ENTITY_DATASETS) await importEntityDataset(client, dataset, assets);
    await importWellLogs(client, assets);
    await importAfricaIndex(client, assets);

    console.log("Importing source CSV and Excel rows...");
    for (const asset of assets.values()) await importTabularAsset(client, asset);

    console.log("Importing Shapefile geometries into PostGIS...");
    for (const layer of SPATIAL_LAYERS) await importSpatialLayer(client, SOURCE_DATA_ROOT, layer, assets);
    await indexDocuments(client, assets);

    if (!dryRun) {
      await client.query("UPDATE shihua.import_batch SET status = 'completed', completed_at = NOW() WHERE id = $1", [batchId]);
    }
    console.log(`Migration ${dryRun ? "validated" : "completed"}: ${batchId}`);
  } catch (error) {
    if (!dryRun) {
      await client.query("UPDATE shihua.import_batch SET status = 'failed', completed_at = NOW(), error_message = $2 WHERE id = $1", [batchId, error.message]).catch(() => {});
    }
    throw error;
  } finally {
    client?.release();
  }
}

run()
  .catch(error => {
    console.error(`Migration failed: ${error.stack || error.message}`);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
