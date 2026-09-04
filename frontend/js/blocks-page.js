import { formatNumber, loadPlatformState, renderShell, safeText, unique } from "./core.js";

function renderBlockProfile(container, profile = {}) {
  const pairs = [
    ["区块名称", profile.block_name],
    ["合同名称", profile.contract_name],
    ["国家", profile.country_name],
    ["盆地", profile.basin_names],
    ["作业者", profile.operator_name],
    ["权利类型", profile.rights_type],
    ["合同类型", profile.contract_type],
    ["合同状态", profile.contract_status],
    ["区块状态", profile.block_status],
    ["区块面积", profile.block_sqkm ? `${formatNumber(profile.block_sqkm, 1)} km²` : "-"],
    ["陆海属性", profile.onshore_offshore],
    ["地形", profile.terrains],
    ["行政区", profile.main_political_province],
    ["资源类型", profile.resource_type],
    ["授予日期", profile.award_date],
    ["到期日期", profile.expiry_date],
    ["组名称", profile.group_name]
  ];
  container.innerHTML = pairs.map(([label, value]) => `<span>${label}</span><strong>${safeText(value)}</strong>`).join("");
}

function renderLocationTiles(container, profile = {}, tables = {}) {
  const location = tables.locations?.[0] || {};
  const outline = tables.outline_summary || {};
  const cards = [
    ["坐标位置", location.approx_latitude_dec_deg && location.approx_longitude_dec_deg ? `${location.approx_latitude_dec_deg}, ${location.approx_longitude_dec_deg}` : `${safeText(profile.approx_latitude)} / ${safeText(profile.approx_longitude)}`],
    ["水深范围", profile.min_water_depth_meter || profile.max_water_depth_meter ? `${safeText(profile.min_water_depth_meter)} - ${safeText(profile.max_water_depth_meter)} m` : "-"],
    ["平均水深", profile.median_water_depth_meter ? `${formatNumber(profile.median_water_depth_meter, 1)} m` : "-"],
    ["轮廓点数", outline.point_count || 0],
    ["包围盒", outline.point_count ? `${formatNumber(outline.min_longitude, 3)}, ${formatNumber(outline.min_latitude, 3)} ~ ${formatNumber(outline.max_longitude, 3)}, ${formatNumber(outline.max_latitude, 3)}` : "-"],
    ["原始面积保留", profile.pct_original_area_remaining != null && profile.pct_original_area_remaining !== "" ? `${formatNumber(profile.pct_original_area_remaining, 1)}%` : "-"]
  ];
  container.innerHTML = cards.map(([title, desc]) => `
    <article class="info-tile">
      <h4>${title}</h4>
      <p>${safeText(desc)}</p>
    </article>
  `).join("");
}

function renderHistory(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = `<article class="history-item"><strong>暂无区块历史</strong><p>当前区块没有匹配到历史阶段信息。</p></article>`;
    return;
  }
  container.innerHTML = rows.map(row => `
    <article class="history-item">
      <strong>阶段 ${safeText(row.stage_numb)}</strong>
      <small>${safeText(row.start_date)} ~ ${safeText(row.end_date)}</small>
      <p>${safeText(row.contract_stage_events || row.block_events || row.contract_status || row.block_status)}</p>
    </article>
  `).join("");
}

function renderSchedule(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = `<article class="info-tile"><h4>暂无计划事件</h4><p>当前区块没有匹配到计划日期信息。</p></article>`;
    return;
  }
  const row = rows[0];
  const cards = [
    ["申请日期", row.application_date],
    ["授予日期", row.award_date],
    ["到期日期", row.expiry_date],
    ["续约计划", row.renewal_sch_dates],
    ["缩减计划", row.reduction_sch_dates],
    ["勘探到期计划", row.exp_expiry_sch_date],
    ["生产到期计划", row.prod_expiry_sch_date],
    ["统一到期计划", row.expiry_sch_date]
  ];
  container.innerHTML = cards.map(([title, desc]) => `
    <article class="info-tile">
      <h4>${title}</h4>
      <p>${safeText(desc)}</p>
    </article>
  `).join("");
}

