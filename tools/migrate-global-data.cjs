#!/usr/bin/env node

/*
 * Imports the supplied worldwide source package as one coherent collection.
 * Spatial geometries live in PostGIS; original files remain source assets and
 * can be copied to MinIO with --upload-objects. Zip files are only unpacked
 * into a disposable local workspace so the original data directory is never
 * modified.
 */

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { parse } = require("csv-parse/sync");
const shapefile = require("shapefile");
const XLSX = require("xlsx");
const { getPool, closeDatabase } = require("../server/data-access/database.cjs");
const { uploadFile } = require("../server/data-access/object-store.cjs");

const ROOT = path.resolve(__dirname, "..");
const schemaPath = path.join(ROOT, "database", "init", "001_schema.sql");
const args = process.argv.slice(2);
const hasArg = name => args.includes(name);
const valueAfter = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const sourceRoot = path.resolve(valueAfter("--source-root") || process.env.SHIHUA_SOURCE_ROOT || "");
const collectionKey = String(valueAfter("--collection") || "global_2025").trim();
const uploadObjects = hasArg("--upload-objects");
const skipHash = hasArg("--skip-hash");
const dryRun = hasArg("--dry-run");
const replaceCollection = hasArg("--replace");
const keepStaging = hasArg("--keep-staging");
const batchId = crypto.randomUUID();
const stagingRoot = path.join(ROOT, "runtime-data", "import-staging", `global-${batchId}`);

const MIME_TYPES = {
  ".cpg": "text/plain",
  ".csv": "text/csv",
  ".dbf": "application/octet-stream",
  ".geojson": "application/geo+json",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".prj": "text/plain",
  ".shp": "application/octet-stream",
  ".shx": "application/octet-stream",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip"
};

function usage() {
  console.log(`Usage: node tools/migrate-global-data.cjs --source-root <directory> [options]

Options:
  --collection <key>      Collection key, default: global_2025
  --replace               Replace an existing staging/failed collection of the same key
  --upload-objects        Upload original source files to MinIO during registration
  --skip-hash             Do not calculate SHA-256 checksums
  --dry-run               Scan, classify and validate inputs without database writes
  --keep-staging          Keep extracted Shapefiles for troubleshooting
`);
}

function normalize(value) {
  return value === null || value === undefined ? "" : String(value).trim();
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

function walkFiles(rootPath) {
  const files = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile()) files.push(fullPath);
    }
  };
  walk(rootPath);
  return files;
}

function relativeToSource(filePath) {
  return path.relative(sourceRoot, filePath).replace(/\\/g, "/");
}

