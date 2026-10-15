# 数据库与存储架构

## 目标

平台运行期不再直接读取 `data/*.json`、`CSV`、本地 PDF 或 MapGIS 要素服务。所有业务、空间、评价和资料目录均经后端 API 访问统一数据底座。

## 存储选型

| 数据类型 | 存储 | 原因 |
| --- | --- | --- |
| 盆地、区块、合同、油气田、井、评价运行 | PostgreSQL | 强一致事务、关联查询、审计和权限边界清晰。 |
| Shapefile/GeoJSON 的几何与空间检索 | PostGIS | 支持空间索引、范围查询和 GeoJSON 输出。 |
| 测井曲线与井深序列 | PostgreSQL 井深序列表 | 可按井号和深度范围稳定读取；数据量继续增长时可平滑升级为分区表或 TimescaleDB。 |
| PDF、Excel、Shapefile 原件 | MinIO 对象存储 | 避免把约 2 GB 的二进制文件写入关系表，支持校验、版本与受控下载。 |
| 动态列、第三方专题表原始行 | PostgreSQL JSONB | 第一轮迁移不丢字段，后续稳定字段再逐步规范化。 |

PostgreSQL 与 PostGIS 是一个统一的主数据服务，不拆分为两套孤立业务库；MinIO 保存文件本体，数据库保存其目录、对象键、来源、大小和 SHA-256。

## 核心表

- `import_batch`：每次导入的批次、结果与错误。
- `source_asset`：所有来源文件的路径、对象键、大小、SHA-256 和入对象存储状态。
- `app_setting`：平台配置、资料清单、评价模型等配置化 JSON。
- `entity_profile`、`entity_detail`：盆地、区块、合同、油气田、井的资料摘要与专题表。
- `data_collection`：全球或区域数据集的导入状态、范围、清单和活动版本。
- `entity_record`：按数据集统一保存盆地、区块、合同、油气田、井的可查询实体记录；保留原始来源、标准字段和完整 JSONB 负载。
- `africa_field`、`africa_well`：早期非洲数据集的兼容表；全球集合启用后不再作为运行期主数据源。
- `well_log_measurement`：测井深度点与曲线数据。
- `spatial_feature`：四类空间要素及 PostGIS 几何；`region_key` 从原始资料的区域、国家字段归一得到，用于数据区域筛选索引，不以距离或地图边界推断区域归属。
- `data_region`、`data_country`、`data_basin`、`data_operator`：由原始属性字段刷新得到的独立筛选索引表，供空间总览快速加载筛选项；筛选条件可任意组合。
- `source_tabular_record`：CSV/Excel 每个工作表的原始行。
- `document_catalog`：PDF 资料与盆地归属。
- `evaluation_run`：每次经济评价的参数、筛选条件和结果摘要。

## 启动与迁移

```powershell
Copy-Item .env.example .env
npm run db:up
npm run db:migrate
npm run db:regions
npm start
```

全球导入会先创建 `staging` 数据集，四类空间图层校验通过后才原子切换为 `active`。导入过程登记所有原始资产；增加 `--upload-objects` 可将文件本体上传到 MinIO。完整命令和重建策略见 [全球基础数据导入说明](global_data_import.md)。

```powershell
npm run db:validate
npm run db:migrate -- --upload-objects
npm run db:health
```

## API 边界

- `GET /api/platform-state`：基础资料与模块状态。
- `GET /api/africa/index`：兼容路径，返回当前活动数据集的统计、样例和资料目录。
- `GET /api/spatial/{basins|contract_blocks|fields|wells}`：按活动数据集从 PostGIS 输出 GeoJSON，支持筛选与 `afterId` 游标分页。
- `GET /api/spatial/summary`：图层记录数。
- `GET /api/spatial/facets`：全球国家、盆地等轻量筛选项。
- `GET /api/documents/{id}/download`：从 MinIO 受控下载原始文档。
- `GET /api/evaluation/economic/config`、`POST /api/evaluation/economic/run`：数据库驱动的经济评价。

`/data/*` 和 `/source-data/*` 已由服务端明确拒绝，防止应用重新退回本地文件读取路径。
