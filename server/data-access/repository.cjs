const { query } = require("./database.cjs");

const VALID_LAYER_KEYS = new Set(["basins", "contract_blocks", "fields", "wells"]);
const PLATFORM_SETTING_KEYS = [
  "structure_base_table",
  "system_overview",
  "map_service_config",
  "data_inventory",
  "regional_story",
  "evaluation_models",
  "africa_index_metadata"
];

function rowsToMap(rows, keyColumn, valueColumn) {
  return Object.fromEntries(rows.map(row => [row[keyColumn], row[valueColumn]]));
}

async function getSettings() {
  const result = await query(
    "SELECT setting_key, setting_value FROM shihua.app_setting WHERE setting_key = ANY($1::text[])",
    [PLATFORM_SETTING_KEYS]
  );
  return rowsToMap(result.rows, "setting_key", "setting_value");
}

async function getEntityBundle(entityType) {
  const [profilesResult, detailsResult] = await Promise.all([
    query(
      "SELECT entity_key, profile FROM shihua.entity_profile WHERE entity_type = $1 ORDER BY entity_key",
      [entityType]
    ),
    query(
      "SELECT entity_key, payload FROM shihua.entity_detail WHERE entity_type = $1 AND detail_key = 'tables' ORDER BY entity_key",
      [entityType]
    )
  ]);
  return {
    profiles: rowsToMap(profilesResult.rows, "entity_key", "profile"),
    tables: rowsToMap(detailsResult.rows, "entity_key", "payload")
  };
}

async function getPlatformState() {
  const [settings, logResult, well, basin, block, contract, field] = await Promise.all([
    getSettings(),
    query("SELECT payload FROM shihua.well_log_measurement ORDER BY well_name, depth_m"),
    getEntityBundle("well"),
    getEntityBundle("basin"),
    getEntityBundle("block"),
    getEntityBundle("contract"),
    getEntityBundle("field")
  ]);

  return {
    logs: logResult.rows.map(row => row.payload),
    structure: settings.structure_base_table || {},
    overview: settings.system_overview || {},
    serviceConfig: settings.map_service_config || {},
    wellProfiles: well.profiles,
    wellTables: well.tables,
    basinData: basin,
    blockData: block,
    contractData: contract,
    fieldData: field,
    dataInventory: settings.data_inventory || {},
    regionalStories: settings.regional_story || {}
  };
}

