param(
    [ValidateSet('all', 'may-june', 'july-august')]
    [string]$Period = 'all'
)

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$workspace = Split-Path -Parent $PSScriptRoot
$sourceDirectory = Join-Path $workspace 'deliverables\bimonthly-reports'
$outputDirectory = Join-Path $sourceDirectory 'completed'
$assetDirectory = Join-Path $sourceDirectory '_report-assets'
$stagingDirectory = Join-Path $sourceDirectory '_staging'
$wordNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
$xmlNs = 'http://www.w3.org/XML/1998/namespace'

New-Item -ItemType Directory -Force -Path $outputDirectory, $assetDirectory | Out-Null

function New-Brush([string]$hex) { return [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($hex)) }

function Draw-RoundedBox {
    param($graphics, [int]$x, [int]$y, [int]$width, [int]$height, [string]$fill, [string]$border)
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $diameter = 22
    $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
    $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
    $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    $graphics.FillPath((New-Brush $fill), $path)
    $graphics.DrawPath([System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($border), 2), $path)
    $path.Dispose()
}

function Draw-CenteredText {
    param($graphics, [string]$text, $font, $brush, [int]$x, [int]$y, [int]$width, [int]$height)
    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
    $format.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit
    $graphics.DrawString($text, $font, $brush, [System.Drawing.RectangleF]::new($x, $y, $width, $height), $format)
    $format.Dispose()
}

function Draw-Arrow {
    param($graphics, [int]$x1, [int]$y1, [int]$x2, [int]$y2, [string]$color = '#4B6B8A')
    $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($color), 3)
    $pen.CustomEndCap = [System.Drawing.Drawing2D.AdjustableArrowCap]::new(5, 7, $true)
    $graphics.DrawLine($pen, $x1, $y1, $x2, $y2)
    $pen.Dispose()
}

