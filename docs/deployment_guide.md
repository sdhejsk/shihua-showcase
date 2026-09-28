# 石化海外油气数据评价协同平台部署手册

本文面向在另一台 Windows 电脑上克隆本仓库、接收石化业务数据并独立运行系统的部署人员。

## 1. 部署结果与边界

部署完成后，访问 `http://localhost:5173/frontend/index.html` 可使用数据概览、空间总览、对象资料、经济评价和评价方法库。

系统运行期的数据流为：

```text
浏览器前端 -> Node.js 数据 API -> PostgreSQL / PostGIS、MinIO
```

- PostgreSQL：对象档案、专题表、测井曲线、评价参数及评价记录。
- PostGIS：盆地、合同区块、油气田、井位的几何和空间索引。
- MinIO：PDF、Excel、Shapefile 与 `.dbf/.shx/.prj/.cpg` 等原始文件本体。
- `data/` 与外部源数据目录：仅用于首次迁移；系统启动后不直接读取这些文件。
- MapGIS Server 不是本系统数据库模式的必需服务。

Git 仓库不包含 `runtime-data/`，也不应包含大型原始资料。因此单独执行 `git clone` 只能取得程序，不能取得已经建好的业务数据库。

## 2. 部署人员需要拿到的内容

部署前请确认收到以下两部分内容：

1. 本 Git 仓库。
2. 完整的石化原始资料目录，以下称为“源数据根目录”。

源数据根目录必须保持交付时的目录结构。至少应包含迁移器要读取的空间数据，例如：

```text
<源数据根目录>/
  Africa/
    Africa Basins-2025/
      African Basins-2025.shp
      African Basins-2025.shx
      African Basins-2025.dbf
      African Basins-2025.prj
      African Basins-2025.cpg
    04-非洲合同区块-2478个/
      Africa Contract Blocks.shp
      ...
    非洲油气田-4567个/
      Fields_poly.shp
      ...
    非洲钻井-2025/
      Wells_point.shp
      ...
```

同一份 Shapefile 的 `.shp`、`.shx`、`.dbf`、`.prj`、`.cpg` 必须同目录、同文件名前缀。不要只传 `.shp` 文件，否则属性、坐标系或中文编码会丢失。

若需要在系统内预览或下载原始 PDF、Excel、Shapefile，还应接收完整原始附件；仅交付空间和表格数据时，空间浏览与评价可运行，但资料原件下载不会完整。

## 3. 前置软件与磁盘规划

安装以下软件：

- Docker Desktop，启动后确认其处于 Running 状态。
- Node.js 20 LTS 或更高版本。
- Git。
- 推荐：DBeaver，用于查看 PostgreSQL/PostGIS；浏览器即可查看 MinIO Console。

建议将源数据、PostgreSQL 数据目录和 MinIO 数据目录放在 D、E 等数据盘。首次迁移会同时保留源数据、数据库数据和对象存储数据，请预留高于源资料总量两倍的可用磁盘空间。

## 4. 克隆代码并创建本机配置

在 PowerShell 中执行：

```powershell
git clone https://github.com/sdhejsk/shihua-showcase.git
cd shihua-showcase
npm install
Copy-Item .env.example .env
notepad .env
```

`.env` 是本机私有配置，已被 Git 忽略，不要提交或发送其中的密码。以下是新机器的参考配置，路径应按实际情况修改：

```ini
# PostgreSQL / PostGIS
POSTGRES_DB=shihua
POSTGRES_USER=shihua
POSTGRES_PASSWORD=请设置本机数据库密码
POSTGRES_PORT=5432
DATABASE_URL=postgresql://shihua:请设置本机数据库密码@localhost:5432/shihua

# MinIO。ROOT 与 ACCESS 两组账号应保持一致。
MINIO_ROOT_USER=shihua
MINIO_ROOT_PASSWORD=请设置本机对象存储密码
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=shihua
MINIO_SECRET_KEY=请设置本机对象存储密码
MINIO_BUCKET=shihua-source-data
MINIO_CONSOLE_PORT=9001

# 应用与数据位置
PORT=5173
MIGRATION_FALLBACK=false
SHIHUA_SOURCE_ROOT=E:/shihua_data
POSTGRES_DATA_DIR=E:/shihua-runtime/postgres
MINIO_DATA_DIR=E:/shihua-runtime/minio

# 在线底图
TDT_TOKEN=04265e698b77d4fd1d990d5e69d65647
```

重要规则：

- `DATABASE_URL` 中的用户名、密码、端口、数据库名必须分别与 `POSTGRES_USER`、`POSTGRES_PASSWORD`、`POSTGRES_PORT`、`POSTGRES_DB` 一致。
- `MINIO_ROOT_USER` 与 `MINIO_ACCESS_KEY` 保持一致；`MINIO_ROOT_PASSWORD` 与 `MINIO_SECRET_KEY` 保持一致。
- 如果本机端口 `5432`、`9000`、`9001` 或 `5173` 被占用，可以修改对应端口。修改 `POSTGRES_PORT` 后必须同步修改 `DATABASE_URL`。
- `SHIHUA_SOURCE_ROOT` 指向资料目录的最外层，不是其内部的 `Africa` 子目录。
- 未取得可用天地图令牌时，可保留示例值；若网络、白名单或应用类型限制导致地图瓦片加载失败，应向天地图申请或替换为该部署环境可用的令牌。

## 5. 首次启动数据服务

确认 Docker Desktop 已启动后执行：

```powershell
npm run db:up
npm run config:check
npm run config:check -- --migration
```

两条检查都应输出 `OK`：