function pickValue(record = {}, keys = []) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  const normalizedKeys = new Map(Object.keys(record).map(key => [key.toLowerCase(), key]));
  for (const key of keys) {
    const actualKey = normalizedKeys.get(String(key).toLowerCase());
    const value = actualKey ? record[actualKey] : undefined;
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

function toNumber(value) {
  const number = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : null;
}

function getShapefileSrid(shpPath) {
  const prjPath = shpPath.replace(/\.shp$/i, ".prj");
  if (!fs.existsSync(prjPath)) return 4326;
  const wkt = fs.readFileSync(prjPath, "utf8");
  if (/Web_Mercator|Mercator_Auxiliary_Sphere|3857/i.test(wkt)) return 3857;
  return 4326;
}

function hashText(value) {
  return crypto.createHash("sha1").update(value).digest("hex");
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

function classifyShapefile(filePath) {
  const relative = relativeToSource(filePath).toLowerCase();
  const name = path.basename(filePath).toLowerCase();
  if (name.includes("basin")) return "basins";
  if (name.includes("contract block") || name.includes("contract_blocks")) return "contract_blocks";
  if (name.includes("fields_poly") || name.includes("field")) return "fields";
  if (name.includes("wells_point") || name.includes("well")) return "wells";
  if (relative.includes("盆地")) return "basins";
  if (relative.includes("合同区块")) return "contract_blocks";
  if (relative.includes("油气田")) return "fields";
  if (relative.includes("钻井")) return "wells";
  return null;
}

function isGlobalMaster(filePath, layerKey) {
  const relative = relativeToSource(filePath).replace(/\\/g, "/");
  if (layerKey === "basins") return /全球盆地-2025\/World Basins-2025\/World Basins-2025\.shp$/i.test(relative);
  if (layerKey === "contract_blocks") return /全球合同区块-2025\/00-全球合同区块-30013个\/World Contract Blocks\.shp$/i.test(relative);
  return false;
}

function isGlobalFieldArchive(filePath) {
  return /全球油气田-36176个\.zip$/i.test(path.basename(filePath));
}

function isGlobalFieldTableArchive(filePath) {
  return /全球油气田-表格\.zip$/i.test(path.basename(filePath));
}

function isComprehensiveAfricaWellArchive(filePath) {
  return /全球钻井-2025[\\/]非洲[\\/]非洲钻井-2025\.zip$/i.test(filePath);
}

function isIndividualAfricaWellArchive(filePath) {
  return /全球钻井-2025[\\/]非洲[\\/]/i.test(filePath) && !isComprehensiveAfricaWellArchive(filePath);
}

function selectedSources(allFiles) {
  const shapefiles = allFiles.filter(filePath => extensionOf(filePath) === ".shp");
  const archives = allFiles.filter(filePath => extensionOf(filePath) === ".zip");
  const archiveFolderNames = new Set(archives.map(filePath => path.basename(filePath, ".zip")));
  const selected = [];

  for (const shpPath of shapefiles) {
    const layerKey = classifyShapefile(shpPath);
    if (!layerKey) continue;
    if (layerKey === "basins" || layerKey === "contract_blocks") {
      if (isGlobalMaster(shpPath, layerKey)) selected.push({ layerKey, shpPath, sourcePath: shpPath, sourceKind: "file" });
    } else if (layerKey === "wells") {
      // Some regional well layers are already unpacked next to an identically
      // named archive. Prefer the archive once, otherwise every well is read
      // twice before PostGIS can de-duplicate it.
      if (!archiveFolderNames.has(path.basename(path.dirname(shpPath)))) {
        selected.push({ layerKey, shpPath, sourcePath: shpPath, sourceKind: "file" });
      }
    }
  }

  for (const archivePath of archives) {
    if (isGlobalFieldArchive(archivePath)) {
      selected.push({ layerKey: "fields", archivePath, sourcePath: archivePath, sourceKind: "archive" });
      continue;
    }
    if (/全球钻井-2025/i.test(relativeToSource(archivePath)) && !isIndividualAfricaWellArchive(archivePath)) {
      selected.push({ layerKey: "wells", archivePath, sourcePath: archivePath, sourceKind: "archive" });
    }
  }

  return selected;
}

function extractArchive(archivePath) {
  const folder = path.join(stagingRoot, hashText(path.resolve(archivePath)).slice(0, 16));
  fs.mkdirSync(folder, { recursive: true });
  const result = spawnSync("tar", ["-xf", archivePath, "-C", folder], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) {
    throw new Error(`解压失败：${archivePath}\n${result.stderr || result.stdout || "tar returned a non-zero status"}`);
  }
  return folder;
}

function findExtractedFile(folder, matcher) {
  const match = walkFiles(folder).find(filePath => matcher(path.basename(filePath)));
  if (!match) throw new Error(`压缩包中未找到预期文件：${folder}`);
  return match;
}

async function upsertSourceAsset(client, filePath) {
  const stat = fs.statSync(filePath);
  const relativePath = relativeToSource(filePath);
  const sourcePath = path.resolve(filePath);
  const sha256 = skipHash ? null : await sha256File(filePath);
  const objectKey = objectKeyFor(relativePath);
  let storageStatus = "metadata_only";

  if (uploadObjects) {
    await uploadFile(objectKey, filePath, stat.size, {
      "content-type": mediaTypeFor(filePath),
      "source-sha256": sha256 || ""
    });
    storageStatus = "uploaded";
  }

  if (dryRun) return { id: null, sourcePath, relativePath, sizeBytes: stat.size, objectKey, storageStatus };
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
       storage_status = CASE
         WHEN EXCLUDED.storage_status = 'uploaded' THEN 'uploaded'
         ELSE shihua.source_asset.storage_status
       END,
       updated_at = NOW()
     RETURNING id`,
    [batchId, sourcePath, relativePath, path.basename(filePath), mediaTypeFor(filePath), extensionOf(filePath), stat.size, sha256, objectKey, storageStatus]
  );
  return { id: result.rows[0].id, sourcePath, relativePath, sizeBytes: stat.size, objectKey, storageStatus };
}

function featureFields(layerKey, properties, geometry) {
  const featureName = normalize(pickValue(properties, {
    basins: ["BASIN_NAME", "BAS_NAME", "NAME"],
    contract_blocks: ["BLOCK_NAME", "CON_BLK_NM", "CONTRACT", "NAME"],
    fields: ["FIELD_NAME", "FIE_NAME", "NAME"],
    wells: ["WELL_NAME", "WEL_NAME", "NAME"]
  }[layerKey] || ["NAME"]));
  const countryName = normalize(pickValue(properties, ["COUNTRY", "COUNTRIES", "COUNTRY_NAME", "Country Names"]));
  const basinName = normalize(pickValue(properties, ["BASIN_NAME", "BAS_NAMES", "BAS_NAME", "Basin Name"]));
  const blockName = normalize(pickValue(properties, ["BLOCK_NAME", "CON_BLK_NM", "Cur Contract Block Names"]));
  const fieldName = normalize(pickValue(properties, ["FIELD_NAME", "FIE_NAME", "Field Name"]));
  const contractName = normalize(pickValue(properties, ["CONTRACT", "CON_NAME", "Contract Name"]));
  const operatorName = normalize(pickValue(properties, ["OPERATOR", "OPR_CURR", "Cur Operator Names"]));
  const statusName = normalize(pickValue(properties, ["PROD_STAT", "TCH_STAT", "CON_STATUS", "BLK_STATUS", "Prod Status"]));
  const coordinates = geometry?.type === "Point" ? geometry.coordinates : [];
  const latitude = toNumber(pickValue(properties, ["LAT_DEC", "LATITUDE", "Latitude Dec Deg"])) ?? (Array.isArray(coordinates) ? Number(coordinates[1]) : null);
  const longitude = toNumber(pickValue(properties, ["LONG_DEC", "LONGITUDE", "Longitude Dec Deg"])) ?? (Array.isArray(coordinates) ? Number(coordinates[0]) : null);
  const stableIdentifier = normalize(pickValue(properties, {
    basins: ["BAS_ID", "BASIN_ID", "OBJECTID", "ID"],
    contract_blocks: ["BLK_ID", "BLOCK_ID", "OBJECTID", "ID"],
    fields: ["FIE_ID", "FIELD_ID", "OBJECTID", "ID"],
    wells: ["WEL_ID", "WELL_ID", "API", "UWI", "OBJECTID", "ID"]
  }[layerKey] || ["OBJECTID", "ID"]));
  const fallbackIdentity = JSON.stringify({ featureName, countryName, basinName, blockName, fieldName, latitude, longitude, geometry });
  const canonicalKey = `${layerKey}:${stableIdentifier || hashText(fallbackIdentity)}`;
  return {
    featureName: featureName || null,
    countryName: countryName || null,
    basinName: basinName || null,
    blockName: blockName || null,
    fieldName: fieldName || null,
    contractName: contractName || null,
    operatorName: operatorName || null,
    statusName: statusName || null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    canonicalKey
  };
}

async function flushSpatialFeatures(client, sourceAssetId, layerKey, sourceSrid, features) {
  if (!features.length || dryRun) return;
  // A few delivered Shapefiles reuse an object id. PostGIS can ignore the
  // duplicate geometry, but entity_record has an explicit source-key contract,
  // so deduplicate within this source batch before the upsert.
  const uniqueFeatures = [...new Map(features.map(feature => [feature.canonicalKey, feature])).values()];
  const spatialValues = [];
  const spatialPlaceholders = uniqueFeatures.map((feature, index) => {
    const base = index * 10;
    spatialValues.push(
      collectionKey, sourceAssetId, layerKey, feature.canonicalKey, feature.featureName, feature.countryName, feature.basinName,
      JSON.stringify(feature.properties), JSON.stringify(feature.geometry), sourceSrid
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}::jsonb,
      CASE WHEN $${base + 9}::jsonb IS NULL THEN NULL ELSE ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($${base + 9}::jsonb), $${base + 10}), 4326) END)`;
  });
  await client.query(
    `INSERT INTO shihua.spatial_feature
       (collection_key, source_asset_id, layer_key, source_feature_key, feature_name, country_name, basin_name, properties, geometry)
     VALUES ${spatialPlaceholders.join(", ")}
     ON CONFLICT DO NOTHING`,
    spatialValues
  );
  const entityType = layerKey === "contract_blocks" ? "block" : layerKey.slice(0, -1);
  await insertRows(client, uniqueFeatures, feature => [
    collectionKey, entityType, "spatial", sourceAssetId, feature.canonicalKey, feature.canonicalKey, feature.featureName,
    feature.countryName, feature.basinName, feature.blockName, feature.fieldName, feature.contractName, feature.operatorName,
    feature.statusName, feature.latitude, feature.longitude, JSON.stringify(feature.properties)
  ],
  "INSERT INTO shihua.entity_record (collection_key, entity_type, record_role, source_asset_id, source_record_key, canonical_key, record_name, country_name, basin_name, block_name, field_name, contract_name, operator_name, status_name, latitude, longitude, payload)",
  17,
  "ON CONFLICT (collection_key, entity_type, record_role, source_asset_id, source_record_key) DO UPDATE SET canonical_key = EXCLUDED.canonical_key, record_name = EXCLUDED.record_name, country_name = EXCLUDED.country_name, basin_name = EXCLUDED.basin_name, block_name = EXCLUDED.block_name, field_name = EXCLUDED.field_name, contract_name = EXCLUDED.contract_name, operator_name = EXCLUDED.operator_name, status_name = EXCLUDED.status_name, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, payload = EXCLUDED.payload, updated_at = NOW()",
  1000);
}

