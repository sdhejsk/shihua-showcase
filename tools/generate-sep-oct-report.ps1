Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$workspace = Split-Path -Parent $PSScriptRoot
$reportRoot = Join-Path $workspace 'deliverables\bimonthly-reports'
$templatePath = Join-Path $reportRoot '双月报（2026年7-8月）-课题四.docx'
$outputDirectory = Join-Path $reportRoot 'completed'
$outputPath = Join-Path $outputDirectory '课题四双月报（2026年9-10月）-第五修订版.docx'
$assetDirectory = Join-Path $reportRoot '_report-assets'
$stagingDirectory = Join-Path $reportRoot ("_staging-sep-oct-" + [guid]::NewGuid().ToString('N'))
$wordNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
$xmlNs = 'http://www.w3.org/XML/1998/namespace'

function New-Brush([string]$color) {
    return [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($color))
}

function Draw-CenteredText($graphics, [string]$text, $font, $brush, [int]$x, [int]$y, [int]$width, [int]$height) {
    $text = $text -replace '\\n', [Environment]::NewLine
    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
    $graphics.DrawString($text, $font, $brush, [System.Drawing.RectangleF]::new($x, $y, $width, $height), $format)
    $format.Dispose()
}

function Draw-Card($graphics, [int]$x, [int]$y, [int]$width, [int]$height, [string]$fill, [string]$border, [string]$title, [string]$body) {
    $rect = [System.Drawing.Rectangle]::new($x, $y, $width, $height)
    $graphics.FillRectangle((New-Brush $fill), $rect)
    $graphics.DrawRectangle([System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($border), 2), $rect)
    $titleFont = [System.Drawing.Font]::new('Microsoft YaHei', 17, [System.Drawing.FontStyle]::Bold)
    $bodyFont = [System.Drawing.Font]::new('Microsoft YaHei', 12)
    Draw-CenteredText $graphics $title $titleFont (New-Brush '#173A5E') $x ($y + 16) $width 42
    Draw-CenteredText $graphics $body $bodyFont (New-Brush '#314962') ($x + 12) ($y + 68) ($width - 24) ($height - 82)
    $titleFont.Dispose(); $bodyFont.Dispose()
}

function Draw-Arrow($graphics, [int]$x1, [int]$y1, [int]$x2, [int]$y2) {
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(87, 126, 165), 3)
    $pen.CustomEndCap = [System.Drawing.Drawing2D.AdjustableArrowCap]::new(5, 7, $true)
    $graphics.DrawLine($pen, $x1, $y1, $x2, $y2)
    $pen.Dispose()
}