- 第一条检查应用端口、PostgreSQL/PostGIS、MinIO、对象桶、天地图令牌和持久化目录。
- 第二条额外检查源数据根目录是否存在，首次迁移前必须通过。

可用以下地址确认 Docker 服务：

```text
MinIO Console: http://localhost:9001
应用健康接口: http://localhost:5173/api/health
```

## 6. 首次数据入库

### 6.1 完整入库，推荐

执行：

```powershell
npm run db:migrate -- --upload-objects
```

该命令会执行以下操作：

1. 扫描仓库内 `data/` 和 `SHIHUA_SOURCE_ROOT` 下的全部来源资产。
2. 为每个来源文件记录路径、大小、类型、校验和和对象键。
3. 解析 CSV、Excel，将稳定查询字段写入 PostgreSQL，并将完整原始行保留为 JSONB。
4. 解析 Shapefile 的属性和几何，将其写入 PostGIS 的 `spatial_feature` 表，并建立空间索引。
5. 将 PDF、Excel、Shapefile 及附属文件写入 MinIO。
6. 建立资料目录、对象资料索引和评价所需的字段数据。

首次执行时间取决于资料数量、磁盘和网络性能。执行期间请不要关闭 PowerShell、Docker Desktop 或移动源数据目录。

### 6.2 仅导入业务和空间数据

如果只需浏览对象、地图和运行评价，暂不需要原始附件下载，可执行：

```powershell
npm run db:migrate
```

此模式会登记原始附件元数据，但不上传文件本体到 MinIO。之后需要补传附件时执行：

```powershell
npm run db:migrate -- --upload-objects
```

## 7. 启动应用与验收

导入完成后执行：

```powershell
npm start
```

打开：

```text
http://localhost:5173/frontend/index.html
```

部署验收建议依次检查：

1. 打开数据概览，确认没有红色加载错误。
2. 打开数据信息模块的空间总览，确认天地图底图、盆地、合同区块、油气田和井位可加载。
3. 点击“分批加载全部井位”，确认井位逐批增加而页面保持可操作。
4. 打开对象资料和数据目录，确认对象档案和资料目录存在。
5. 打开评价算法模块，执行一个评价步骤，确认候选对象和阶段结果正常显示。
6. 运行以下命令确认服务健康：

```powershell
npm run db:health
npm run config:check
```

## 8. 后续日常启动和关闭

数据完成导入后，每次启动不需要再次迁移：

```powershell
cd <仓库目录>
npm run db:up
npm start
```

停止应用时，在运行 `npm start` 的窗口按 `Ctrl + C`。停止 Docker 数据服务时执行：

```powershell
npm run db:down
```

`db:down` 不会删除 D、E 盘中的持久化数据。请勿手工删除 `POSTGRES_DATA_DIR` 或 `MINIO_DATA_DIR`，其中分别保存数据库与原始资料对象。

## 9. 通过备份恢复的替代方案

当数据量较大时，建议由已有环境交付 PostgreSQL/PostGIS 备份和 MinIO 数据备份，而不是在新机器重新解析全部原始资料。

恢复时仍需先完成第 3 至第 5 节的 Docker 与 `.env` 配置，然后恢复 PostgreSQL 与 MinIO 两部分数据。两者必须成对恢复：PostgreSQL 保存资料目录、对象键和业务数据；MinIO 保存对象键对应的文件本体。

恢复完成后，不执行 `db:migrate`，直接运行：

```powershell
npm run config:check
npm start
```

## 10. 常见问题

| 现象 | 排查与处理 |
| --- | --- |
| `Database service is unavailable` | 确认 Docker Desktop 已启动，执行 `npm run db:up`，并检查 `.env` 中 `POSTGRES_PORT` 与 `DATABASE_URL` 端口一致。 |
| `未找到源数据目录` | 检查 `SHIHUA_SOURCE_ROOT` 是否指向实际根目录，路径使用 `/` 或双反斜杠。 |
| 迁移找不到 Shapefile | 检查 `.shp/.shx/.dbf/.prj/.cpg` 是否完整且目录层级未改变。 |
| 原始资料无法下载 | 执行 `npm run db:migrate -- --upload-objects`，并执行 `npm run config:check` 确认 MinIO 正常。 |
| 天地图底图空白 | 执行 `npm run config:check` 检查令牌；再检查网络、天地图应用类型与白名单。 |
| 端口已被占用 | 为冲突服务更换 `.env` 中对应端口；数据库端口变更后同步修改 `DATABASE_URL`。 |
| 页面仍显示旧脚本效果 | 使用 `Ctrl + F5` 强制刷新浏览器缓存。 |

## 11. 数据库查看方式

使用 DBeaver 连接 PostgreSQL/PostGIS：

```text
Host: localhost
Port: .env 中的 POSTGRES_PORT
Database: shihua
User: .env 中的 POSTGRES_USER
Password: .env 中的 POSTGRES_PASSWORD
Schema: shihua
```

常用表包括：

- `shihua.spatial_feature`：空间要素与 PostGIS 几何。
- `shihua.africa_field`、`shihua.africa_well`：油气田、井及完整原始行。
- `shihua.entity_profile`、`shihua.entity_detail`：对象档案和专题资料。
- `shihua.source_asset`、`shihua.document_catalog`：来源文件与资料目录。
- `shihua.evaluation_run`：评价运行记录。

MinIO 原始文件可通过浏览器访问 `http://localhost:9001`。登录账号为 `.env` 中的 `MINIO_ROOT_USER` 与 `MINIO_ROOT_PASSWORD`，桶名为 `shihua-source-data`。
