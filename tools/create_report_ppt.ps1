param(
  [string]$OutputPath = "D:\pythonProject\shihua_showcase\docs\石化地学数据展示平台_系统汇报.pptx"
)

$ErrorActionPreference = "Stop"

function RgbColor([int]$r, [int]$g, [int]$b) {
  return $r + ($g * 256) + ($b * 65536)
}

function Add-TextBox($slide, [string]$text, [double]$left, [double]$top, [double]$width, [double]$height, [int]$fontSize = 18, [int]$color = 0, [bool]$bold = $false, [string]$fontName = "Microsoft YaHei") {
  $shape = $slide.Shapes.AddTextbox(1, $left, $top, $width, $height)
  $shape.TextFrame.TextRange.Text = $text
  $shape.TextFrame.TextRange.Font.Name = $fontName
  $shape.TextFrame.TextRange.Font.Size = $fontSize
  $shape.TextFrame.TextRange.Font.Color.RGB = $color
  $shape.TextFrame.TextRange.Font.Bold = if ($bold) { -1 } else { 0 }
  $shape.TextFrame.MarginLeft = 0
  $shape.TextFrame.MarginRight = 0
  $shape.TextFrame.MarginTop = 0
  $shape.TextFrame.MarginBottom = 0
  return $shape
}

function Add-Title($slide, [string]$title, [string]$subtitle = "") {
  Add-TextBox $slide $title 44 28 850 52 24 (RgbColor 9 30 66) $true | Out-Null
  if ($subtitle) {
    Add-TextBox $slide $subtitle 44 82 820 26 11 (RgbColor 91 111 137) $false | Out-Null
  }
}

function Add-SectionTag($slide, [string]$text) {
  $shape = $slide.Shapes.AddShape(5, 44, 500, 190, 24)
  $shape.Fill.ForeColor.RGB = RgbColor 232 241 255
  $shape.Line.ForeColor.RGB = RgbColor 202 218 245
  $shape.TextFrame.TextRange.Text = $text
  $shape.TextFrame.TextRange.Font.Name = "Microsoft YaHei"
  $shape.TextFrame.TextRange.Font.Size = 10
  $shape.TextFrame.TextRange.Font.Bold = -1
  $shape.TextFrame.TextRange.Font.Color.RGB = RgbColor 32 94 207
  return $shape
}

function Add-Card($slide, [string]$title, [string]$body, [double]$left, [double]$top, [double]$width, [double]$height, [int]$accent = 0x00D1AA) {
  $card = $slide.Shapes.AddShape(5, $left, $top, $width, $height)
  $card.Fill.ForeColor.RGB = RgbColor 248 251 255
  $card.Line.ForeColor.RGB = RgbColor 217 227 240
  $card.Line.Weight = 1
  $bar = $slide.Shapes.AddShape(1, $left, $top, 6, $height)
  $bar.Fill.ForeColor.RGB = $accent
  $bar.Line.Visible = 0
  Add-TextBox $slide $title ($left + 18) ($top + 16) ($width - 30) 24 15 (RgbColor 20 47 92) $true | Out-Null
  $text = Add-TextBox $slide $body ($left + 18) ($top + 46) ($width - 30) ($height - 52) 10 (RgbColor 91 111 137) $false
  $text.TextFrame.TextRange.ParagraphFormat.SpaceAfter = 4
  return $card
}

function Add-BulletList($slide, [string[]]$items, [double]$left, [double]$top, [double]$width, [double]$height, [int]$fontSize = 13) {
  $text = ($items | ForEach-Object { "• $_" }) -join "`r"
  $shape = Add-TextBox $slide $text $left $top $width $height $fontSize (RgbColor 59 76 104) $false
  $shape.TextFrame.TextRange.ParagraphFormat.SpaceAfter = 6
  return $shape
}

function Add-Pill($slide, [string]$text, [double]$left, [double]$top, [double]$width, [int]$fill = 0) {
  if ($fill -eq 0) { $fill = RgbColor 232 247 242 }
  $shape = $slide.Shapes.AddShape(5, $left, $top, $width, 22)
  $shape.Fill.ForeColor.RGB = $fill
  $shape.Line.Visible = 0
  $shape.TextFrame.TextRange.Text = $text
  $shape.TextFrame.TextRange.Font.Name = "Microsoft YaHei"
  $shape.TextFrame.TextRange.Font.Size = 9
  $shape.TextFrame.TextRange.Font.Bold = -1
  $shape.TextFrame.TextRange.Font.Color.RGB = RgbColor 15 109 88
  return $shape
}

