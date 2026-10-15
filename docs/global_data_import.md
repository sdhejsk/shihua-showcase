# 全球基础数据导入

## 范围与存储

本项目将同一批全球数据作为一个 `data_collection` 导入，默认键为
`global_2025`。导入过程不修改源目录，并按下列职责存储：

- PostgreSQL：导入批次、文件资产元数据、原始表格行、统一实体记录和评价运行记录。
- PostGIS：盆地、合同区块、油气田、井位的几何、可筛选属性和空间索引。
- MinIO：原始 `.zip`、Shapefile 组件、CSV/XLSX、PDF 等可下载对象。

`data_collection` 先处于 `staging`，只有盆地、区块、油气田、井位四类空间层均通过非空校验时，才被标记为 `active`。旧活动数据集会被归档而不会被覆盖；导入失败时平台继续使用旧数据集。

## 首次导入

1. 将完整源目录保存在任意可访问磁盘。例如当前开发机为 `S:/C2/石化数据/给杨老师`。
2. 在 `.env` 配置 `SHIHUA_SOURCE_ROOT`，并确认 `POSTGRES_DATA_DIR` 和 `MINIO_DATA_DIR` 指向容量充足的 D 盘目录。
3. 启动基础服务：

   ```powershell
   docker compose up -d
   ```

4. 先扫描来源，不写数据库：

   ```powershell
   npm run db:migrate:global:check -- --source-root 'S:\C2\石化数据\给杨老师'
   ```

5. 正式导入并保存原始文件：

   ```powershell
   npm run db:migrate -- --source-root 'S:\C2\石化数据\给杨老师' --upload-objects
   ```

压缩包在 `runtime-data/import-staging` 解压用于读取，完成或失败后会自动清理；S 盘原始文件保持不变。

## 重建与检查

同名数据集已经存在时，显式传入 `--replace` 才会重新构建：

```powershell
npm run db:migrate -- --source-root 'S:\C2\石化数据\给杨老师' --replace --upload-objects
```

若 MinIO 中已经保留了原始对象，重跑时可以不带 `--upload-objects`；脚本会保留既有的 `uploaded` 存储状态。开发验收：

```powershell
npm run db:validate -- --source-root 'S:\C2\石化数据\给杨老师'
npm run db:health
```

空间 API 按 `collection_key` 自动只读取活动数据集。地图初始状态不预取业务要素；用户提交筛选条件或选择分批加载某一图层时，后端再从 PostGIS 查询。井位等大图层使用 `afterId` 游标分批输出，避免大偏移分页和浏览器长时间卡顿。完成数据迁移后应执行 `npm run db:regions`，按原始资料的区域、国家、盆地和作业者字段刷新独立筛选索引；这些索引不使用距离、几何边界或外部地理参照数据。