async function importSpatialSource(client, descriptor, asset) {
  let shpPath = descriptor.shpPath;
  if (descriptor.sourceKind === "archive") {
    const extracted = extractArchive(descriptor.archivePath);
    shpPath = findExtractedFile(extracted, name => /\.shp$/i.test(name));
  }
  const dbfPath = shpPath.replace(/\.shp$/i, ".dbf");
  if (!fs.existsSync(dbfPath)) throw new Error(`缺少 Shapefile 属性文件：${dbfPath}`);
  const source = await shapefile.open(shpPath, dbfPath);
  const sourceSrid = getShapefileSrid(shpPath);
  const features = [];
  let imported = 0;
  while (true) {
    const next = await source.read();
    if (next.done) break;
    const properties = next.value?.properties || {};
    const details = featureFields(descriptor.layerKey, properties, next.value?.geometry || null);
    features.push({ ...details, properties, geometry: next.value?.geometry || null });
    if (features.length >= 1000) {
      await flushSpatialFeatures(client, asset.id, descriptor.layerKey, sourceSrid, features);
      imported += features.length;
      features.length = 0;
      process.stdout.write(`\r  ${descriptor.layerKey}: ${imported.toLocaleString("zh-CN")} features`);
    }
  }
  if (features.length) {
    await flushSpatialFeatures(client, asset.id, descriptor.layerKey, sourceSrid, features);
    imported += features.length;
  }
  process.stdout.write(`\r  ${descriptor.layerKey}: ${imported.toLocaleString("zh-CN")} features completed\n`);
}