function renderCompanyTable(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = `<article class="info-tile"><h4>暂无公司权益</h4><p>当前区块没有匹配到公司权益表。</p></article>`;
    return;
  }
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>公司</th>
          <th>简称</th>
          <th>权益(%)</th>
          <th>公司类型</th>
          <th>业务属性</th>
          <th>是否作业者</th>
          <th>净面积(km²)</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${safeText(row.company_name)}</td>
            <td>${safeText(row.company_acronym)}</td>
            <td>${row.interests_pct != null && row.interests_pct !== "" ? formatNumber(row.interests_pct, 2) : "-"}</td>
            <td>${safeText(row.company_type)}</td>
            <td>${safeText(row.business_activity)}</td>
            <td>${safeText(row.operator_flag)}</td>
            <td>${row.total_net_sqkm != null && row.total_net_sqkm !== "" ? formatNumber(row.total_net_sqkm, 3) : "-"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderOwnership(container, profile = {}) {
  const cards = [
    ["当前本地公司结构", profile.block_local_companies_curr],
    ["当前母公司结构", profile.block_parent_companies_curr],
    ["上一期本地公司结构", profile.block_local_companies_prev],
    ["上一期母公司结构", profile.block_parent_companies_prev]
  ];
  container.innerHTML = cards.map(([title, desc]) => `
    <article class="info-tile">
      <h4>${title}</h4>
      <p>${safeText(desc)}</p>
    </article>
  `).join("");
}

function renderCoverageSummary(container, profile = {}, tables = {}) {
  const companyCount = tables.company_interests?.length || 0;
  const historyCount = tables.history?.length || 0;
  const scheduleCount = tables.scheduled_events?.length || 0;
  const locationCount = tables.locations?.length || 0;
  const outlinePoints = tables.outline_summary?.point_count || 0;
  const cards = [
    ["资源类型", profile.resource_type || "-"],
    ["非常规类型", profile.unconventional_type || "-"],
    ["历史阶段记录", `${historyCount} 条`],
    ["计划事件记录", `${scheduleCount} 条`],
    ["公司权益记录", `${companyCount} 条`],
    ["位置记录", `${locationCount} 条`],
    ["轮廓点数", `${outlinePoints} 个`],
    ["当前作业者", profile.operator_name || "-"]
  ];
  container.innerHTML = cards.map(([title, desc]) => `
    <article class="info-tile">
      <h4>${title}</h4>
      <p>${safeText(desc)}</p>
    </article>
  `).join("");
}

function renderSourceFiles(container, inventory = {}) {
  const entries = [
    { type: "空间图层", name: "Valid_Contract_Blocks.shp + dbf/shx/prj/cpg", count: "1 套" },
    ...Object.entries(inventory).map(([name, count]) => ({
      type: "区块表",
      name,
      count: `${count} 行`
    }))
  ];
  container.innerHTML = entries.map(item => `
    <article class="info-tile">
      <h4>${item.type}</h4>
      <p>${item.name}</p>
      <small>${item.count}</small>
    </article>
  `).join("");
}

function renderLocationTable(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = `<article class="info-tile"><h4>暂无位置记录</h4><p>当前区块没有匹配到位置明细。</p></article>`;
    return;
  }
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>陆海</th>
          <th>地形</th>
          <th>面积(km²)</th>
          <th>主区带</th>
          <th>行政区</th>
          <th>纬度</th>
          <th>经度</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${safeText(row.onshore_offshore)}</td>
            <td>${safeText(row.terrains)}</td>
            <td>${row.block_sqkm != null && row.block_sqkm !== "" ? formatNumber(row.block_sqkm, 2) : "-"}</td>
            <td>${safeText(row.main_fss_zone)}</td>
            <td>${safeText(row.main_political_province)}</td>
            <td>${row.approx_latitude_dec_deg != null && row.approx_latitude_dec_deg !== "" ? formatNumber(row.approx_latitude_dec_deg, 6) : "-"}</td>
            <td>${row.approx_longitude_dec_deg != null && row.approx_longitude_dec_deg !== "" ? formatNumber(row.approx_longitude_dec_deg, 6) : "-"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderOutlineSamples(container, summary = {}) {
  const rows = summary.sample_points || [];
  if (!rows.length) {
    container.innerHTML = `<article class="info-tile"><h4>暂无轮廓点</h4><p>当前区块没有匹配到轮廓采样点。</p></article>`;
    return;
  }
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>点号</th>
          <th>纬度</th>
          <th>经度</th>
          <th>绘制指令</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${safeText(row.point_number)}</td>
            <td>${row.latitude_dd != null && row.latitude_dd !== "" ? formatNumber(row.latitude_dd, 6) : "-"}</td>
            <td>${row.longitude_dd != null && row.longitude_dd !== "" ? formatNumber(row.longitude_dd, 6) : "-"}</td>
            <td>${safeText(row.pen_command)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function init() {
  const root = renderShell({
    currentKey: "blocks",
    heroTitle: "区块资料工作台",
    heroDesc: "查看区块档案、历史、计划事件、公司权益和轮廓摘要。",
    heroMeta: ["区块档案", "计划事件", "公司权益"]
  });
  const state = await loadPlatformState({ includeMapLayers: false });
  const profileMap = state.blockData?.profiles || {};
  const tableMap = state.blockData?.tables || {};
  const options = unique([
    ...Object.keys(profileMap),
    ...state.blocksGeoJson.features.map(feature => feature.properties?.block_name).filter(Boolean)
  ]).sort();
  const defaultBlock = options[0] || "";

  root.innerHTML = `
    <section class="content-section">
      <div class="section-heading section-heading--inline">
        <div>
          <h3>区块资料</h3>
          <p>按区块查看基础信息、历史、计划事件、位置和公司权益。</p>
        </div>
        <label class="inline-select">选择区块<select id="blockSelect"></select></label>
      </div>
      <article class="content-card" style="margin-bottom:16px;">
        <h3>区块数据来源文件</h3>
        <div id="blockSourceFiles" class="tiles-grid"></div>
      </article>
      <article class="content-card" style="margin-bottom:16px;">
        <h3>资料覆盖摘要</h3>
        <div id="blockCoverageSummary" class="tiles-grid"></div>
      </article>
      <div class="content-grid content-grid--logs">
        <div class="column-stack">
          <article class="content-card">
            <h3>区块基础信息</h3>
            <div id="blockProfile" class="profile-grid"></div>
          </article>
          <article class="content-card">
            <h3>位置与轮廓摘要</h3>
            <div id="blockLocationTiles" class="tiles-grid"></div>
          </article>
          <article class="content-card">
            <h3>历史阶段</h3>
            <div id="blockHistory" class="history-list"></div>
          </article>
        </div>
        <div class="column-stack">
          <article class="content-card">
            <h3>计划事件</h3>
            <div id="blockSchedule" class="tiles-grid"></div>
          </article>
          <article class="content-card">
            <h3>公司权益</h3>
            <div class="table-wrap" id="companyTableWrap"></div>
          </article>
          <article class="content-card">
            <h3>权益结构摘要</h3>
            <div id="ownershipTiles" class="tiles-grid"></div>
          </article>
        </div>
      </div>
      <div class="content-grid" style="margin-top:16px;">
        <article class="content-card">
          <h3>位置明细</h3>
          <div class="table-wrap" id="blockLocationTable"></div>
        </article>
        <article class="content-card">
          <h3>轮廓采样点</h3>
          <div class="table-wrap" id="blockOutlineTable"></div>
        </article>
      </div>
    </section>
  `;

  const select = root.querySelector("#blockSelect");
  select.innerHTML = options.map(option => `<option value="${option}">${option}</option>`).join("");

  renderSourceFiles(root.querySelector("#blockSourceFiles"), state.dataInventory?.block_tables || {});

  const profileContainer = root.querySelector("#blockProfile");
  const locationTiles = root.querySelector("#blockLocationTiles");
  const historyContainer = root.querySelector("#blockHistory");
  const scheduleContainer = root.querySelector("#blockSchedule");
  const companyWrap = root.querySelector("#companyTableWrap");
  const ownershipTiles = root.querySelector("#ownershipTiles");
  const coverageSummary = root.querySelector("#blockCoverageSummary");
  const locationTable = root.querySelector("#blockLocationTable");
  const outlineTable = root.querySelector("#blockOutlineTable");

  function update(blockName) {
    const profile = profileMap[blockName] || {};
    const tables = tableMap[blockName] || {};
    renderCoverageSummary(coverageSummary, profile, tables);
    renderBlockProfile(profileContainer, profile);
    renderLocationTiles(locationTiles, profile, tables);
    renderHistory(historyContainer, tables.history || []);
    renderSchedule(scheduleContainer, tables.scheduled_events || []);
    renderCompanyTable(companyWrap, tables.company_interests || []);
    renderOwnership(ownershipTiles, profile);
    renderLocationTable(locationTable, tables.locations || []);
    renderOutlineSamples(outlineTable, tables.outline_summary || {});
  }

  if (defaultBlock) {
    select.value = defaultBlock;
    update(defaultBlock);
  }
  select.addEventListener("change", event => update(event.target.value));
}

init().catch(error => {
  document.body.innerHTML = `<pre class="error-panel">${error.message}</pre>`;
});
