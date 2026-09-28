CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS shihua;
SET search_path TO shihua, public;

CREATE TABLE IF NOT EXISTS import_batch (
  id UUID PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  source_root TEXT NOT NULL,
  manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS source_asset (
  id BIGSERIAL PRIMARY KEY,
  import_batch_id UUID REFERENCES import_batch(id),
  source_path TEXT NOT NULL UNIQUE,
  relative_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  media_type TEXT,
  file_extension TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  sha256 TEXT,
  object_key TEXT,
  storage_status TEXT NOT NULL DEFAULT 'metadata_only' CHECK (storage_status IN ('metadata_only', 'uploaded', 'missing', 'failed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS source_asset_extension_idx ON source_asset(file_extension);
CREATE INDEX IF NOT EXISTS source_asset_metadata_idx ON source_asset USING GIN(metadata);

CREATE TABLE IF NOT EXISTS app_setting (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  source_asset_id BIGINT REFERENCES source_asset(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_profile (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('basin', 'block', 'contract', 'field', 'well')),
  entity_key TEXT NOT NULL,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_asset_id BIGINT REFERENCES source_asset(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_type, entity_key)
);

CREATE INDEX IF NOT EXISTS entity_profile_type_key_idx ON entity_profile(entity_type, entity_key);
CREATE INDEX IF NOT EXISTS entity_profile_document_idx ON entity_profile USING GIN(profile);

CREATE TABLE IF NOT EXISTS entity_detail (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('basin', 'block', 'contract', 'field', 'well')),
  entity_key TEXT NOT NULL,
  detail_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_asset_id BIGINT REFERENCES source_asset(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_type, entity_key, detail_key)
);

CREATE INDEX IF NOT EXISTS entity_detail_type_key_idx ON entity_detail(entity_type, entity_key);
CREATE INDEX IF NOT EXISTS entity_detail_payload_idx ON entity_detail USING GIN(payload);

CREATE TABLE IF NOT EXISTS well_log_measurement (
  id BIGSERIAL PRIMARY KEY,
  well_id TEXT,
  well_name TEXT NOT NULL,
  depth_m NUMERIC,
  payload JSONB NOT NULL,
  source_asset_id BIGINT REFERENCES source_asset(id),
  UNIQUE(source_asset_id, well_name, depth_m)
);

CREATE INDEX IF NOT EXISTS well_log_measurement_well_depth_idx ON well_log_measurement(well_name, depth_m);
CREATE INDEX IF NOT EXISTS well_log_measurement_payload_idx ON well_log_measurement USING GIN(payload);

CREATE TABLE IF NOT EXISTS africa_field (
  id BIGSERIAL PRIMARY KEY,
  source_row_number INTEGER NOT NULL,
  field_id TEXT,
  field_name TEXT NOT NULL,
  country_name TEXT,
  basin_name TEXT,
  production_status TEXT,
  operator_name TEXT,
  contract_block_names TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  payload JSONB NOT NULL,
  source_asset_id BIGINT REFERENCES source_asset(id),
  UNIQUE(source_asset_id, source_row_number)
);

CREATE INDEX IF NOT EXISTS africa_field_name_idx ON africa_field(field_name);
CREATE INDEX IF NOT EXISTS africa_field_country_idx ON africa_field(country_name);
CREATE INDEX IF NOT EXISTS africa_field_basin_idx ON africa_field(basin_name);
CREATE INDEX IF NOT EXISTS africa_field_status_idx ON africa_field(production_status);
CREATE INDEX IF NOT EXISTS africa_field_payload_idx ON africa_field USING GIN(payload);

CREATE TABLE IF NOT EXISTS africa_well (
  id BIGSERIAL PRIMARY KEY,
  source_row_number INTEGER NOT NULL,
  well_id TEXT,
  well_name TEXT NOT NULL,
  country_name TEXT,
  basin_name TEXT,
  block_name TEXT,
  field_name TEXT,
  operator_name TEXT,
  technical_status TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  payload JSONB NOT NULL,
  source_asset_id BIGINT REFERENCES source_asset(id),
  UNIQUE(source_asset_id, source_row_number)
);

CREATE INDEX IF NOT EXISTS africa_well_name_idx ON africa_well(well_name);
CREATE INDEX IF NOT EXISTS africa_well_country_idx ON africa_well(country_name);
CREATE INDEX IF NOT EXISTS africa_well_basin_idx ON africa_well(basin_name);
CREATE INDEX IF NOT EXISTS africa_well_payload_idx ON africa_well USING GIN(payload);

CREATE TABLE IF NOT EXISTS spatial_feature (
  id BIGSERIAL PRIMARY KEY,
  source_asset_id BIGINT REFERENCES source_asset(id),
  layer_key TEXT NOT NULL CHECK (layer_key IN ('basins', 'contract_blocks', 'fields', 'wells')),
  source_feature_key TEXT NOT NULL,
  feature_name TEXT,
  country_name TEXT,
  basin_name TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  geometry GEOMETRY(Geometry, 4326),
  UNIQUE(source_asset_id, layer_key, source_feature_key)
);

CREATE INDEX IF NOT EXISTS spatial_feature_layer_idx ON spatial_feature(layer_key);
CREATE INDEX IF NOT EXISTS spatial_feature_country_idx ON spatial_feature(country_name);
CREATE INDEX IF NOT EXISTS spatial_feature_basin_idx ON spatial_feature(basin_name);
CREATE INDEX IF NOT EXISTS spatial_feature_properties_idx ON spatial_feature USING GIN(properties);
CREATE INDEX IF NOT EXISTS spatial_feature_geometry_idx ON spatial_feature USING GIST(geometry);

CREATE TABLE IF NOT EXISTS source_tabular_record (
  id BIGSERIAL PRIMARY KEY,
  source_asset_id BIGINT NOT NULL REFERENCES source_asset(id) ON DELETE CASCADE,
  sheet_name TEXT NOT NULL DEFAULT '',
  row_number INTEGER NOT NULL,
  payload JSONB NOT NULL,
  UNIQUE(source_asset_id, sheet_name, row_number)
);

CREATE INDEX IF NOT EXISTS source_tabular_record_payload_idx ON source_tabular_record USING GIN(payload);

CREATE TABLE IF NOT EXISTS document_catalog (
  id BIGSERIAL PRIMARY KEY,
  source_asset_id BIGINT NOT NULL UNIQUE REFERENCES source_asset(id) ON DELETE CASCADE,
  document_type TEXT,
  basin_name TEXT,
  title TEXT,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_catalog_basin_idx ON document_catalog(basin_name);

CREATE TABLE IF NOT EXISTS evaluation_run (
  id UUID PRIMARY KEY,
  model_key TEXT NOT NULL,
  assumptions JSONB NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_summary JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS evaluation_run_model_created_idx ON evaluation_run(model_key, created_at DESC);