async function insertRows(client, rows, valuesForRow, prefix, valuesPerRow, suffix = "", chunkSize = 500) {
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const values = [];
    const placeholders = chunk.map((row, index) => {
      const base = index * valuesPerRow;
      values.push(...valuesForRow(row));
      return `(${Array.from({ length: valuesPerRow }, (_, column) => `$${base + column + 1}`).join(", ")})`;
    });
    await client.query(`${prefix} VALUES ${placeholders.join(", ")} ${suffix}`, values);
  }
}

async function importTabularAsset(client, asset) {
  const extension = extensionOf(asset.sourcePath);
  if (dryRun || !asset.id || ![".csv", ".xlsx"].includes(extension)) return;
  await client.query("DELETE FROM shihua.source_tabular_record WHERE source_asset_id = $1", [asset.id]);
  const sheets = extension === ".csv"
    ? [{ name: "", rows: parse(fs.readFileSync(asset.sourcePath, "utf8"), { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true, trim: true }) }]
    : (() => {
      const workbook = XLSX.readFile(asset.sourcePath, { cellDates: true });
      return workbook.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: null, raw: false }) }));
    })();
  for (const sheet of sheets) {
    const rows = sheet.rows.map((payload, index) => ({ rowNumber: index + 1, payload }));
    await insertRows(client, rows, row => [asset.id, sheet.name, row.rowNumber, JSON.stringify(row.payload)],
      "INSERT INTO shihua.source_tabular_record (source_asset_id, sheet_name, row_number, payload)", 4,
      "ON CONFLICT (source_asset_id, sheet_name, row_number) DO UPDATE SET payload = EXCLUDED.payload");
  }
}