function Save-OverviewDiagram([string]$path) {
    $bitmap = [System.Drawing.Bitmap]::new(1500, 720)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $graphics.Clear([System.Drawing.Color]::White)
    $titleFont = [System.Drawing.Font]::new('Microsoft YaHei', 27, [System.Drawing.FontStyle]::Bold)
    $noteFont = [System.Drawing.Font]::new('Microsoft YaHei', 14)
    $graphics.DrawString('海外油气数据评价协同平台建设进展', $titleFont, (New-Brush '#173A5E'), 46, 26)

    Draw-Card $graphics 50 150 275 250 '#EAF3FF' '#5C90C8' '平台总体设计' "数据、评价与服务模块\n统一功能组织\n业务使用路径梳理"
    Draw-Card $graphics 410 150 275 250 '#EDF8F2' '#4D9B73' '数据接入与底座' "非洲五类核心对象\n65 张业务表与空间服务\n原始资料统一管理"
    Draw-Card $graphics 770 150 275 250 '#FFF5E8' '#DA9544' '评价流程与方法' "五阶段经济评价流程\n典型算法库图文说明\n结果展示与追溯"
    Draw-Card $graphics 1130 150 275 250 '#F6EEFF' '#8960B4' '界面与运行优化' "统一视觉风格与树形导航\n地图分批加载与对象检索\n页面交互体验优化"
    Draw-Arrow $graphics 330 275 402 275
    Draw-Arrow $graphics 690 275 762 275
    Draw-Arrow $graphics 1050 275 1122 275

    $metrics = @(
        @{ x = 100; title = '190'; body = '盆地' },
        @{ x = 360; title = '2,468'; body = '合同区块' },
        @{ x = 620; title = '4,567'; body = '油气田' },
        @{ x = 880; title = '61,927'; body = '井位' },
        @{ x = 1140; title = '65'; body = '业务表' }
    )
    foreach ($metric in $metrics) {
        $rect = [System.Drawing.Rectangle]::new($metric.x, 495, 210, 120)
        $graphics.FillRectangle((New-Brush '#F7FAFD'), $rect)
        $graphics.DrawRectangle([System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(196, 214, 232), 2), $rect)
        $numberFont = [System.Drawing.Font]::new('Microsoft YaHei', 22, [System.Drawing.FontStyle]::Bold)
        $labelFont = [System.Drawing.Font]::new('Microsoft YaHei', 13)
        Draw-CenteredText $graphics $metric.title $numberFont (New-Brush '#0B5CAB') $metric.x 510 210 44
        Draw-CenteredText $graphics $metric.body $labelFont (New-Brush '#516C86') $metric.x 558 210 36
        $numberFont.Dispose(); $labelFont.Dispose()
    }
    Draw-CenteredText $graphics '说明：数据统计采用已完成接入的非洲数据口径；全球数据接入作为下一阶段工作持续推进。' $noteFont (New-Brush '#516C86') 45 650 1410 36
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $titleFont.Dispose(); $noteFont.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

function Set-ParagraphText($document, $paragraph, [string]$text) {
    $existingRunProperties = $paragraph.SelectSingleNode('./*[local-name()="r"]/*[local-name()="rPr"]')
    $runProperties = if ($null -ne $existingRunProperties) { $document.ImportNode($existingRunProperties, $true) } else { $null }
    @($paragraph.ChildNodes | Where-Object { $_.LocalName -ne 'pPr' }) | ForEach-Object { [void]$paragraph.RemoveChild($_) }
    if ([string]::IsNullOrWhiteSpace($text)) { return }
    $run = $document.CreateElement('w', 'r', $wordNs)
    if ($null -ne $runProperties) { [void]$run.AppendChild($runProperties) }
    $textNode = $document.CreateElement('w', 't', $wordNs)
    $space = $document.CreateAttribute('xml', 'space', $xmlNs)
    $space.Value = 'preserve'
    [void]$textNode.Attributes.Append($space)
    $textNode.InnerText = $text
    [void]$run.AppendChild($textNode)
    [void]$paragraph.AppendChild($run)
}

function Insert-ParagraphAfter($document, $referenceParagraph, [string]$text) {
    $paragraph = $document.CreateElement('w', 'p', $wordNs)
    Set-ParagraphText $document $paragraph $text
    [void]$referenceParagraph.ParentNode.InsertAfter($paragraph, $referenceParagraph)
    return $paragraph
}

function Set-CellText($document, $cell, [string]$text, $namespaceManager) {
    $paragraphs = @($cell.SelectNodes('./w:p', $namespaceManager))
    if ($paragraphs.Count -eq 0) {
        $paragraph = $document.CreateElement('w', 'p', $wordNs)
        [void]$cell.AppendChild($paragraph)
    } else {
        $paragraph = $paragraphs[0]
        $paragraphs | Select-Object -Skip 1 | ForEach-Object { [void]$cell.RemoveChild($_) }
    }
    Set-ParagraphText $document $paragraph $text
}

function Set-Table($document, $table, $rows, $namespaceManager) {
    $tableRows = @($table.SelectNodes('./w:tr', $namespaceManager))
    for ($rowIndex = 0; $rowIndex -lt $tableRows.Count; $rowIndex++) {
        $cells = @($tableRows[$rowIndex].SelectNodes('./w:tc', $namespaceManager))
        $values = if ($rowIndex -lt $rows.Count) { $rows[$rowIndex] } else { @() }
        for ($cellIndex = 0; $cellIndex -lt $cells.Count; $cellIndex++) {
            $value = if ($cellIndex -lt $values.Count) { [string]$values[$cellIndex] } else { '' }
            Set-CellText $document $cells[$cellIndex] $value $namespaceManager
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

New-Item -ItemType Directory -Force -Path $outputDirectory, $assetDirectory | Out-Null
$overviewPath = Join-Path $assetDirectory 'sep-oct-platform-overview.png'
Save-OverviewDiagram $overviewPath

[IO.Compression.ZipFile]::ExtractToDirectory($templatePath, $stagingDirectory)
$documentPath = Join-Path $stagingDirectory 'word\document.xml'
[xml]$xml = Get-Content -Raw -LiteralPath $documentPath
$ns = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
$ns.AddNamespace('w', $wordNs)
$paragraphs = @($xml.SelectNodes('//w:body/w:p', $ns))

$content = @{
    16 = '2026年10月'
    27 = '一、科研攻关进展'
    28 = '1、完成平台总体设计与功能架构建设'
    29 = '围绕海外油气新项目技术经济商务一体化评价的应用需求，完成平台总体功能设计与模块化构建。平台设置“数据概览、数据信息模块、评价算法模块、服务状态”四类工作区：数据概览由接入概览、业务模块和数据构成组成，用于展示当前数据接入情况、平台模块入口和数据底座结构；数据信息模块包括空间总览、区域专题、盆地信息、区块信息、合同信息、油气田信息、井资料和数据目录，用于开展空间浏览、对象查询和资料检索；评价算法模块包含经济评价流程和评价方法库；服务状态用于查看接口、图层、资料文件和数据治理待办情况。各模块围绕统一对象和业务路径衔接，使数据查看、空间定位和评价分析形成连续的使用过程。'
    30 = '2、完成数据资源接入与数据库建设'
    31 = '围绕非洲海外油气基础资料，完成盆地、合同区块、油气田、井位、合同等核心对象的整理与接入。已完成接入的数据覆盖190个盆地、2,468个合同区块、4,567个油气田和61,927口井，并形成65张业务表。针对空间矢量、属性表和原始资料等不同类型数据，梳理以 PostgreSQL/PostGIS、MinIO 和统一接口为支撑的数据管理方式：业务属性和对象关系进入关系数据库，空间几何及空间检索由 PostGIS 支撑，原始资料保留在对象存储中并建立关联索引。平台据此支持图层控制、条件筛选、对象详情、目录检索和地图定位，为后续按同一规范扩展其他区域数据奠定基础。'
    32 = '3、完成面向海外油气新项目的经济评价流程与评价方法库框架设计'
    33 = '面向海外油气新项目的资源禀赋、生产条件、工程开发条件和商业环境等信息，围绕资源基础、生产状态、工程成本、商业条件和评价结果五个环节，完成经济评价流程、输入参数、过程计算和结果展示的总体框架设计。评价页面将阶段导航、结果表、关键指标、分项指数和依据说明组合展示，便于查看不同因素对评价结果的影响。参考石化既有系统的评价方法目录和表达方式，建设评价方法库树形目录，并完成概率统计法、模糊数学法、专家系统法、二因素法、加权平均法、圈闭地质风险评价、区块地质风险评价，以及容积法和单储系数法等典型方法的公式、图示和文字说明页面。当前流程和算法为初步设计，旨在为后续接入业务真实评价流程、专题规则和算法模型奠定基础。'
    34 = '4、完成平台界面风格、导航与运行体验优化'
    35 = '围绕业务系统的日常使用场景，统一优化页面视觉风格、信息层级和交互方式。左侧导航采用父子层级树形展开，评价流程与评价方法库在同一模块内按逻辑关系组织，便于依次进入相应功能；空间概览页面强化图层开关、筛选条件、对象信息和地图区域之间的对应关系。针对区块、油气田和井位等高密度空间数据，采用轻量预览和按需分批加载机制，避免一次性渲染造成页面卡顿；针对评价结果翻页，采用一次计算后快速分页读取的方式，提升连续浏览和分析效率。'
    36 = '二、下步工作计划'
    37 = '1、持续推进全部区域数据接入。以已完成的数据接入、整理和空间服务经验为基础，按照统一对象模型、字段标准、数据质量校核和入库流程，逐步接入全球各区域的盆地、合同区块、油气田、井位及相关专题资料，形成可持续更新的全球数据基础。'
    38 = '2、接入专题真实评价流程和算法。结合业务真实评价需求，梳理各专题的评价流程、输入数据、参数口径、计算规则和结果表达方式，逐步将成熟的业务流程和算法模型接入平台，并通过典型案例开展校核验证。'
    39 = '3、结合石化既有系统持续完善平台内容。对照既有系统的功能组织、评价方法、参数表单、计算页面和结果展示方式，进一步补充评价方法库、专题资料和交互功能，完善平台对海外油气项目评价工作的支撑能力。'
    40 = '4、持续优化系统运行与数据服务能力。优化地图图层预览、分批加载、筛选查询和详情检索策略，完善运行监控、异常提示、部署维护和数据备份等机制，提升系统在复杂数据场景下的稳定性。'
    56 = '2026年10月'
    57 = '海外油气数据评价协同平台阶段建设取得进展'
    58 = '一、前言'
    59 = '海外油气新项目评价涉及空间矢量、属性表、PDF 文档和评价参数等多类资料，资料来源、格式与对象粒度存在差异。项目组围绕平台总体设计、数据资源接入、数据库与空间服务建设、经济评价流程及方法库设计、界面与运行体验优化等任务开展工作，形成面向海外油气资料浏览、管理与评价分析的协同平台框架，为后续接入真实业务流程、扩展数据范围和深化评价应用打下基础。'
    60 = '二、主体内容'
    61 = '（一）重大情况概述'
    62 = '项目组围绕海外油气数据评价协同平台形成四项相互衔接的建设成果：一是完成数据概览、数据信息模块、评价算法模块和服务状态四类工作区的总体功能架构；二是完成数据资源接入、数据库与空间服务建设，已接入的非洲数据覆盖190个盆地、2,468个合同区块、4,567个油气田、61,927口井及65张业务表；三是形成面向海外油气新项目的初步经济评价流程和评价方法库框架；四是完成统一界面风格、树形导航及高密度图层分批加载等运行体验优化。'
    63 = '（二）详细经过'
    64 = '在平台设计与构建方面，围绕海外油气项目资料汇集、地图浏览、对象查询和评价分析的业务需求，形成“数据概览、数据信息模块、评价算法模块、服务状态”四类工作区。数据概览包括接入概览、业务模块和数据构成；数据信息模块包括空间总览、区域专题、盆地信息、区块信息、合同信息、油气田信息、井资料和数据目录；评价算法模块包括经济评价流程与评价方法库；服务状态用于查看接口、图层、资料文件和数据治理待办。在数据资源接入与数据库建设方面，完成非洲盆地、合同区块、油气田、井位和合同等对象的资料整理、分类组织和空间浏览验证；业务属性与对象关系由 PostgreSQL 管理，空间几何和空间检索由 PostGIS 支撑，原始资料通过 MinIO 集中保存和关联追溯，形成关系数据、空间数据和原始资料相互衔接的管理方式。在评价流程与方法库建设方面，面向海外油气新项目的资源、生产、工程和商业信息，建立资源基础、生产状态、工程成本、商业条件和评价结果五阶段流程框架；参考石化既有系统梳理典型评价方法，以公式、图示和文字说明组合展示。当前流程与算法为初步设计，为后续接入业务真实评价流程、专题规则和算法模型奠定基础。在界面和运行体验方面，采用统一视觉风格和树形导航，针对高密度图层采用轻量预览与分批加载，并对评价结果浏览采用一次计算、快速分页的方式，提升平台使用过程中的清晰度与稳定性。'
    66 = '图1  海外油气数据评价协同平台建设成果示意'
    67 = '（三）成果影响'
    68 = '平台建设将前期分散的数据展示与交互能力，逐步整合为面向真实基础资料的统一服务框架。非洲数据接入验证了对象组织、空间浏览和关联查询的可行性；数据库与对象存储的职责划分为多区域、多来源资料的同构接入提供了方向；图层分批加载和结果快速分页降低了高密度空间数据与大样本评价使用过程中的等待压力；评价流程和方法库使数据字段、参数、算法逻辑和结果解释能够在同一工作台中逐步衔接。当前评价能力仍属于原型级框架，后续须结合专题成果、典型案例和专家评审持续校准。'
    69 = '三、后续计划'
    70 = '下一阶段将围绕全球数据接入、真实评价能力接入、既有系统成果继承和系统运行优化持续推进：一是按照统一对象模型、字段标准、质量校核和入库流程，逐步接入全球各区域基础数据及相关专题资料；二是结合专题真实评价需求，接入成熟的业务流程、参数口径、计算规则和算法模型，并通过典型案例开展校核验证；三是对照石化既有系统持续完善评价方法库、专题资料、参数表单、计算页面和结果展示等内容；四是持续优化地图加载、查询检索、运行监控、异常提示、部署维护和数据备份等能力。'
    71 = '四、结论'
    72 = '平台已形成面向海外油气资料的数据组织、空间浏览、对象检索、评价流程、方法资料展示和运行支撑等阶段能力。已接入的非洲盆地、合同区块、油气田和井位等基础资料完成统一组织与地图浏览验证；数据库、空间服务和原始资料管理方式已明确；初步评价流程与方法库已形成可持续深化的框架，为后续接入业务真实评价流程和算法、扩展全球数据、开展典型案例应用及推进技术经济子系统集成奠定基础。'
}

foreach ($entry in $content.GetEnumerator()) {
    Set-ParagraphText $xml $paragraphs[[int]$entry.Key] $entry.Value
}

$appendix = Insert-ParagraphAfter $xml $paragraphs[72] '附件：系统截图与图件预留位置'
$appendix = Insert-ParagraphAfter $xml $appendix '以下图位用于正式排版补充。截图应脱敏处理，不得包含密码、令牌、完整本机路径、内网地址或受限业务字段；系统页面建议采用横向 16:9 比例，图题与图号保持一致。'
$appendix = Insert-ParagraphAfter $xml $appendix '图2  平台数据概览与数据接入能力展示'
$appendix = Insert-ParagraphAfter $xml $appendix '【预留插图位置：数据概览页面截图，建议 16:9】'
$appendix = Insert-ParagraphAfter $xml $appendix '图3  海外油气基础数据空间总览与图层分批加载'
$appendix = Insert-ParagraphAfter $xml $appendix '【预留插图位置：空间总览页面截图，建议 16:9】'
$appendix = Insert-ParagraphAfter $xml $appendix '图4  海外油气对象目录及关联信息检索'
$appendix = Insert-ParagraphAfter $xml $appendix '【预留插图位置：对象目录页面截图，建议 16:9】'
$appendix = Insert-ParagraphAfter $xml $appendix '图5  海外油气新项目经济评价结果展示'
$appendix = Insert-ParagraphAfter $xml $appendix '【预留插图位置：评价结果页面截图，建议 16:9】'
$appendix = Insert-ParagraphAfter $xml $appendix '图6  评价方法库与概率统计法说明'
$appendix = Insert-ParagraphAfter $xml $appendix '【预留插图位置：评价方法库页面截图，建议 16:9】'

for ($index = 18; $index -le 26; $index++) {
    [void]$paragraphs[$index].ParentNode.RemoveChild($paragraphs[$index])
}

$tables = @($xml.SelectNodes('//w:tbl', $ns))
Set-Table $xml $tables[0] @(
    @('序号', '项目/课题名称', '主要进展', '专利', '论文', '标准', '软件著作权', '其他'),
    @('', '', '', '', '', '', '', ''),
    @('1', '项目：', '', '', '', '', '', ''), @('2', '课题1', '', '', '', '', '', ''), @('3', '课题2', '', '', '', '', '', ''), @('4', '课题3', '', '', '', '', '', ''),
    @('5', '课题4', '围绕海外油气数据评价协同平台，完成数据概览、数据信息、评价算法和服务状态四类工作区设计，形成空间浏览、对象检索、资料查看与评价分析的基本业务链路；开展数据服务、经济评价流程、评价方法库、树形导航及地图分批加载等功能建设和优化。', '', '', '', '', '海外油气数据评价协同平台（阶段版本，系统原型，1套，2026年10月）'),
    @('6', '课题5', '', '', '', '', '', ''), @('7', '课题6', '', '', '', '', '', ''), @('实施以来合计', '', '', '', '', '', '', '')
) $ns

Save-DocumentXml $xml $documentPath
Copy-Item -LiteralPath $overviewPath -Destination (Join-Path $stagingDirectory 'word\media\image1.png') -Force

if (Test-Path $outputPath) { Remove-Item -Force $outputPath }
$stream = [IO.File]::Open($outputPath, [IO.FileMode]::CreateNew)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $false)
Get-ChildItem -LiteralPath $stagingDirectory -Recurse -File | ForEach-Object {
    $entryName = $_.FullName.Substring($stagingDirectory.Length + 1).Replace('\', '/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $entryName, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
}
$archive.Dispose()
$stream.Dispose()

if ($stagingDirectory -notlike "$workspace*") { throw 'Unsafe staging path.' }
Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
Get-Item -LiteralPath $outputPath | Select-Object FullName, Length, LastWriteTime
