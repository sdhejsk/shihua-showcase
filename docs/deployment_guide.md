# 部署与数据接入指南

## 克隆后的边界

Git 仓库包含程序、Schema、迁移器和少量迁移配置；不包含本机运行库 `runtime-data/`，也不应将包含原始资料的大型数据目录提交 Git。因此，新机器仅执行 `git clone` 后拥有的是应用代码，不是已经装载完整业务数据的运行环境。

有两种交付方式：

1. **重建型交付**：同时交付完整原始资料目录，在 `.env` 设置 `SHIHUA_SOURCE_ROOT`，运行迁移器重建 PostgreSQL/PostGIS；需要在线查看原始文件时，再使用 `--upload-objects` 上传至 MinIO。
2. **恢复型交付**：交付 PostgreSQL 备份和 MinIO 数据备份，在新环境恢复后直接启动应用。适合已有完整库、数据量较大或生产环境迁移。

## 新机器重建

1. 安装 Docker Desktop 与 Node.js，启动 Docker Desktop。
2. 克隆仓库后执行 `Copy-Item .env.example .env`。
3. 编辑 `.env`：设置数据库密码、`SHIHUA_SOURCE_ROOT`、可选的 `TDT_TOKEN`，并设置数据库持久化位置。

```ini
SHIHUA_SOURCE_ROOT=E:/shihua-data
POSTGRES_DATA_DIR=E:/shihua-runtime/postgres
MINIO_DATA_DIR=E:/shihua-runtime/minio
```

4. 执行 `npm install`、`npm run db:up`、`npm run db:migrate`。
5. 原始附件需要由系统下载时，执行 `npm run db:migrate -- --upload-objects`。
6. 执行 `npm start`，再访问 `http://localhost:5173/frontend/index.html`。

`npm run db:migrate` 会把 Shapefile 的属性和几何解析写入 PostGIS，把 CSV/Excel 的稳定查询字段及原始行写入 PostgreSQL/JSONB；默认只登记原件的目录、大小、校验和与对象键。`--upload-objects` 才会把文件本体写入 MinIO。

## 恢复型交付

使用同一份 `.env` 启动 `npm run db:up` 后恢复 PostgreSQL 和 MinIO 备份。恢复完成后运行：

```powershell
npm run db:health
npm start
```

PostgreSQL 与 MinIO 是一组需要同时恢复的持久化数据：前者保存对象键和目录，后者保存对应文件本体。不要只复制其中一方。

## 配置原则

- 数据库、MinIO、端口、数据卷位置和公开底图令牌均通过 `.env` 配置；`.env` 不提交 Git。
- 前端 API 使用相对路径 `/api/*`，部署到不同主机或反向代理路径时无需修改前端源码。
- API 路由与数据库字段映射属于程序的稳定契约；接入新数据源应新增导入适配器和字段映射配置，不应在页面中写入某个文件路径或样例数据。
- `MIGRATION_FALLBACK` 默认 `false`。只有排查历史迁移时才可临时开启，常规和生产环境保持关闭。