function normalizeFieldRow(payload) {
  return {
    ...payload,
    "Field Id": payload["Field Id"] ?? payload.FIELD_ID ?? payload.FIE_ID ?? "",
    "Field Name": payload["Field Name"] ?? payload.FIELD_NAME ?? payload.FIE_NAME ?? "",
    "Country Names": payload["Country Names"] ?? payload.COUNTRY ?? payload.COUNTRIES ?? "",
    "Basin Name": payload["Basin Name"] ?? payload.BASIN_NAME ?? payload.BAS_NAMES ?? "",
    "Prod Status": payload["Prod Status"] ?? payload.PROD_STAT ?? "",
    "Cur Operator Names": payload["Cur Operator Names"] ?? payload.OPERATOR ?? payload.OPR_CURR ?? "",
    "Cur Contract Block Names": payload["Cur Contract Block Names"] ?? payload.BLOCK_NAME ?? payload.CON_BLK_NM ?? ""
  };
}

async function importGlobalFieldTable(client, assets) {
  const archivePath = [...assets.keys()].find(filePath => isGlobalFieldTableArchive(filePath));
  if (!archivePath) throw new Error("未找到全球油气田属性表压缩包（全球油气田-表格.zip）。");
  const asset = assets.get(archivePath);
  const extracted = extractArchive(archivePath);
  const csvPath = findExtractedFile(extracted, name => /^FIELD_FULL.*\.csv$/i.test(name));
  const rows = parse(fs.readFileSync(csvPath, "utf8"), { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true, trim: true })
    .map(normalizeFieldRow);
  if (dryRun) return rows.length;
  await client.query("DELETE FROM shihua.entity_record WHERE collection_key = $1 AND entity_type = 'field' AND record_role = 'tabular_primary'", [collectionKey]);
  await client.query("DELETE FROM shihua.source_tabular_record WHERE source_asset_id = $1", [asset.id]);
  const indexed = rows.map((payload, index) => ({ payload, rowNumber: index + 1 }));
  await insertRows(client, indexed, row => [asset.id, "FIELD_FULL", row.rowNumber, JSON.stringify(row.payload)],
    "INSERT INTO shihua.source_tabular_record (source_asset_id, sheet_name, row_number, payload)", 4,
    "ON CONFLICT (source_asset_id, sheet_name, row_number) DO UPDATE SET payload = EXCLUDED.payload");
  await insertRows(client, indexed, row => {
    const payload = row.payload;
    const fieldId = normalize(payload["Field Id"]);
    const name = normalize(payload["Field Name"]);
    const country = normalize(payload["Country Names"]);
    const basin = normalize(payload["Basin Name"]);
    const canonical = `field:${fieldId || hashText(`${name}|${country}|${basin}`)}`;
    return [collectionKey, "field", "tabular_primary", asset.id, String(row.rowNumber), canonical, name || null, country || null, basin || null,
      normalize(payload["Cur Contract Block Names"]) || null, normalize(payload["Cur Operator Names"]) || null,
      normalize(payload["Prod Status"]) || null, toNumber(payload["Stan Lat In Decimal Deg"]), toNumber(payload["Stan Long In Decimal Deg"]), JSON.stringify(payload)];
  },
  "INSERT INTO shihua.entity_record (collection_key, entity_type, record_role, source_asset_id, source_record_key, canonical_key, record_name, country_name, basin_name, block_name, operator_name, status_name, latitude, longitude, payload)",
  15,
  "ON CONFLICT (collection_key, entity_type, record_role, source_asset_id, source_record_key) DO UPDATE SET canonical_key = EXCLUDED.canonical_key, record_name = EXCLUDED.record_name, country_name = EXCLUDED.country_name, basin_name = EXCLUDED.basin_name, block_name = EXCLUDED.block_name, operator_name = EXCLUDED.operator_name, status_name = EXCLUDED.status_name, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, payload = EXCLUDED.payload, updated_at = NOW()");
  return rows.length;
}