function New-Canvas([int]$width, [int]$height) {
    $bitmap = [System.Drawing.Bitmap]::new($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $graphics.Clear([System.Drawing.Color]::White)
    return @($bitmap, $graphics)
}

function Save-ArchitectureDiagram([string]$path) {
    $canvas = New-Canvas 1280 500
    $bitmap, $g = $canvas[0], $canvas[1]
    $titleFont = [System.Drawing.Font]::new('Microsoft YaHei', 25, [System.Drawing.FontStyle]::Bold)
    $headingFont = [System.Drawing.Font]::new('Microsoft YaHei', 17, [System.Drawing.FontStyle]::Bold)
    $bodyFont = [System.Drawing.Font]::new('Microsoft YaHei', 13)
    $g.DrawString('海外油气多源资料统一入库与服务架构', $titleFont, (New-Brush '#173A5E'), 28, 18)
    $cards = @(
        @{x=35; title='原始资料'; body='Shapefile\nExcel / CSV\nPDF 与专题文档'; fill='#EAF3FF'; border='#5C90C8'},
        @{x=340; title='接入与治理'; body='资产登记与 SHA-256\n表格字段标准化\n空间几何解析'; fill='#EEF9F3'; border='#4D9B73'},
        @{x=645; title='统一存储'; body='PostgreSQL / PostGIS\n空间要素与业务记录\nMinIO 原始文件对象'; fill='#FFF5E8'; border='#DA9544'},
        @{x=950; title='平台服务'; body='Node.js 数据 API\n目录、空间、评价接口\n浏览器业务工作台'; fill='#F7EEFF'; border='#8960B4'}
    )
    foreach ($card in $cards) {
        Draw-RoundedBox $g $card.x 125 250 245 $card.fill $card.border
        Draw-CenteredText $g $card.title $headingFont (New-Brush '#173A5E') $card.x 145 250 45
        Draw-CenteredText $g ($card.body -replace '\\n', [Environment]::NewLine) $bodyFont (New-Brush '#314962') $card.x 205 250 130
    }
    Draw-Arrow $g 290 247 333 247
    Draw-Arrow $g 595 247 638 247
    Draw-Arrow $g 900 247 943 247
    $noteFont = [System.Drawing.Font]::new('Microsoft YaHei', 14)
    Draw-CenteredText $g '数据文件、目录元数据与空间要素可追溯关联；前端不再直接读取本地目录。' $noteFont (New-Brush '#516C86') 30 405 1220 45
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bitmap.Dispose()
}

function Save-FlowDiagram([string]$path) {
    $canvas = New-Canvas 1400 500
    $bitmap, $g = $canvas[0], $canvas[1]
    $titleFont = [System.Drawing.Font]::new('Microsoft YaHei', 24, [System.Drawing.FontStyle]::Bold)
    $headingFont = [System.Drawing.Font]::new('Microsoft YaHei', 16, [System.Drawing.FontStyle]::Bold)
    $bodyFont = [System.Drawing.Font]::new('Microsoft YaHei', 12)
    $g.DrawString('数据迁移、空间索引与平台查询流程', $titleFont, (New-Brush '#173A5E'), 30, 18)
    $steps = @(
        @{x=35; title='源数据扫描'; body='识别格式\n记录来源路径'},
        @{x=300; title='解析校验'; body='字段映射\n坐标与几何校验'},
        @{x=565; title='双库写入'; body='PostGIS 几何\nMinIO 文件对象'},
        @{x=830; title='统一 API'; body='分页、筛选\nGeoJSON 输出'},
        @{x=1095; title='业务使用'; body='地图、目录\n评价与详情'}
    )
    foreach ($step in $steps) {
        Draw-RoundedBox $g $step.x 155 210 190 '#F6FAFE' '#5B8FBE'
        Draw-CenteredText $g $step.title $headingFont (New-Brush '#164A79') $step.x 175 210 42
        Draw-CenteredText $g ($step.body -replace '\\n', [Environment]::NewLine) $bodyFont (New-Brush '#334D65') $step.x 235 210 72
    }
    for($i=0;$i -lt $steps.Count-1;$i++){ Draw-Arrow $g ($steps[$i].x + 215) 250 ($steps[$i+1].x - 8) 250 }
    $footerFont = [System.Drawing.Font]::new('Microsoft YaHei', 14)
    Draw-CenteredText $g '关键控制点：文件校验、统一对象标识、空间索引、接口限量与可追溯目录。' $footerFont (New-Brush '#516C86') 35 395 1325 40
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bitmap.Dispose()
}

function Save-OutcomeDiagram([string]$path) {
    $canvas = New-Canvas 1240 590
    $bitmap, $g = $canvas[0], $canvas[1]
    $titleFont = [System.Drawing.Font]::new('Microsoft YaHei', 24, [System.Drawing.FontStyle]::Bold)
    $headingFont = [System.Drawing.Font]::new('Microsoft YaHei', 18, [System.Drawing.FontStyle]::Bold)
    $bodyFont = [System.Drawing.Font]::new('Microsoft YaHei', 13)
    $g.DrawString('5-6 月阶段性建设成果', $titleFont, (New-Brush '#173A5E'), 35, 24)
    $cards = @(
        @{x=55;y=125;title='数据资产目录';body='统一登记来源、格式、大小、校验值与对象键';fill='#EEF5FF';border='#568FCB'},
        @{x=650;y=125;title='空间对象底座';body='盆地、区块、油气田、井位的属性与几何统一管理';fill='#F1FAF5';border='#4E9A72'},
        @{x=55;y=350;title='数据库服务边界';body='浏览器通过同域 API 查询，避免直接依赖本地文件目录';fill='#FFF7EC';border='#D59643'},
        @{x=650;y=350;title='迁移与核验工具';body='支持源目录扫描、迁移、健康检查和数据完整性验证';fill='#F8F1FF';border='#8F68B8'}
    )
    foreach($card in $cards){
        Draw-RoundedBox $g $card.x $card.y 535 155 $card.fill $card.border
        Draw-CenteredText $g $card.title $headingFont (New-Brush '#173A5E') $card.x ($card.y+20) 535 40
        Draw-CenteredText $g $card.body $bodyFont (New-Brush '#334D65') $card.x ($card.y+67) 535 65
    }
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bitmap.Dispose()
}

function Save-OptimizationDiagram([string]$path) {
    $canvas = New-Canvas 1650 260
    $bitmap, $g = $canvas[0], $canvas[1]
    $titleFont = [System.Drawing.Font]::new('Microsoft YaHei', 21, [System.Drawing.FontStyle]::Bold)
    $headingFont = [System.Drawing.Font]::new('Microsoft YaHei', 14, [System.Drawing.FontStyle]::Bold)
    $bodyFont = [System.Drawing.Font]::new('Microsoft YaHei', 10)
    $g.DrawString('7-8 月：全非洲地学对象数据接入与服务化展示成果', $titleFont, (New-Brush '#173A5E'), 28, 15)
    $steps = @(
        @{x=28;title='盆地图层';body='190 个盆地\n区域地层、油气系统与 Play'},
        @{x=292;title='合同区块图层';body='2,468 个区块\n位置、勘探历史与权益'},
        @{x=556;title='油气田图层';body='4,567 个油气田\n储量、生产与开发事件'},
        @{x=820;title='井位图层';body='61,927 口井\n井史、分层、测试与井斜'},
        @{x=1084;title='属性数据治理';body='65 张业务表\nExcel 清洗与 JSON 结构化'},
        @{x=1348;title='服务与浏览';body='MapGIS、Node.js\n地图、目录、详情下钻'}
    )
    foreach($step in $steps){
        Draw-RoundedBox $g $step.x 90 225 110 '#F4F8FD' '#5A8EBD'
        Draw-CenteredText $g $step.title $headingFont (New-Brush '#164A79') $step.x 104 225 32
        Draw-CenteredText $g ($step.body -replace '\\n', [Environment]::NewLine) $bodyFont (New-Brush '#334D65') $step.x 143 225 42
    }
    for($i=0;$i -lt $steps.Count-1;$i++){ Draw-Arrow $g ($steps[$i].x+230) 145 ($steps[$i+1].x-8) 145 }
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bitmap.Dispose()
}

function Save-CroppedPptImage([string]$sourcePath, [string]$outputPath, [int]$targetWidth, [int]$targetHeight) {
    $source = [System.Drawing.Image]::FromFile($sourcePath)
    $target = [System.Drawing.Bitmap]::new($targetWidth, $targetHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($target)
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $sourceRatio = $source.Width / [double]$source.Height
    $targetRatio = $targetWidth / [double]$targetHeight
    if($sourceRatio -gt $targetRatio) {
        $cropWidth = [int]($source.Height * $targetRatio)
        $cropX = [int](($source.Width - $cropWidth) / 2)
        $sourceRect = [System.Drawing.Rectangle]::new($cropX, 0, $cropWidth, $source.Height)
    } else {
        $cropHeight = [int]($source.Width / $targetRatio)
        $cropY = [int](($source.Height - $cropHeight) / 2)
        $sourceRect = [System.Drawing.Rectangle]::new(0, $cropY, $source.Width, $cropHeight)
    }
    $graphics.DrawImage($source, [System.Drawing.Rectangle]::new(0, 0, $targetWidth, $targetHeight), $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
    $target.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose(); $target.Dispose(); $source.Dispose()
}

function Get-ParagraphText($paragraph, $ns) {
    return (($paragraph.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join '')
}

function Set-ParagraphText($document, $paragraph, $text) {
    $existingRunProperties = $paragraph.SelectSingleNode('./*[local-name()="r"]/*[local-name()="rPr"]')
    $runProperties = if($null -ne $existingRunProperties) { $document.ImportNode($existingRunProperties, $true) } else { $null }
    $toRemove = @($paragraph.ChildNodes | Where-Object { $_.LocalName -ne 'pPr' })
    foreach($node in $toRemove) { [void]$paragraph.RemoveChild($node) }
    if ([string]::IsNullOrWhiteSpace($text)) { return }
    $run = $document.CreateElement('w', 'r', $wordNs)
    if($null -ne $runProperties) { [void]$run.AppendChild($runProperties) }
    $textNode = $document.CreateElement('w', 't', $wordNs)
    $space = $document.CreateAttribute('xml', 'space', $xmlNs)
    $space.Value = 'preserve'
    [void]$textNode.Attributes.Append($space)
    $textNode.InnerText = $text
    [void]$run.AppendChild($textNode)
    [void]$paragraph.AppendChild($run)
}

function Set-CellText($document, $cell, $text, $ns) {
    $paragraphs = @($cell.SelectNodes('./w:p', $ns))
    if ($paragraphs.Count -eq 0) {
        $paragraph = $document.CreateElement('w', 'p', $wordNs)
        [void]$cell.AppendChild($paragraph)
    } else {
        $paragraph = $paragraphs[0]
        foreach($extra in $paragraphs | Select-Object -Skip 1) { [void]$cell.RemoveChild($extra) }
    }
    Set-ParagraphText $document $paragraph $text
}

function Insert-ParagraphAfter($document, $referenceParagraph, $text) {
    $paragraph = $document.CreateElement('w', 'p', $wordNs)
    Set-ParagraphText $document $paragraph $text
    [void]$referenceParagraph.ParentNode.InsertAfter($paragraph, $referenceParagraph)
    return $paragraph
}

function Set-Table($document, $table, $rows, $ns) {
    $tableRows = @($table.SelectNodes('./w:tr', $ns))
    for($rowIndex = 0; $rowIndex -lt $tableRows.Count; $rowIndex++) {
        $cells = @($tableRows[$rowIndex].SelectNodes('./w:tc', $ns))
        $values = if($rowIndex -lt $rows.Count) { $rows[$rowIndex] } else { @() }
        for($cellIndex = 0; $cellIndex -lt $cells.Count; $cellIndex++) {
            $value = if($cellIndex -lt $values.Count) { [string]$values[$cellIndex] } else { '' }
            Set-CellText $document $cells[$cellIndex] $value $ns
        }
    }
}

function Save-DocumentXml($xml, [string]$path) {
    $settings = [System.Xml.XmlWriterSettings]::new()
    $settings.Encoding = [System.Text.UTF8Encoding]::new($false)
    $settings.Indent = $false
    $writer = [System.Xml.XmlWriter]::Create($path, $settings)
    $xml.Save($writer)
    $writer.Close()
}

function Build-Report {
    param(
        [string]$templatePath,
        [string]$outputPath,
        [scriptblock]$applyContent,
        [hashtable]$imageFiles
    )
    if(Test-Path $stagingDirectory) { Remove-Item -Recurse -Force $stagingDirectory }
    [IO.Compression.ZipFile]::ExtractToDirectory($templatePath, $stagingDirectory)
    $documentPath = Join-Path $stagingDirectory 'word\document.xml'
    [xml]$xml = Get-Content -Raw -LiteralPath $documentPath
    $ns = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
    $ns.AddNamespace('w', $wordNs)
    & $applyContent $xml $ns
    Save-DocumentXml $xml $documentPath
    foreach($image in $imageFiles.GetEnumerator()) {
        Copy-Item -LiteralPath $image.Value -Destination (Join-Path $stagingDirectory ('word\media\' + $image.Key)) -Force
    }
    if(Test-Path $outputPath) { Remove-Item -Force $outputPath }
    $stream = [IO.File]::Open($outputPath, [IO.FileMode]::CreateNew)
    $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $false)
    Get-ChildItem -LiteralPath $stagingDirectory -Recurse -File | ForEach-Object {
        $entryName = $_.FullName.Substring($stagingDirectory.Length + 1).Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $entryName, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
    $archive.Dispose()
    $stream.Dispose()
}

$architecture = Join-Path $assetDirectory 'may-june-architecture.png'
$flow = Join-Path $assetDirectory 'may-june-flow.png'
$outcomes = Join-Path $assetDirectory 'may-june-outcomes.png'
$optimization = Join-Path $assetDirectory 'july-august-optimization.png'
$mayPptMedia = Join-Path $sourceDirectory '_ppt-sources\may-media-extracted'
Save-CroppedPptImage (Join-Path $mayPptMedia 'image24.png') $architecture 1280 500
Save-CroppedPptImage (Join-Path $mayPptMedia 'image31.png') $flow 1400 500
Save-CroppedPptImage (Join-Path $mayPptMedia 'image38.png') $outcomes 1240 590
Save-OptimizationDiagram $optimization

$mayJuneTemplate = Join-Path $sourceDirectory '双月报（2026年5-6月）-课题四.docx'
$mayJuneOutput = Join-Path $outputDirectory '课题四双月报（2026年5-6月）-修订版.docx'
if($Period -ne 'july-august') {
Build-Report -templatePath $mayJuneTemplate -outputPath $mayJuneOutput -imageFiles @{
    'image1.png' = $architecture
    'image2.png' = $flow
    'image3.png' = $outcomes
} -applyContent {
    param($xml, $ns)
    $paragraphs = @($xml.SelectNodes('//w:body/w:p', $ns))
    $content = @{
        16 = '2026年6月'
        27 = '一、科研攻关进展'
        28 = '1、基于标普数据的海外油气信息展示原型平台初步搭建'
        29 = '围绕海外油气新项目综合评价决策系统的基本展示与交互需求，完成前期平台原型的总体架构和核心模块设计。平台以从标普网站下载并整理的油气行业公开/授权示例数据为基础，初步接入井位、盆地、区块、合同和油气田等对象信息，构建数据概览、数据信息、评价算法和服务状态四个模块入口。当前阶段的工作重点是验证对象组织、信息呈现、模块跳转和基础交互方式，形成可用于后续真实业务资料接入的系统雏形；尚未接入石化课题实际使用的基础数据。'
        30 = '2、MapGIS 地图展示、空间筛选与对象资料浏览功能开发'
        31 = '完成前期地图核心界面开发，采用 MapGIS 相关能力展示已整理的盆地、区块、油气田和井位示例图层，支持图层开关、点击查看、空间筛选、属性查询及特定区域选择等基础操作。围绕“图数联动”的使用方式，初步实现从地图对象到资料面板的跳转和对象信息查看，为后续接入更完整的空间数据、专题属性及服务化图层奠定界面与交互基础。该阶段以小规模示例数据和功能验证为主，尚未形成面向多源异构真实数据的统一数据库管理机制。'
        32 = '3、评价算法模块与服务状态模块原型验证'
        33 = '完成评价对象和模型选择、参数配置、算法执行流程等原型界面开发，可针对单井、区块等对象进行基础模型选择和参数设置，验证了由对象选择、参数输入到结果展示的基本交互链路。该模块当时处于初步开发和验证阶段，所用模型为示例性评价逻辑，尚未接入课题提供的专业评价方法、真实计算参数和业务规则。同步开发 REST API 与地图图层服务状态展示页面，用于查看接口、图层和资料文件的基础可用情况，为后续服务接入、异常定位和运行维护预留入口。'
        34 = '二、下步工作计划'
        35 = '结合课题任务书和系统建设目标，提出以下工作计划。'
        36 = '1、与各专题对接真实基础数据。明确井、盆地、区块、合同、油气田等资料的数据表、字段、格式和更新要求，获取并核验可用于系统验证的真实数据样例，为后续多源数据治理打基础。'
        37 = '2、开展多源异构数据统一管理方案设计。针对空间矢量、Excel/CSV 属性表和 PDF 等资料，研究数据库与对象存储的分工、数据模型、迁移流程和服务接口，逐步替代分散文件与示例数据的直接读取方式。'
        38 = '3、对接专业评价算法与业务规则。根据各专题提供的评价方法、参数口径和典型案例，完善模型注册、评价流程编排和结果解释机制，将现有示例性评价界面逐步转为可校验的专业评价功能。'
        39 = '4、在原型平台基础上优化空间服务与用户界面。完善 MapGIS 图层接入、对象资料联动、服务状态监控和模块导航，并围绕真实数据规模开展地图性能、数据加载与交互体验测试。'
        56 = '2026年6月'
        57 = '海外新项目综合评价决策系统原型平台初步搭建完成'
        58 = '一、前言'
        59 = '为验证海外油气新项目综合评价决策系统的基本可行性，本期以标普网站下载并整理的油气行业示例数据为基础，开展平台原型、空间展示、对象资料浏览、评价交互和服务状态等核心能力建设。该阶段的目标是形成可演示、可迭代的系统雏形，验证多类地学对象的组织方式、地图与属性联动方式以及评价流程的基本交互，不以接入石化课题真实数据、落地专业评价算法或完成数据库建设为目标。'
        60 = '二、主体内容'
        61 = '（一）重大情况概述'
        62 = '本期初步完成三项阶段性成果：一是形成平台分层架构和数据概览、数据信息、评价算法、服务状态四个核心模块的原型布局，建立从全局概览到对象查询的基本入口；二是基于标普示例数据完成井位、盆地、区块、合同和油气田等对象的初步组织与地图可视化展示，验证 MapGIS 图层调用、空间筛选、对象点击和资料浏览流程；三是完成评价对象/模型选择、参数设置与基础执行流程的原型开发，并建设接口与图层状态展示页面，为后续接入真实数据、专业算法和运行服务预留扩展位置。'
        63 = '（二）详细经过'
        64 = '在平台架构与模块建设方面，按照“应用展示—业务与模型运行—数据与 GIS 服务—数据资源”的分层思路，完成前端页面、数据接口、地图图层和示例资料之间的初步联通。数据概览页面以看板形式展示不同对象的数量与资料覆盖情况；数据信息模块提供空间总览、盆地信息、区块信息、合同信息、油气田信息、井资料和数据目录等入口；服务状态模块对 REST API、地图图层与资料文件状态进行基础展示。上述功能以原型验证和界面交互为重点，为后续在真实业务场景下逐项补充数据内容和服务能力提供了结构基础。\n\n在空间展示与评价交互方面，采用 MapGIS 相关服务能力组织盆地、区块、油气田与井位等示例图层，初步实现地图展示、图层开关、空间筛选、对象点击和属性资料查看。评价模块实现了单井、区块等对象的选择与模型选择入口，并提供参数配置和算法执行的基本界面，打通从对象选择到结果呈现的原型流程。需要说明的是，当前评价功能仅用于验证平台的交互与流程承载能力，尚未集成石化各专题的专业评价方法，也尚未基于真实业务参数形成可用于决策的评价结论。'
        65 = ''
        66 = '（三）成果影响'
        67 = '本期工作完成了从零散页面和功能设想到可演示原型平台的阶段性转化，验证了多类对象在同一工作台中的展示、查询和联动方式，也验证了地图服务、参数配置和评价流程承载的基本可行性。原型平台为项目组与各专题讨论数据表结构、字段口径、评价输入输出和服务接入方式提供了直观载体。与此同时，试运行也明确暴露出真实资料尚未系统接入、数据分散且缺少统一数据库、评价算法仍停留在示例层面的短板，为下一阶段确定数据治理、算法接入和系统升级的重点提供了依据。'
        68 = '表1  前期原型使用的示例数据及功能定位'
        70 = '表2  原型平台核心模块与已验证能力'
        72 = '表3  原型阶段发现的问题与后续建设方向'
        74 = '图1  数据概览与模块入口原型界面（来源：5月会议材料）'
        76 = '图2  空间信息查询与地图可视化原型界面（来源：5月会议材料）'
        78 = '图3  评价对象、模型选择与参数设置原型界面（来源：5月会议材料）'
    }
    foreach($entry in $content.GetEnumerator()) { Set-ParagraphText $xml $paragraphs[[int]$entry.Key] $entry.Value }
    $next = Insert-ParagraphAfter $xml $paragraphs[67] '三、后续计划'
    $next = Insert-ParagraphAfter $xml $next '下一阶段将以真实业务数据和专业评价方法接入为主线：一是与各专题共同明确基础数据表、字段、格式和样例，开展空间数据、属性表和专题资料的清洗与标准化；二是设计并建设数据库与对象存储相结合的数据管理底座，逐步将已接入资料由分散文件与示例数据读取转为统一服务；三是根据专业算法示例完善模型接入、参数配置与评价流程编排，并以典型对象开展验证；四是在前期原型基础上完善 MapGIS 服务接入、地图性能、导航交互和服务监控，为后续系统升级和试用奠定基础。'
    $next = Insert-ParagraphAfter $xml $next '四、结论'
    $next = Insert-ParagraphAfter $xml $next '本期完成了海外新项目综合评价决策系统的初步原型搭建，实现了基于标普示例数据的数据展示、空间查询、对象资料浏览、评价交互与服务状态展示。平台尚处于原型验证阶段，真实数据入库、专业算法接入和统一数据库建设将作为下一阶段的重点任务。'
    $next = Insert-ParagraphAfter $xml $next '附件：'
    for($i=19; $i -le 26; $i++) { $paragraphs[$i].ParentNode.RemoveChild($paragraphs[$i]) | Out-Null }
    $tables = @($xml.SelectNodes('//w:tbl', $ns))
    Set-Table $xml $tables[0] @(
        @('序号','项目/课题名称','主要进展','专利','论文','标准','软件著作权','其他'),
        @('','','','', '', '', '', ''),
        @('1','项目：','','','','','',''), @('2','课题1','','','','','',''), @('3','课题2','','','','','',''), @('4','课题3','','','','','',''),
        @('5','课题4','基于标普网站下载并整理的示例数据，初步搭建数据概览、空间信息、评价算法和服务状态四个模块，验证 MapGIS 地图展示、对象资料浏览与评价交互基本流程。','','','','','海外新项目综合评价决策系统原型1套；原型架构与功能说明材料1份，2026年6月'),
        @('6','课题5','','','','','',''), @('7','课题6','','','','','',''), @('实施以来合计','','','','','','','原型系统1套；阶段性说明材料1份')
    ) $ns
    Set-Table $xml $tables[1] @(
        @('对象类别','前期数据来源','原型中的使用方式','阶段说明'),
        @('井位对象','标普网站下载并整理的示例资料','地图点位展示、对象点击与基本属性查看','用于界面和交互验证，非课题真实井资料'),
        @('盆地对象','标普示例空间与属性资料','地图面状展示、空间筛选与基础信息浏览','用于验证盆地层级组织与地图联动'),
        @('区块与合同对象','标普示例资料及整理属性','区块展示、合同信息页面和对象跳转','字段口径与真实业务数据尚待专题确认'),
        @('油气田对象','标普示例资料及整理属性','对象资料展示与评价对象入口','用于验证对象关联和页面结构'),
        @('评价参数与结果','原型参数与示例性计算逻辑','模型选择、参数设置和结果展示流程','尚未接入专业算法、真实参数与计算规则')
    ) $ns
    Set-Table $xml $tables[2] @(
        @('原型模块','已验证的核心能力','后续需完善内容'),
        @('数据概览','展示井位、盆地、区块、合同和油气田等对象的基础统计及模块入口','接入真实数据后的动态统计、数据质量与专题覆盖分析'),
        @('数据信息模块','地图展示、图层开关、空间筛选、对象点击和资料浏览','多源真实资料接入、对象关联深化和数据统一管理'),
        @('评价算法模块','对象类型选择、模型选择、参数设置和基础执行交互','接入各专题专业评价方法、参数口径与典型案例验证'),
        @('服务状态','REST API、地图图层和资料文件状态的基础展示','标准化服务接入、监控指标、异常告警与运维机制')
    ) $ns
    Set-Table $xml $tables[3] @(
        @('问题/建设方向','5-6月原型阶段状态','下一阶段工作安排','与7-8月进展的衔接'),
        @('真实基础数据','以标普示例数据进行展示验证，未形成石化真实数据样例集','对接各专题明确数据表、字段和样例，开展清洗与标准化','推进真实数据接入与空间图层服务核验'),
        @('数据统一管理','数据主要以文件和前端整理结果组织，尚未建立数据库底座','设计关系数据、空间数据和原始资料的分层存储及迁移方案','开展数据库、空间数据服务与对象资料管理建设'),
        @('空间服务','完成 MapGIS 图层展示和基础交互验证','完善图层发布规范、筛选查询与服务状态监控','优化空间图层初始显示和高密度井位加载体验'),
        @('评价算法','具备对象选择、模型选择与参数界面，算法为示例逻辑','收集专业算法示例、参数口径和案例，设计模型接入方式','完善五阶段评价数据读取、规则计算与结果说明'),
        @('用户界面','完成四大模块与主要页面原型','结合真实业务流程调整模块层级、导航和对象资料呈现','建设树形导航、评价方法库和可解释结果页面'),
        @('运行维护','具备接口与图层状态的基础展示','补充环境配置、服务检查、故障定位和部署方案','形成部署、健康检查、备份恢复和协作交付文档'),
        @('','','',''), @('','','',''), @('','','',''), @('','','',''), @('','','',''), @('','','',''), @('','','',''), @('','','',''), @('','','',''), @('','','',''), @('','','',''), @('','','',''), @('','','','')
    ) $ns
}
}

$julyAugustTemplate = Join-Path $sourceDirectory '双月报（2026年7-8月）-课题四.docx'
$julyAugustOutput = Join-Path $outputDirectory '课题四双月报（2026年7-8月）-第四修订版.docx'
if($Period -ne 'may-june') {
Build-Report -templatePath $julyAugustTemplate -outputPath $julyAugustOutput -imageFiles @{
    'image1.png' = $optimization
} -applyContent {
    param($xml, $ns)
    $paragraphs = @($xml.SelectNodes('//w:body/w:p', $ns))
    $content = @{
        16 = '2026年8月'
        27 = '一、科研攻关进展'
        28 = '1、完成石化基础真实数据接入和五类对象标准化治理'
        29 = '在前期基于公开资料的展示原型基础上，本期完成石化基础真实地学数据的全非洲范围接入与整理，空间数据覆盖 190 个盆地、2,468 个合同区块、4,567 个油气田和 61,927 口井。围绕井、盆地、合同区块、合同和油气田五类核心对象，累计完成 65 张业务表的分类治理：井数据 21 张核心表，盆地数据 11 张基础表，合同区块数据 6 张关键表，合同数据 10 张业务表，油气田数据 17 张动态表。空间矢量资料按 MapGIS 发布要求进行检查和整理，Excel 属性资料完成字段清洗、校验和 JSON 结构化转换；对象名称、国家、所属盆地、作业者、状态及资源生产等关键属性得到统一组织，为后续评价模型调用建立了比前期原型更完整的数据基础。'
        30 = '2、建成四类核心空间服务与稳定访问保障机制'
        31 = '打通“Shapefile 数据准备—MapGIS IGServer 服务发布—Node.js 中间层代理—前端地图调用”的标准空间服务链路，将全非洲范围的盆地、合同区块、油气田和井位四类核心要素组织为可调用图层。针对空间服务可能出现的连通性波动，完成“实时服务优先、本地缓存自动回退”的保障方案设计与验证，并建设服务状态可视化监控页面，展示服务可用性、响应速度和运行状态。该项工作使系统从 5-6 月的单纯地图展示验证，进一步具备了面向全量空间资料的服务接入规范、故障发现和连续展示能力。'
        32 = '3、形成全非洲数据浏览体系，以埃及为例验证对象关联与目录闭环'
        33 = '平台已具备全非洲 190 个盆地、2,468 个合同区块、4,567 个油气田和 61,927 口井的统一图层浏览、筛选和查询能力。会议材料以埃及区域为展示案例，验证了 4 个盆地、559 个合同区块、979 个油气田和 13,326 口井的对象关联与联动查询：合同区块页面可展示合同、作业者、状态、面积、水深等信息，并可按所属盆地下钻至油气田和井位；油气田页面可查看开发状态、油气类型和可采储量；井位页面可查看井深、技术状态和作业者等井生命周期信息。数据目录支持按对象类型、国家和关键字检索，形成“检索—查看—下钻—地图定位”的业务闭环。同步完善模块化平台原型，以数据信息模块为核心，保留评价对象、模型和参数的交互入口；专业算法和正式评价结论仍需在下一阶段结合专题数据与专家规则建设。'
        34 = '二、下步工作计划'
        35 = '结合系统试运行情况，提出以下工作计划。'
        36 = '1、建设统一数据库与多源资料管理底座。完成 PostgreSQL/PostGIS、MinIO 等组件的部署和数据模型设计，将当前要素服务、Excel/JSON 资料和原始文档纳入统一的空间数据、业务数据和对象存储管理体系。'
        37 = '2、深化真实专题数据治理与关联校核。与各专题进一步明确数据表、字段定义、单位口径、更新时间和质量要求，开展对象关联、缺失值和数据一致性检查，补足当前尚缺的课题评价样例数据。'
        38 = '3、设计经济评价流程与评价算法库。围绕资源基础、生产状态、工程成本、商业条件和评价结果等环节，梳理评价输入、计算规则、参数口径和结果解释；建设评价方法库以及模型注册、配置调用和过程结果留痕能力。'
        39 = '4、开展系统界面风格改进、性能优化与部署验证。统一各模块视觉与导航层级，优化高密度井位加载、图层交互、数据目录和服务监控；完成原型平台容器化部署验证，为后续典型项目应用与技术经济子系统集成做好准备。'
        56 = '2026年8月'
        57 = '海外新项目综合评价决策系统完成真实地学数据接入与服务化原型建设'
        58 = '一、前言'
        59 = '本期围绕海外新项目综合评价决策系统的数据基础与服务化原型开展建设，工作重点由前期公开资料和页面展示验证，转向石化基础真实地学数据接入、五类对象标准化治理及空间服务稳定运行。系统采用轻量化、模块化组织方式：空间矢量资料通过 MapGIS IGServer 发布，业务属性数据由 Excel 等表格完成清洗和 JSON 结构化，Node.js 中间层负责统一代理、请求聚合和服务连通性处理。通过地图、目录、详情和服务监控的联动，形成面向真实对象资料的浏览与查询原型，为后续统一数据库和专业评价模型建设创造了条件。'
        60 = '二、主体内容'
        61 = '（一）重大情况概述'
        62 = '本期形成四项阶段成果：一是完成石化基础真实地学数据的全非洲范围接入与标准化治理，覆盖 190 个盆地、2,468 个合同区块、4,567 个油气田和 61,927 口井，以及井、盆地、合同区块、合同、油气田五类对象共 65 张业务表；二是完成四类空间要素的 MapGIS IGServer 标准发布与 Node.js 代理访问，建立实时服务与本地缓存自动回退机制；三是构建全非洲对象地图浏览、筛选和查询能力，并以埃及区域的 4 个盆地、559 个合同区块、979 个油气田和 13,326 口井作为对象关联与属性查询展示案例；四是形成数据概览、对象资料、数据目录、服务状态和评价交互入口等模块化原型，打通“检索—查看—下钻—定位”的使用路径。'
        63 = '（二）详细经过'
        64 = '在数据接入与治理方面，项目组完成石化基础真实地学数据的全非洲范围接入，空间数据覆盖 190 个盆地、2,468 个合同区块、4,567 个油气田和 61,927 口井。围绕对象粒度同步完成 65 张业务表的分类梳理：井数据涵盖井史、分层、测试、井斜等 21 张核心表；盆地数据涵盖区域地层、油气系统、构造演化与 Play 分析等 11 张基础表；合同区块数据包含位置、勘探历史、合同分区与权益分布等 6 张关键表；合同数据覆盖合同条款、工作义务、权益分配与财税条款等 10 张业务表；油气田数据涵盖储量规模、生产动态、开发事件与产能等 17 张动态表。空间数据与属性数据分别完成服务化、结构化处理，形成“要素服务 + JSON”的原型数据组织方式。该阶段尚未建设统一数据库，且仍需要补充贴合课题评价场景的真实样例数据，但已从公开资料展示验证进入真实基础数据接入与治理阶段。\n\n在空间服务与业务浏览方面，构建了“Shapefile 数据准备—MapGIS IGServer 发布—Node.js 服务代理—浏览器地图与目录展示”的标准接入链路。四类空间服务覆盖全非洲范围的井位、盆地、合同区块和油气田；前端支持图层开关、按国家或对象条件筛选、空间定位和详情查看。会议材料以埃及区域为展示案例，呈现 4 个盆地、559 个合同区块、979 个油气田和 13,326 口井的统一浏览；区块可关联至所属盆地、作业者、油气田和井位，油气田可查看开发状态、油气类型和可采储量，井位可查看井深、技术状态和作业者，验证了层级化对象关系。\n\n在系统可用性与使用路径方面，建设服务状态可视化监控页面，展示空间服务的健康状态、响应速度和可用性，并验证“在线服务优先、本地缓存回退”的保障机制。数据目录支持按对象类型、国家和关键字检索，用户可由结果查看详情并定位地图，形成“检索—查看—下钻”的浏览闭环。评价模块本期继续作为交互原型，保留对象、模型和参数入口；经济评价流程、专业算法和结果校核将作为下一阶段建设内容，依托统一数据底座与专家规则逐步完成。'
        66 = '图1  7-8月全非洲地学对象数据接入与服务化展示成果示意'
        67 = '（三）成果影响'
        68 = '本期工作使系统建设从前期“公开资料驱动的页面与交互原型”推进到“全非洲真实基础数据接入、对象关系组织和服务化调用”的阶段。190 个盆地、2,468 个合同区块、4,567 个油气田和 61,927 口井，以及 65 张业务表，为资源、生产、合同、权益等后续评价输入提供了更清晰的数据来源；以埃及为例的多层级对象联动验证了空间分布与业务属性协同浏览的可行性；服务监控与缓存回退机制则提高了地图功能原型的连续可用性。项目同时识别出统一数据库、课题评价样例和专业算法仍是当前短板，为后续建设任务提供了明确边界。'
        69 = '三、后续计划'
        70 = '下一阶段将建设 PostgreSQL/PostGIS、MinIO 等统一数据底座，把现有要素服务、Excel/JSON 资料和原始文档纳入可追溯的分层管理；结合真实数据进一步完善字段、单位和对象关联规则；围绕资源基础、生产状态、工程成本、商业条件和综合结果设计经济评价流程，建设评价算法库、模型注册和配置调用能力；同步开展界面风格与导航层级改进、高密度井位加载优化、服务监控和容器化部署验证，为后续技术经济子系统集成与典型项目试用做好准备。'
        71 = '四、结论'
        72 = '本期完成了海外新项目综合评价决策系统从公开资料展示原型向全非洲真实基础地学数据接入与服务化原型的重要推进。平台已具备 190 个盆地、2,468 个合同区块、4,567 个油气田、61,927 口井的空间浏览基础，以及五类对象数据组织、四类空间服务调用、目录检索和服务监控等能力；统一数据库、界面优化、经济评价流程和评价算法库将作为后续重点持续建设。'
    }
    foreach($entry in $content.GetEnumerator()) { Set-ParagraphText $xml $paragraphs[[int]$entry.Key] $entry.Value }
    $appendix = Insert-ParagraphAfter $xml $paragraphs[72] '附件：系统截图与图件预留位置'
    $appendix = Insert-ParagraphAfter $xml $appendix '以下图位用于后续排版补充。建议采用无敏感账号、令牌、文件路径和业务保密字段的脱敏截图；界面截图统一使用横向比例，保持图题与图号一致。'
    $appendix = Insert-ParagraphAfter $xml $appendix '图2  五类核心地学对象数据资源概览（建议放置：8 月会议 PPT 中井、盆地、区块、合同、油气田共 65 张表的数据资源概览图）。'
    $appendix = Insert-ParagraphAfter $xml $appendix '【预留插图位置：横向架构图，建议 16:9】'
    $appendix = Insert-ParagraphAfter $xml $appendix '图3  MapGIS 空间服务标准接入与运行保障（建议放置：Shapefile 准备、MapGIS 服务发布、前端调用及本地缓存回退流程图或服务状态页）。'
    $appendix = Insert-ParagraphAfter $xml $appendix '【预留插图位置：横向系统界面截图，建议 16:9】'
    $appendix = Insert-ParagraphAfter $xml $appendix '图4  全非洲空间总览与图层控制（建议放置：包含 190 个盆地、2,468 个合同区块、4,567 个油气田、61,927 口井图层的 MapGIS 地图截图）。'
    $appendix = Insert-ParagraphAfter $xml $appendix '【预留插图位置：横向系统界面截图，建议 16:9】'
    $appendix = Insert-ParagraphAfter $xml $appendix '图5  埃及区域对象详情与层级下钻示例（建议放置：埃及合同区块详情页截图，展示所属盆地、作业者、状态、面积及关联油气田、井位信息）。'
    $appendix = Insert-ParagraphAfter $xml $appendix '【预留插图位置：横向系统界面截图，建议 16:9】'
    $appendix = Insert-ParagraphAfter $xml $appendix '图6  油气田、井位信息浏览与数据目录检索（建议放置：油气田/井位属性页面，以及按对象类型、国家、关键字检索并地图定位的页面截图）。'
    $appendix = Insert-ParagraphAfter $xml $appendix '【预留插图位置：横向系统界面截图，建议 16:9】'
    $appendix = Insert-ParagraphAfter $xml $appendix '图7  MapGIS 服务状态与本地缓存回退验证（建议放置：服务状态页或服务不可用时的本地缓存展示截图；不得显示完整内网地址和令牌）。'
    $appendix = Insert-ParagraphAfter $xml $appendix '【预留插图位置：横向运行状态截图，建议 16:9】'
    for($i=18; $i -le 26; $i++) { $paragraphs[$i].ParentNode.RemoveChild($paragraphs[$i]) | Out-Null }
    $tables = @($xml.SelectNodes('//w:tbl', $ns))
    Set-Table $xml $tables[0] @(
        @('序号','项目/课题名称','主要进展','专利','论文','标准','软件著作权','其他'),
        @('','','','', '', '', '', ''),
        @('1','项目：','','','','','',''), @('2','课题1','','','','','',''), @('3','课题2','','','','','',''), @('4','课题3','','','','','',''),
        @('5','课题4','完成全非洲 190 个盆地、2,468 个区块、4,567 个油气田、61,927 口井及五类对象 65 张业务表接入治理，建设四类 MapGIS 空间服务、目录检索和服务保障原型。','','','','','《空间数据服务与对象浏览原型说明》1份；《多源资料接入与字段整理说明》1份，2026年8月'),
        @('6','课题5','','','','','',''), @('7','课题6','','','','','',''), @('实施以来合计','','','','','','','阶段性技术文档4份')
    ) $ns
}
}

if(Test-Path $stagingDirectory) { Remove-Item -Recurse -Force $stagingDirectory }
Get-ChildItem $outputDirectory -Filter '*.docx' | Select-Object Name, Length, LastWriteTime