function Add-FlowBox($slide, [string]$title, [string]$body, [double]$left, [double]$top, [double]$width, [double]$height, [int]$fill) {
  $shape = $slide.Shapes.AddShape(5, $left, $top, $width, $height)
  $shape.Fill.ForeColor.RGB = $fill
  $shape.Line.ForeColor.RGB = RgbColor 198 214 238
  Add-TextBox $slide $title ($left + 12) ($top + 10) ($width - 24) 20 13 (RgbColor 14 42 83) $true | Out-Null
  Add-TextBox $slide $body ($left + 12) ($top + 34) ($width - 24) ($height - 42) 9 (RgbColor 70 88 117) $false | Out-Null
  return $shape
}

function Add-Arrow($slide, [double]$left, [double]$top, [double]$width) {
  $line = $slide.Shapes.AddLine($left, $top, $left + $width, $top)
  $line.Line.ForeColor.RGB = RgbColor 32 94 207
  $line.Line.Weight = 2.25
  $line.Line.EndArrowheadStyle = 3
  return $line
}

function Add-Background($slide) {
  $bg = $slide.Shapes.AddShape(1, 0, 0, 960, 540)
  $bg.Fill.ForeColor.RGB = RgbColor 245 248 252
  $bg.Line.Visible = 0
  $accent = $slide.Shapes.AddShape(1, 0, 0, 960, 7)
  $accent.Fill.ForeColor.RGB = RgbColor 32 94 207
  $accent.Line.Visible = 0
}

$root = "D:\pythonProject\shihua_showcase"
$overview = Get-Content "$root\data\system_overview.json" -Raw | ConvertFrom-Json
$inventory = Get-Content "$root\data\data_inventory.json" -Raw | ConvertFrom-Json
$profiles = Get-Content "$root\data\well_excel_profiles.json" -Raw | ConvertFrom-Json
$wellCount = ($profiles.PSObject.Properties | Measure-Object).Count
$wellTableCount = ($inventory.well_tables.PSObject.Properties | Measure-Object).Count
$basinTableCount = ($inventory.basin_tables.PSObject.Properties | Measure-Object).Count
$wellRows = ($inventory.well_tables.PSObject.Properties | ForEach-Object { [int]$_.Value } | Measure-Object -Sum).Sum
$basinRows = ($inventory.basin_tables.PSObject.Properties | ForEach-Object { [int]$_.Value } | Measure-Object -Sum).Sum

$powerpoint = New-Object -ComObject PowerPoint.Application
$powerpoint.Visible = 1
$presentation = $powerpoint.Presentations.Add()
$presentation.PageSetup.SlideWidth = 960
$presentation.PageSetup.SlideHeight = 540

# 1. Title
$slide = $presentation.Slides.Add(1, 12)
Add-Background $slide
Add-TextBox $slide "石化地学数据展示平台" 64 112 720 60 34 (RgbColor 9 30 66) $true | Out-Null
Add-TextBox $slide "系统设计实现架构、功能展示与后续协同计划" 66 180 720 34 18 (RgbColor 91 111 137) $false | Out-Null
Add-Pill $slide "MapGIS IGServer" 66 238 128 | Out-Null
Add-Pill $slide "FeatureServer" 206 238 112 | Out-Null
Add-Pill $slide "井位 / 盆地 / 井史 / 曲线" 330 238 170 | Out-Null
Add-Card $slide "当前状态" "已完成真实井位与盆地服务接入，完成 Excel 井/盆地专题表整理，并保留样例测井曲线展示能力。" 610 118 270 190 (RgbColor 19 163 127) | Out-Null
Add-SectionTag $slide "汇报版本：初步完成版 / 2026-04" | Out-Null

# 2. Agenda
$slide = $presentation.Slides.Add(2, 12)
Add-Background $slide
Add-Title $slide "汇报内容" "从建设目标到系统实现，再到后续计划和协同事项。"
$agenda = @("建设目标与系统定位", "总体架构与数据链路", "核心功能展示", "当前成果与存在边界", "后续建设计划", "需要其他专题协助的问题")
for ($i = 0; $i -lt $agenda.Count; $i++) {
  $x = 92 + (($i % 3) * 270)
  $y = 138 + ([math]::Floor($i / 3) * 138)
  Add-Card $slide ("0{0}. {1}" -f ($i + 1), $agenda[$i]) "" $x $y 220 92 (RgbColor 32 94 207) | Out-Null
}