async function indexDocuments(client, assets) {
  if (dryRun) return;
  for (const asset of assets.values()) {
    if (extensionOf(asset.sourcePath) !== ".pdf" || !asset.id) continue;
    const parts = asset.relativePath.split("/");
    const basinName = parts.length > 1 ? parts[parts.length - 2] : null;
    await client.query(
      `INSERT INTO shihua.document_catalog (source_asset_id, document_type, basin_name, title)
       VALUES ($1, 'pdf', $2, $3)
       ON CONFLICT (source_asset_id) DO UPDATE SET basin_name = EXCLUDED.basin_name, title = EXCLUDED.title, indexed_at = NOW()`,
      [asset.id, basinName, path.basename(asset.sourcePath, ".pdf")]
    );
  }
}

async function collectionCounts(client) {
  const result = await client.query(
    "SELECT layer_key, COUNT(*)::int AS count FROM shihua.spatial_feature WHERE collection_key = $1 GROUP BY layer_key",
    [collectionKey]
  );
  return Object.fromEntries(result.rows.map(row => [row.layer_key, Number(row.count)]));
}

async function run() {
  if (hasArg("--help") || hasArg("-h")) return usage();
  if (!sourceRoot || !fs.existsSync(sourceRoot)) throw new Error("未找到全球源数据目录。请使用 --source-root 指向 S:/C2/石化数据/给杨老师。");
  const sourceFiles = walkFiles(sourceRoot);
  const spatialSources = selectedSources(sourceFiles);
  const manifest = {
    collectionKey,
    sourceRoot,
    sourceFileCount: sourceFiles.length,
    sourceFileBytes: sourceFiles.reduce((sum, filePath) => sum + fs.statSync(filePath).size, 0),
    selectedSpatialSources: spatialSources.map(source => ({ layer: source.layerKey, path: relativeToSource(source.sourcePath) })),
    uploadObjects,
    generatedAt: new Date().toISOString()
  };
  if (!spatialSources.some(source => source.layerKey === "basins") || !spatialSources.some(source => source.layerKey === "contract_blocks") || !spatialSources.some(source => source.layerKey === "fields") || !spatialSources.some(source => source.layerKey === "wells")) {
    throw new Error("全球数据包不完整：未发现盆地、合同区块、油气田或钻井的全量导入来源。");
  }
  console.log(JSON.stringify({ ...manifest, sourceFileBytes: `${Math.round(manifest.sourceFileBytes / 1024 / 1024)} MB` }, null, 2));
  if (dryRun) return;

  fs.mkdirSync(stagingRoot, { recursive: true });
  const client = await getPool().connect();
  const assets = new Map();
  try {
    await client.query(fs.readFileSync(schemaPath, "utf8"));
    const existing = await client.query("SELECT status FROM shihua.data_collection WHERE collection_key = $1", [collectionKey]);
    if (existing.rows[0]?.status === "active" && !replaceCollection) {
      throw new Error(`数据集 ${collectionKey} 已处于 active 状态。若确认要重新构建，请显式添加 --replace。`);
    }
    if (replaceCollection) {
      await client.query("DELETE FROM shihua.spatial_feature WHERE collection_key = $1", [collectionKey]);
      await client.query("DELETE FROM shihua.data_collection WHERE collection_key = $1", [collectionKey]);
    }
    await client.query(
      "INSERT INTO shihua.import_batch (id, status, source_root, manifest) VALUES ($1, 'running', $2, $3::jsonb)",
      [batchId, sourceRoot, JSON.stringify(manifest)]
    );
    await client.query(
      `INSERT INTO shihua.data_collection (collection_key, display_name, coverage, status, import_batch_id, manifest)
       VALUES ($1, '全球油气基础数据（2025）', 'global', 'staging', $2, $3::jsonb)
       ON CONFLICT (collection_key) DO UPDATE SET status = 'staging', import_batch_id = EXCLUDED.import_batch_id, manifest = EXCLUDED.manifest`,
      [collectionKey, batchId, JSON.stringify(manifest)]
    );

    console.log(`Registering ${sourceFiles.length} original source assets${uploadObjects ? " and uploading to MinIO" : ""}...`);
    for (const filePath of sourceFiles) assets.set(filePath, await upsertSourceAsset(client, filePath));

    console.log("Importing CSV and Excel source records...");
    for (const asset of assets.values()) await importTabularAsset(client, asset);

    console.log("Importing the global oil-field primary table...");
    const fieldTableRows = await importGlobalFieldTable(client, assets);
    console.log(`  Imported ${fieldTableRows.toLocaleString("zh-CN")} global oil-field tabular records.`);

    console.log("Importing selected Shapefiles into PostGIS...");
    for (const descriptor of spatialSources) {
      const asset = assets.get(descriptor.sourcePath);
      if (!asset?.id) throw new Error(`未登记空间来源资产：${descriptor.sourcePath}`);
      await importSpatialSource(client, descriptor, asset);
    }
    await indexDocuments(client, assets);

    const counts = await collectionCounts(client);
    for (const layerKey of ["basins", "contract_blocks", "fields", "wells"]) {
      if (!counts[layerKey]) throw new Error(`导入校验失败：${layerKey} 图层为空，拒绝启用新数据集。`);
    }
    manifest.counts = counts;
    await client.query("UPDATE shihua.data_collection SET status = 'active', manifest = $2::jsonb, activated_at = NOW() WHERE collection_key = $1", [collectionKey, JSON.stringify(manifest)]);
    await client.query("UPDATE shihua.data_collection SET status = 'archived' WHERE collection_key <> $1 AND status = 'active'", [collectionKey]);
    await client.query(
      `INSERT INTO shihua.app_setting (setting_key, setting_value)
       VALUES ('active_data_collection', $1::jsonb)
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
      [JSON.stringify({ key: collectionKey, coverage: "global", counts })]
    );
    await client.query("UPDATE shihua.import_batch SET status = 'completed', completed_at = NOW(), manifest = $2::jsonb WHERE id = $1", [batchId, JSON.stringify(manifest)]);
    console.log(`Global import completed: ${collectionKey}`, counts);
  } catch (error) {
    await client.query("UPDATE shihua.import_batch SET status = 'failed', completed_at = NOW(), error_message = $2 WHERE id = $1", [batchId, error.message]).catch(() => {});
    await client.query("UPDATE shihua.data_collection SET status = 'failed' WHERE collection_key = $1 AND status = 'staging'", [collectionKey]).catch(() => {});
    throw error;
  } finally {
    client.release();
    if (!keepStaging) fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
}

run()
  .catch(error => {
    console.error(`Global migration failed: ${error.stack || error.message}`);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