function firstValue(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function normalizeEconomicField(payload = {}) {
  return {
    ...payload,
    "Field Id": payload["Field Id"] ?? payload.fieldId ?? null,
    "Field Name": payload["Field Name"] ?? payload.name ?? "",
    "Country Names": payload["Country Names"] ?? payload.country ?? "",
    "Basin Name": payload["Basin Name"] ?? payload.basin ?? "",
    "Prod Status": payload["Prod Status"] ?? payload.status ?? "",
    "Hc Type": payload["Hc Type"] ?? payload.hcType ?? "",
    "Cur Operator Names": payload["Cur Operator Names"] ?? payload.operator ?? "",
    "Cur Contract Block Names": payload["Cur Contract Block Names"] ?? payload.block ?? "",
    "Tot Remaining Pp Mmboe": payload["Tot Remaining Pp Mmboe"] ?? payload.remainingMmboe ?? null,
    "Oil Recoverable Pp Mmbbl": payload["Oil Recoverable Pp Mmbbl"] ?? payload.oilRecoverableMmbbl ?? null,
    "Gas Recoverable Pp Mmscf": payload["Gas Recoverable Pp Mmscf"] ?? payload.gasRecoverableMmscf ?? null,
    "Cond Recoverable Pp Mmbbl": payload["Cond Recoverable Pp Mmbbl"] ?? payload.condRecoverableMmbbl ?? null,
    "Water Depth Max Val Meter": payload["Water Depth Max Val Meter"] ?? payload.maxWaterDepthM ?? null,
    "Field Sqkm": payload["Field Sqkm"] ?? payload.areaSqkm ?? null
  };
}

function mapProperties(row, mapMode) {
  const properties = row.properties || {};
  const normalized = {
    name: firstValue(properties, ["name", "NAME", "BASIN_NAME", "BLOCK_NAME", "FIELD_NAME", "WELL_NAME"]) || row.feature_name,
    basin_name: firstValue(properties, ["basin_name", "BASIN_NAME", "BAS_NAMES"]),
    bas_names: firstValue(properties, ["bas_names", "BAS_NAMES", "BASIN_NAME"]),
    countries: firstValue(properties, ["countries", "COUNTRIES", "COUNTRY"]),
    country: firstValue(properties, ["country", "COUNTRY", "COUNTRIES"]),
    block_name: firstValue(properties, ["block_name", "BLOCK_NAME"]),
    con_blk_nm: firstValue(properties, ["con_blk_nm", "CON_BLK_NM"]),
    field_name: firstValue(properties, ["field_name", "FIELD_NAME"]),
    well_name: firstValue(properties, ["well_name", "WELL_NAME"]),
    operator: firstValue(properties, ["operator", "OPERATOR", "OPR_CURR"]),
    opr_curr: firstValue(properties, ["opr_curr", "OPR_CURR", "OPERATOR"]),
    contract: firstValue(properties, ["contract", "CONTRACT"]),
    con_status: firstValue(properties, ["con_status", "CON_STATUS"]),
    blk_status: firstValue(properties, ["blk_status", "BLK_STATUS"]),
    prt_bsn_nm: firstValue(properties, ["prt_bsn_nm", "PRT_BSN_NM"]),
    king_class: firstValue(properties, ["king_class", "KING_CLASS"]),
    bs_skm: firstValue(properties, ["bs_skm", "BS_SKM"]),
    bs_dp_wat: firstValue(properties, ["bs_dp_wat", "BS_DP_WAT"]),
    blk_sqkm: firstValue(properties, ["blk_sqkm", "BLK_SQKM"]),
    med_wd_mt: firstValue(properties, ["med_wd_mt", "MED_WD_MT"]),
    max_wd_mt: firstValue(properties, ["max_wd_mt", "MAX_WD_MT"]),
    wel_id: firstValue(properties, ["wel_id", "WEL_ID"]),
    td_m: firstValue(properties, ["td_m", "TD_M"]),
    tch_stat: firstValue(properties, ["tch_stat", "TCH_STAT"]),
    class: firstValue(properties, ["class", "CLASS"]),
    prod_stat: firstValue(properties, ["prod_stat", "PROD_STAT", "PROD_STATUS"]),
    hc_type: firstValue(properties, ["hc_type", "HC_TYPE"]),
    resourc12: firstValue(properties, ["resourc12", "RESOURC12"])
  };
  if (!mapMode) return { ...properties, ...normalized };
  return Object.fromEntries(Object.entries(normalized)
    .filter(([, value]) => value !== null && value !== undefined && value !== ""));
}

async function getAfricaIndex() {
  const [settings, fieldResult, wellResult, documentsResult, fieldCountriesResult, wellCountriesResult, fieldStatusResult, wellStatusResult] = await Promise.all([
    getSettings(),
    query("SELECT payload FROM shihua.africa_field ORDER BY source_row_number LIMIT 24"),
    query("SELECT payload FROM shihua.africa_well ORDER BY source_row_number LIMIT 24"),
    query("SELECT basin_name, COUNT(*)::int AS count FROM shihua.document_catalog GROUP BY basin_name ORDER BY basin_name"),
    query("SELECT country_name AS name, COUNT(*)::int AS count FROM shihua.africa_field WHERE country_name IS NOT NULL AND country_name <> '' GROUP BY country_name ORDER BY count DESC, name LIMIT 12"),
    query("SELECT country_name AS name, COUNT(*)::int AS count FROM shihua.africa_well WHERE country_name IS NOT NULL AND country_name <> '' GROUP BY country_name ORDER BY count DESC, name LIMIT 12"),
    query("SELECT production_status AS name, COUNT(*)::int AS count FROM shihua.africa_field WHERE production_status IS NOT NULL AND production_status <> '' GROUP BY production_status ORDER BY count DESC, name LIMIT 12"),
    query("SELECT technical_status AS name, COUNT(*)::int AS count FROM shihua.africa_well WHERE technical_status IS NOT NULL AND technical_status <> '' GROUP BY technical_status ORDER BY count DESC, name LIMIT 12")
  ]);
  const metadata = settings.africa_index_metadata || {};
  const [basinCount, blockCount, fieldCount, wellCount, documentCount] = await Promise.all([
    query("SELECT COUNT(*)::int AS count FROM shihua.spatial_feature WHERE layer_key = 'basins'"),
    query("SELECT COUNT(*)::int AS count FROM shihua.spatial_feature WHERE layer_key = 'contract_blocks'"),
    query("SELECT COUNT(*)::int AS count FROM shihua.africa_field"),
    query("SELECT COUNT(*)::int AS count FROM shihua.africa_well"),
    query("SELECT COUNT(*)::int AS count FROM shihua.document_catalog")
  ]);

  return {
    ...metadata,
    region: metadata.region || "Africa",
    summary: {
      ...(metadata.summary || {}),
      basins: Number(basinCount.rows[0].count),
      contractBlocks: Number(blockCount.rows[0].count),
      fields: Number(fieldCount.rows[0].count),
      wells: Number(wellCount.rows[0].count),
      pdfFolders: documentsResult.rows.length,
      pdfFiles: Number(documentCount.rows[0].count),
      topFieldCountries: fieldCountriesResult.rows,
      topWellCountries: wellCountriesResult.rows,
      topFieldStatuses: fieldStatusResult.rows,
      topWellStatuses: wellStatusResult.rows
    },
    tables: {
      ...(metadata.tables || {}),
      fields: { ...(metadata.tables?.fields || {}), records: fieldResult.rows.map(row => row.payload) },
      wells: { ...(metadata.tables?.wells || {}), records: wellResult.rows.map(row => row.payload) }
    },
    pdfIndex: {
      folders: documentsResult.rows.map(row => ({ basin: row.basin_name || "未归类", documentCount: Number(row.count) }))
    }
  };
}

async function getSpatialLayer(layerKey, filters = {}) {
  if (!VALID_LAYER_KEYS.has(layerKey)) throw new Error("Unsupported spatial layer");
  const limit = Math.max(1, Math.min(Number(filters.limit) || 80000, 100000));
  const offset = Math.max(0, Number(filters.offset) || 0);
  const keyword = String(filters.keyword || "").trim();
  const country = String(filters.country || "").trim();
  const basin = String(filters.basin || "").trim();
  const mapMode = String(filters.mode || "").toLowerCase() === "map";
  const bboxParts = String(filters.bbox || "").split(",").map(Number);
  const bbox = bboxParts.length === 4 && bboxParts.every(Number.isFinite)
    && bboxParts[0] < bboxParts[2] && bboxParts[1] < bboxParts[3]
    ? bboxParts
    : null;
  const result = await query(
    `SELECT feature_name, properties,
       ST_AsGeoJSON(CASE WHEN $7 THEN ST_SimplifyPreserveTopology(geometry, 0.005) ELSE geometry END)::jsonb AS geometry
     FROM shihua.spatial_feature
     WHERE layer_key = $1
       AND ($2 = '' OR country_name = $2)
       AND ($3 = '' OR basin_name = $3)
       AND ($4 = '' OR feature_name ILIKE '%' || $4 || '%' OR properties::text ILIKE '%' || $4 || '%')
       AND ($8::float8[] IS NULL OR geometry && ST_MakeEnvelope(($8::float8[])[1], ($8::float8[])[2], ($8::float8[])[3], ($8::float8[])[4], 4326))
     ORDER BY feature_name NULLS LAST, id
     LIMIT $5 OFFSET $6`,
    [layerKey, country, basin, keyword, limit, offset, mapMode, bbox]
  );
  return {
    type: "FeatureCollection",
    name: `database_${layerKey}`,
    features: result.rows.map(row => ({
      type: "Feature",
      properties: mapProperties(row, mapMode),
      geometry: row.geometry
    }))
  };
}

async function getSpatialLayerSummary() {
  const result = await query(
    "SELECT layer_key, COUNT(*)::int AS count FROM shihua.spatial_feature GROUP BY layer_key"
  );
  const counts = Object.fromEntries(result.rows.map(row => [row.layer_key, Number(row.count)]));
  return {
    wells: counts.wells || 0,
    basins: counts.basins || 0,
    contract_blocks: counts.contract_blocks || 0,
    fields: counts.fields || 0
  };
}

async function getEconomicDataset() {
  const [fields, blocks, basins, fieldOptions] = await Promise.all([
    query("SELECT payload FROM shihua.africa_field ORDER BY source_row_number"),
    query("SELECT properties FROM shihua.spatial_feature WHERE layer_key = 'contract_blocks' ORDER BY id"),
    query("SELECT properties FROM shihua.spatial_feature WHERE layer_key = 'basins' ORDER BY id"),
    query("SELECT country_name, basin_name, production_status, payload FROM shihua.africa_field ORDER BY source_row_number")
  ]);
  const values = fieldOptions.rows;
  return {
    fields: fields.rows.map(row => normalizeEconomicField(row.payload)),
    blocks: blocks.rows.map(row => row.properties),
    basins: basins.rows.map(row => row.properties),
    options: {
      countries: [...new Set(values.map(row => row.country_name).filter(Boolean))].sort(),
      basins: [...new Set(values.map(row => row.basin_name).filter(Boolean))].sort(),
      statuses: [...new Set(values.map(row => row.production_status).filter(Boolean))].sort(),
      hydrocarbonTypes: [...new Set(values.map(row => firstValue(row.payload || {}, ["Hc Type", "General Hc Type", "hcType"])).filter(Boolean))].sort()
    },
    sourceSummary: {
      runtimeFields: fields.rows.length,
      runtimeContractBlocks: blocks.rows.length,
      runtimeBasins: basins.rows.length
    },
    warnings: []
  };
}

async function recordEvaluationRun(run) {
  await query(
    `INSERT INTO shihua.evaluation_run (id, model_key, assumptions, filters, result_summary)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)`,
    [run.id, run.modelKey, JSON.stringify(run.assumptions), JSON.stringify(run.filters || {}), JSON.stringify(run.resultSummary)]
  );
}

async function getDocumentAsset(documentId) {
  const result = await query(
    `SELECT asset.object_key, asset.file_name, asset.media_type, asset.storage_status
     FROM shihua.document_catalog document
     JOIN shihua.source_asset asset ON asset.id = document.source_asset_id
     WHERE document.id = $1`,
    [documentId]
  );
  return result.rows[0] || null;
}

module.exports = {
  getAfricaIndex,
  getDocumentAsset,
  getEconomicDataset,
  getPlatformState,
  getSettings,
  getSpatialLayer,
  getSpatialLayerSummary,
  recordEvaluationRun
};