# 3. Positioning
$slide = $presentation.Slides.Add(3, 12)
Add-Background $slide
Add-Title $slide "系统定位：从演示页面走向数据工作台" "以真实数据展示与可操作检索为核心，而不是单纯做汇报页面。"
Add-Card $slide "面向对象" "围绕盆地对象、井位对象和井专题资料组织展示，支持从空间位置进入业务属性。" 60 130 255 150 (RgbColor 32 94 207) | Out-Null
Add-Card $slide "面向服务" "优先接入 MapGIS IGServer 已发布的 FeatureServer 服务，避免前端直接读取散落的 shp 文件。" 352 130 255 150 (RgbColor 19 163 127) | Out-Null
Add-Card $slide "面向扩展" "保留本地 JSON/CSV 回退能力，后续可平滑扩展到数据库、权限、曲线文件和更多专题表。" 644 130 255 150 (RgbColor 217 119 6) | Out-Null
Add-BulletList $slide @("当前已不再以会议材料为主线，而是以数据检索、地图联动、井/盆地详情为主线。", "系统支持先小规模接入真实数据，再逐步拓展为完整业务平台。") 76 330 790 90 15 | Out-Null

# 4. Overall Architecture
$slide = $presentation.Slides.Add(4, 12)
Add-Background $slide
Add-Title $slide "总体架构：数据源 → MapGIS 服务 → 前后端联通 → 展示工作台" "核心目标是让空间数据和表格资料能够统一进入前端展示。"
$fills = @(
  (RgbColor 232 241 255),
  (RgbColor 232 247 242),
  (RgbColor 255 247 220),
  (RgbColor 246 239 255)
)
Add-FlowBox $slide "数据源层" "Wells.shp / Main_Basins.shp`r井表 Excel / 盆地 Excel`r样例 well_logs.csv" 52 150 180 150 $fills[0] | Out-Null
Add-Arrow $slide 242 225 54 | Out-Null
Add-FlowBox $slide "GIS 服务层" "MapGIS IGServer`rwells FeatureServer`rmain_basins FeatureServer" 306 150 180 150 $fills[1] | Out-Null
Add-Arrow $slide 496 225 54 | Out-Null
Add-FlowBox $slide "联通层" "Node 静态服务`r/igs 代理`rJSON/CSV 配置读取" 560 150 180 150 $fills[2] | Out-Null
Add-Arrow $slide 750 225 54 | Out-Null
Add-FlowBox $slide "前端展示层" "地图工作台`r井资料与曲线`r数据目录与服务状态" 814 150 120 150 $fills[3] | Out-Null
Add-Card $slide "设计要点" "服务优先、本地回退；空间对象和表格资料分层管理；前端以筛选、定位、详情联动作为主要交互。" 92 354 780 82 (RgbColor 32 94 207) | Out-Null

# 5. Data Link
$slide = $presentation.Slides.Add(5, 12)
Add-Background $slide
Add-Title $slide "数据链路：Shapefile 与 Excel 的组合使用" "空间边界由 MapGIS 服务提供，专题属性由 Excel 整理结果补充。"
Add-Card $slide "空间数据" "井位：Wells.shp，点要素`r盆地：Main_Basins.shp，面要素`r发布：MapGIS IGServer FeatureServer" 62 130 260 160 (RgbColor 32 94 207) | Out-Null
Add-Card $slide "井专题表" ("表数量：{0} 个`r数据行：{1} 行`r包括：Basic、General、History、Tests、Tops、Deviation、Checkshot、Costs 等" -f $wellTableCount, $wellRows) 350 130 260 160 (RgbColor 19 163 127) | Out-Null
Add-Card $slide "盆地专题表" ("表数量：{0} 个`r数据行：{1} 行`r包括：Basic、General、Images、Reserves、Petroleum System、Play、Lithostratigraphic 等" -f $basinTableCount, $basinRows) 638 130 260 160 (RgbColor 217 119 6) | Out-Null
Add-Card $slide "当前处理策略" "前端优先读取 MapGIS 服务中的几何与核心字段；Excel 整理为 JSON 后用于井档案、井史、井测试、地层与盆地专题资料展示。" 92 344 780 90 (RgbColor 109 40 217) | Out-Null

