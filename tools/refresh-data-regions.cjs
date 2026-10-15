#!/usr/bin/env node

/*
 * Builds the spatial overview's region index only from delivered business
 * attributes. No geometry, distance, bounding box, or external geography
 * reference is used here.
 */

const { getPool, closeDatabase } = require("../server/data-access/database.cjs");

const regionExpression = `COALESCE(
  NULLIF(properties->>'REGION_NM', ''),
  NULLIF(properties->>'region_nm', ''),
  NULLIF(properties->>'REGION', ''),
  NULLIF(properties->>'region', '')
)`;
const operatorExpression = `COALESCE(
  NULLIF(properties->>'operator_name', ''),
  NULLIF(properties->>'operator', ''),
  NULLIF(properties->>'OPR_CURR', ''),
  NULLIF(properties->>'OPERATOR_NAME', ''),
  NULLIF(properties->>'OPERATOR', '')
)`;

async function main() {
  const pool = getPool();
  try {
    await pool.query(`
      ALTER TABLE shihua.spatial_feature ADD COLUMN IF NOT EXISTS region_key TEXT;
      CREATE INDEX IF NOT EXISTS spatial_feature_region_idx ON shihua.spatial_feature(region_key);
      CREATE INDEX IF NOT EXISTS spatial_feature_data_region_idx
        ON shihua.spatial_feature ((COALESCE(
          region_key,
          NULLIF(properties->>'REGION_NM', ''),
          NULLIF(properties->>'region_nm', ''),
          NULLIF(properties->>'REGION', ''),
          NULLIF(properties->>'region', '')
        )));
      CREATE INDEX IF NOT EXISTS spatial_feature_collection_layer_region_idx
        ON shihua.spatial_feature (
          collection_key,
          layer_key,
          (COALESCE(
            region_key,
            NULLIF(properties->>'REGION_NM', ''),
            NULLIF(properties->>'region_nm', ''),
            NULLIF(properties->>'REGION', ''),
            NULLIF(properties->>'region', '')
          )),
          id
        );
      CREATE INDEX IF NOT EXISTS spatial_feature_collection_region_country_basin_idx
        ON shihua.spatial_feature (
          collection_key,
          (COALESCE(
            region_key,
            NULLIF(properties->>'REGION_NM', ''),
            NULLIF(properties->>'region_nm', ''),
            NULLIF(properties->>'REGION', ''),
            NULLIF(properties->>'region', '')
          )),
          country_name,
          basin_name
        );
      CREATE TABLE IF NOT EXISTS shihua.data_region (
        region_key TEXT PRIMARY KEY,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS shihua.data_country (
        country_name TEXT PRIMARY KEY,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS shihua.data_basin (
        basin_name TEXT PRIMARY KEY,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS shihua.data_operator (
        operator_name TEXT PRIMARY KEY,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const basins = await pool.query(`
      WITH source_regions AS (
        SELECT
          LOWER(BTRIM(source_country.value)) AS country_token,
          ${regionExpression} AS region_key
        FROM shihua.spatial_feature
        CROSS JOIN LATERAL regexp_split_to_table(
          COALESCE(NULLIF(country_name, ''), ''),
          '\\s*~\\s*'
        ) AS source_country(value)
        WHERE layer_key <> 'basins'
          AND ${regionExpression} IS NOT NULL
      ),
      country_regions AS (
        SELECT DISTINCT ON (country_token) country_token, region_key
        FROM source_regions
        ORDER BY country_token, region_key
      ),
      basin_regions AS (
        SELECT basin.id,
          CASE
            WHEN COUNT(DISTINCT country_regions.region_key) = 1 THEN MIN(country_regions.region_key)
            WHEN COUNT(DISTINCT country_regions.region_key) > 1 THEN '跨区域'
            ELSE '未分类'
          END AS region_key
        FROM shihua.spatial_feature AS basin
        CROSS JOIN LATERAL regexp_split_to_table(
          COALESCE(NULLIF(basin.properties->>'COUNTRIES', ''), NULLIF(basin.country_name, ''), ''),
          '\\s*~\\s*'
        ) AS basin_country(value)
        LEFT JOIN country_regions
          ON country_regions.country_token = LOWER(BTRIM(basin_country.value))
        WHERE basin.layer_key = 'basins'
        GROUP BY basin.id
      )
      UPDATE shihua.spatial_feature AS basin
      SET region_key = basin_regions.region_key
      FROM basin_regions
      WHERE basin.id = basin_regions.id
        AND basin.region_key IS DISTINCT FROM basin_regions.region_key
    `);

    await pool.query(`
      TRUNCATE shihua.data_region, shihua.data_country, shihua.data_basin, shihua.data_operator;
      INSERT INTO shihua.data_region (region_key, updated_at)
      SELECT DISTINCT region_key, NOW()
      FROM (
        SELECT ${regionExpression} AS region_key
        FROM shihua.spatial_feature
        WHERE ${regionExpression} IS NOT NULL
          AND ${regionExpression} <> ''
        UNION
        SELECT region_key
        FROM shihua.spatial_feature
        WHERE layer_key = 'basins'
          AND region_key IN ('跨区域', '未分类')
      ) AS source_regions
      ORDER BY 1;

      INSERT INTO shihua.data_country (country_name, updated_at)
      SELECT DISTINCT BTRIM(country_part.value), NOW()
      FROM shihua.spatial_feature
      CROSS JOIN LATERAL regexp_split_to_table(country_name, '\\s*~\\s*') AS country_part(value)
      WHERE BTRIM(country_part.value) <> ''
      ORDER BY 1;

      INSERT INTO shihua.data_basin (basin_name, updated_at)
      SELECT DISTINCT BTRIM(basin_name), NOW()
      FROM shihua.spatial_feature
      WHERE basin_name IS NOT NULL AND BTRIM(basin_name) <> ''
      ORDER BY 1;

      INSERT INTO shihua.data_operator (operator_name, updated_at)
      SELECT DISTINCT ${operatorExpression}, NOW()
      FROM shihua.spatial_feature
      WHERE layer_key IN ('contract_blocks', 'fields')
        AND ${operatorExpression} IS NOT NULL
      ORDER BY 1;
    `);

    console.log(`Indexed raw region fields and refreshed ${basins.rowCount} basin records.`);
  } finally {
    await closeDatabase();
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
