# 石化海外油气数据评价协同平台

本工程已从静态展示原型切换为数据库优先的全栈实现。运行期数据仅通过后端 API 获取：结构化业务资料、经济评价和空间对象来自 PostgreSQL/PostGIS；PDF、Excel、Shapefile 等原始文件由 MinIO 对象存储管理。

`data/` 与 `D:\shihua_data` 是迁移输入，不是前端或评价服务的运行期数据源。

## 数据底座

- PostgreSQL + PostGIS：盆地、区块、合同、油气田、井、空间几何、测井曲线、专题表和评价运行记录。
- MinIO：PDF、Excel、Shapefile 及其他原始资料本体。
- Node.js 数据 API：统一提供基础状态、区域统计、PostGIS GeoJSON、文档下载与经济评价接口。

完整表结构、导入策略和接口说明见 [数据库架构说明](docs/database_architecture.md)。

## 首次启动

前置条件：Docker Desktop 已启动，Node.js 已安装。

```powershell
Copy-Item .env.example .env
npm install
npm run db:up
npm run db:migrate
npm start
```

访问 `http://localhost:5173/frontend/index.html`。

迁移会扫描当前 `data/` 和 `D:\shihua_data`，登记全部来源资产、导入 CSV/Excel、将四份 Shapefile 转换并写入 PostGIS。默认只登记原始文件元数据与校验和；需要把原始文件本体上传到 MinIO 时执行：

```powershell
npm run db:migrate -- --upload-objects
```

这一步会处理约 3,200 份 PDF，请预留足够磁盘空间和执行时间。

## 校验命令

```powershell
npm run db:validate
npm run db:health
```

`db:validate` 不连接数据库，用于检查迁移器是否能扫描当前全部来源目录；`db:health` 检查 Node API 与 PostgreSQL/PostGIS 的连通性。

## 主要 API

- `GET /api/health`
- `GET /api/platform-state`
- `GET /api/africa/index`
- `GET /api/spatial/{basins|contract_blocks|fields|wells}`
- `GET /api/spatial/summary`
- `GET /api/documents/{id}/download`
- `GET /api/evaluation/economic/config`
- `POST /api/evaluation/economic/run`

为防止回退到本地文件读取，`/data/*` 和 `/source-data/*` 均会被服务端拒绝。