# 6. Implementation
$slide = $presentation.Slides.Add(6, 12)
Add-Background $slide
Add-Title $slide "技术实现路径" "当前采用轻量化 Web 方案，重点验证数据链路与业务展示闭环。"
Add-Card $slide "前端" "HTML / CSS / JavaScript`rLeaflet`r@mapgis/webclient-leaflet-plugin`r天地图底图叠加" 62 126 250 190 (RgbColor 32 94 207) | Out-Null
Add-Card $slide "服务代理" "Node.js 静态服务`r/igs/* 代理到 localhost:8089`r避免浏览器跨域和路径配置混乱" 354 126 250 190 (RgbColor 19 163 127) | Out-Null
Add-Card $slide "MapGIS" "IGServer Java`rFeatureServer/query`r坐标系 EPSG:3857 → 前端 EPSG:4326`r服务不可用时回退本地 GeoJSON" 646 126 250 190 (RgbColor 217 119 6) | Out-Null
Add-BulletList $slide @("当前系统更适合做数据链路验证和功能原型扩展。", "后续工程化时可迁移到 Vue/React + 数据库 + 权限体系。") 88 366 780 80 14 | Out-Null

# 7. Function Map
$slide = $presentation.Slides.Add(7, 12)
Add-Background $slide
Add-Title $slide "功能展示一：地图工作台" "左侧筛选，中间地图，右侧对象详情，形成可操作的 GIS 数据工作台。"
Add-FlowBox $slide "左侧筛选" "关键字`r国家`r盆地`r作业者`r快速定位" 60 142 180 190 (RgbColor 232 241 255) | Out-Null
Add-FlowBox $slide "中间地图" "天地图底图`r盆地面图层`r井位点图层`r弹窗与 tooltip" 280 118 360 238 (RgbColor 232 247 242) | Out-Null
Add-FlowBox $slide "右侧详情" "服务状态`r当前选中对象`r真实服务数据摘要`r工作建议" 680 142 220 190 (RgbColor 255 247 220) | Out-Null
Add-Card $slide "展示价值" "用户可以从地图上直接看到真实盆地形状和真实井位，并通过筛选与点击联动查看井/盆地属性。" 100 390 760 70 (RgbColor 32 94 207) | Out-Null

# 8. Function Well
$slide = $presentation.Slides.Add(8, 12)
Add-Background $slide
Add-Title $slide "功能展示二：井资料与曲线" "把井基础资料、井史事件、专题资料和测井曲线集中在一个工作区。"
Add-Card $slide "井档案摘要" ("已整理井对象：{0} 口`r字段：井号、盆地、作业者、井型、技术状态、总井深、垂深、位置等" -f $wellCount) 56 126 260 170 (RgbColor 32 94 207) | Out-Null
Add-Card $slide "井专题资料" "井史事件、作业期次、井测试、分层 Tops、地层导出、井斜测量、Checkshot/VSP、成本等。" 350 126 260 170 (RgbColor 19 163 127) | Out-Null
Add-Card $slide "测井曲线区" "当前保留样例曲线展示，包括 GR、RT、RHOB 等曲线道；真实 LAS/DLIS/LIS 到位后可替换为真实曲线。" 644 126 260 170 (RgbColor 217 119 6) | Out-Null
Add-BulletList $slide @("目前井深字段已从 Excel 的 Td Meter 正确进入井档案展示。", "曲线展示能力已预留，但真实曲线文件仍是后续重点。") 76 352 800 90 14 | Out-Null

# 9. Function Catalog
$slide = $presentation.Slides.Add(9, 12)
Add-Background $slide
Add-Title $slide "功能展示三：数据目录与服务状态" "用于核对系统到底加载了哪些数据、哪些服务、哪些表可继续扩展。"
Add-Card $slide "数据目录" "盆地名录、井位名录、井资料覆盖摘要、当前盆地专题资料、数据扩展建议。" 62 130 250 180 (RgbColor 32 94 207) | Out-Null
Add-Card $slide "服务状态" "REST API、MapGIS FeatureServer 接口、图层目录、本地回退数据与数据治理待办。" 354 130 250 180 (RgbColor 19 163 127) | Out-Null
Add-Card $slide "运行状态" "前端会提示当前是否连接真实 MapGIS 服务；服务不可用时回退到本地演示数据，便于排查。" 646 130 250 180 (RgbColor 217 119 6) | Out-Null
Add-Card $slide "管理价值" "这部分不是单纯展示，而是帮助后续开发和数据核对：知道数据从哪里来、哪些已经展示、哪些仍需补齐。" 100 370 760 70 (RgbColor 109 40 217) | Out-Null

