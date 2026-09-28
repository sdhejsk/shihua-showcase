# 石化海外油气数据评价协同平台

这是一个数据库优先的全栈系统。浏览器只调用 Node.js 提供的同域 `/api/*`；Node 服务负责访问 PostgreSQL/PostGIS、MinIO 和经济评价引擎。运行期不会读取仓库中的 `data/` 文件，也不依赖 MapGIS Server。

## 系统结构

| 层级 | 目录/服务 | 职责 |
| --- | --- | --- |
| 前端 | `frontend/` | 数据概览、对象资料、空间地图、评价流程和方法库。 |
| API 与业务 | `server.js`、`server/` | REST API、数据访问边界、经济评价计算。 |
| 关系与空间数据 | PostgreSQL + PostGIS | 业务对象、专题行、空间几何、评价记录。 |
| 原始文件 | MinIO | PDF、Excel、Shapefile 及其 `.shp/.shx/.dbf/.prj/.cpg` 附属文件。 |
| 数据库初始化 | `database/init/` | PostGIS 扩展、Schema、索引和表定义。 |
| 数据接入 | `tools/migrate-to-database.cjs` | 扫描源数据，登记资产，解析表格和 Shapefile 并导入数据库。 |
| 迁移输入 | `data/`、`SHIHUA_SOURCE_ROOT` | 仅在执行迁移时使用，不是运行期数据源。 |

## 文档索引

| 文档 | 仓库位置 | 用途 |
| --- | --- | --- |
| [部署与数据接入指南](docs/deployment_guide.md) | `docs/deployment_guide.md` | 提供给克隆仓库后的部署人员，包含环境配置、数据交接、入库、启动、验收、令牌更换和故障排查。 |
| [数据库架构说明](docs/database_architecture.md) | `docs/database_architecture.md` | 说明 PostgreSQL/PostGIS、MinIO、核心表、原始资料和 API 边界。 |

## 本机启动

前置条件：Docker Desktop 已启动，Node.js 已安装。首次启动前创建本机配置：

```powershell
Copy-Item .env.example .env
notepad .env
npm install
npm run db:up
```

在 `.env` 中至少设置 `SHIHUA_SOURCE_ROOT` 为完整源数据根目录。需要重新构建数据库时执行：

```powershell
npm run db:migrate
npm start
```

访问 `http://localhost:5173/frontend/index.html`。若已有恢复好的数据库与对象存储，跳过 `npm run db:migrate` 即可。

## 日常命令

```powershell
npm run db:up
npm start
npm run db:health
npm run config:check
npm run config:check -- --migration
npm run db:down
```

`runtime-data/` 是 Docker 的本机持久化目录，默认不提交 Git。可在 `.env` 通过 `POSTGRES_DATA_DIR` 和 `MINIO_DATA_DIR` 指向 D 盘或服务器挂载盘。

## 主要 API

- `GET /api/health`
- `GET /api/client-config`
- `GET /api/platform-state`
- `GET /api/africa/index`
- `GET /api/spatial/{basins|contract_blocks|fields|wells}`
- `GET /api/spatial/summary`
- `GET /api/documents/{id}/download`
- `GET /api/evaluation/economic/config`
- `POST /api/evaluation/economic/run`

`/data/*` 与 `/source-data/*` 默认返回 `410`，防止前端或业务逻辑重新绕过数据库读取本地文件。
