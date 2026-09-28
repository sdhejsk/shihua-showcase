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
- `africa_field`、`africa_well`：非洲全量油气田和井的查询字段与完整原始记录。
- `well_log_measurement`：测井深度点与曲线数据。
- `spatial_feature`：四类空间要素及 PostGIS 几何。
- `source_tabular_record`：CSV/Excel 每个工作表的原始行。
- `document_catalog`：PDF 资料与盆地归属。
- `evaluation_run`：每次经济评价的参数、筛选条件和结果摘要。

## 启动与迁移

```powershell
Copy-Item .env.example .env
npm run db:up
npm run db:migrate
npm start
```

导入过程默认登记所有原始资产并计算 SHA-256。增加 `--upload-objects` 可将文件本体上传到 MinIO；这会传输全部 PDF、Excel 和 Shapefile，执行时间取决于本机磁盘和网络性能。

```powershell
npm run db:validate
npm run db:migrate -- --upload-objects
npm run db:health
```

## API 边界

- `GET /api/platform-state`：基础资料与模块状态。
- `GET /api/africa/index`：非洲区域的统计、样例和资料目录。
- `GET /api/spatial/{basins|contract_blocks|fields|wells}`：PostGIS 输出 GeoJSON。
- `GET /api/spatial/summary`：图层记录数。
- `GET /api/documents/{id}/download`：从 MinIO 受控下载原始文档。
- `GET /api/evaluation/economic/config`、`POST /api/evaluation/economic/run`：数据库驱动的经济评价。

`/data/*` 和 `/source-data/*` 已由服务端明确拒绝，防止应用重新退回本地文件读取路径。