# 10. Results
$slide = $presentation.Slides.Add(10, 12)
Add-Background $slide
Add-Title $slide "当前成果与边界" "系统已经完成初步闭环，但还不是最终生产系统。"
Add-Card $slide "已经完成" "1. MapGIS IGServer 服务接入`r2. 真实井位与盆地 shp 发布展示`r3. Excel 井/盆地专题表整理`r4. 地图筛选、定位、弹窗与详情联动`r5. 样例测井曲线展示保留" 62 128 390 240 (RgbColor 19 163 127) | Out-Null
Add-Card $slide "当前边界" "1. 真实测井曲线文件尚未接入`r2. 数据仍以 JSON 文件整理结果为主，尚未落库`r3. 权限、审计、运维监控尚未建设`r4. 前端仍是轻量原型结构，后续需工程化拆分" 508 128 390 240 (RgbColor 217 119 6) | Out-Null
Add-SectionTag $slide "判断：适合作为初步系统成果展示和下一阶段建设基础。" | Out-Null

# 11. Roadmap
$slide = $presentation.Slides.Add(11, 12)
Add-Background $slide
Add-Title $slide "后续建设计划" "建议按“专题增强 → 曲线接入 → 工程化”的顺序推进。"
$x = 58
foreach ($item in $overview.roadmap) {
  Add-FlowBox $slide $item.title ($item.window + "`r" + (($item.items -join " / "))) $x 154 190 170 (RgbColor 232 241 255) | Out-Null
  if ($x -lt 690) { Add-Arrow $slide ($x + 198) 238 34 | Out-Null }
  $x += 220
}
Add-Card $slide "近期建议" "优先把井测试、分层、井斜、checkshot 和盆地油气系统等数据做成更明确的专题看板；随后接入真实曲线文件。" 84 380 790 74 (RgbColor 32 94 207) | Out-Null

# 12. Collaboration
$slide = $presentation.Slides.Add(12, 12)
Add-Background $slide
Add-Title $slide "需要其他专题协助的问题" "这些问题决定系统能否从初步展示继续升级为可用平台。"
Add-Card $slide "数据专题" "确认井/盆地表字段口径、数据更新频率、文件命名规范和授权边界。" 54 124 260 144 (RgbColor 32 94 207) | Out-Null
Add-Card $slide "测井解释专题" "提供真实 LAS/DLIS/LIS 或带深度采样的曲线文件，并确认曲线道、单位和解释口径。" 350 124 260 144 (RgbColor 19 163 127) | Out-Null
Add-Card $slide "GIS / MapGIS 专题" "协助确定正式服务发布流程、服务命名规范、坐标系转换、权限和部署环境。" 646 124 260 144 (RgbColor 217 119 6) | Out-Null
Add-Card $slide "地质业务专题" "确认盆地、油气系统、play、地层、测试等业务字段的展示优先级和筛选逻辑。" 54 306 260 144 (RgbColor 109 40 217) | Out-Null
Add-Card $slide "平台运维专题" "协助规划数据库、权限审计、日志监控、备份恢复、服务健康检查和正式部署方式。" 350 306 260 144 (RgbColor 196 71 89) | Out-Null
Add-Card $slide "项目协同" "确定下一阶段里程碑、验收口径、样例数据范围和跨专题联调机制。" 646 306 260 144 (RgbColor 61 83 115) | Out-Null

# 13. End
$slide = $presentation.Slides.Add(13, 12)
Add-Background $slide
Add-TextBox $slide "总结" 70 86 400 48 30 (RgbColor 9 30 66) $true | Out-Null
Add-BulletList $slide @("系统已完成真实井位与盆地数据的初步展示闭环。", "当前架构以 MapGIS IGServer 为核心，前端通过服务代理和配置文件实现联动展示。", "后续重点是补齐真实测井曲线、扩展专题表视图、推进数据库与权限等工程化能力。", "需要数据、测井解释、GIS、地质业务和运维专题共同协助。") 86 164 760 180 17 | Out-Null
Add-Card $slide "下一步建议" "先做真实曲线文件接入方案和专题资料视图增强，再启动系统工程化改造。" 160 390 640 72 (RgbColor 32 94 207) | Out-Null

$outDir = Split-Path -Parent $OutputPath
if (-not (Test-Path $outDir)) {
  New-Item -ItemType Directory -Path $outDir | Out-Null
}
if (Test-Path $OutputPath) {
  Remove-Item -LiteralPath $OutputPath -Force
}
$presentation.SaveAs($OutputPath)
$presentation.Close()
$powerpoint.Quit()

[System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerpoint) | Out-Null
Write-Host "PPT created: $OutputPath"
