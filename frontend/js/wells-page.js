import { getWellOptions, getWellRecords, loadPlatformState, renderShell, safeText } from "./core.js";

function renderProfile(container, profile = {}, fallback = {}) {
  const pairs = [
    ["井名", profile.well_name || fallback.well_name || "-"],
    ["井号", profile.wel_id || fallback.well_id || fallback.objectid || "-"],
    ["盆地", profile.basin_name || fallback.basin_name || fallback.basin || "-"],
    ["作业者", profile.operator_name || fallback.operator || "-"],
    ["井型", profile.well_class || fallback.class || "-"],
    ["技术状态", profile.technical_status || fallback.tch_stat || fallback.tech_stat || "-"],
    ["开钻日期", profile.spud_date || fallback.spud_dt_yr || "-"],
    ["完钻日期", profile.completed_date || "-"],
    ["总井深", profile.td_meter ? `${profile.td_meter} m` : (fallback.td_m ? `${fallback.td_m} m` : "-")],
    ["垂深", profile.tvd_meter ? `${profile.tvd_meter} m` : (fallback.tvd_meter ? `${fallback.tvd_meter} m` : "-")],
    ["地理位置", profile.country || fallback.country || "-"]
  ];
  container.innerHTML = pairs.map(([label, value]) => `<span>${label}</span><strong>${safeText(value)}</strong>`).join("");
}

function renderHistory(container, history = []) {
  if (!history.length) {
    container.innerHTML = `<article class="history-item"><strong>暂无井史摘要</strong><p>当前井还没有关联的井史事件。</p></article>`;
    return;
  }
  container.innerHTML = history.map(item => `
    <article class="history-item">
      <strong>${safeText(item.event_type || item.stage_name || "事件")}</strong>
      <small>${safeText(item.event_date || item.start_date || "-")}</small>
      <p>${safeText(item.content || item.comment || item.status || "-")}</p>
    </article>
  `).join("");
}

function renderWellDatasets(container, wellName, wellTables = {}) {
  const data = wellTables?.[wellName];
  if (!data) {
    container.innerHTML = `<article class="info-tile"><h4>暂无井专题资料</h4><p>当前井没有匹配到 periods、tests、tops、survey 等附加表数据。</p></article>`;
    return;
  }

  const cards = [
    ["作业期次", data.periods?.length ? data.periods.map(item => `${safeText(item.period_type)} / ${safeText(item.operator_name)}`).join("；") : "无"],
    ["井测试", data.tests?.length ? data.tests.map(item => `${safeText(item.test_type)} / ${safeText(item.content)}`).join("；") : "无"],
    ["分层与 Tops", data.tops?.length ? data.tops.slice(0, 3).map(item => `${safeText(item.lithostrat_unit)} ${safeText(item.lithologies)}`).join("；") : "无"],
    ["地层导出", data.stratigraphy?.length ? data.stratigraphy.slice(0, 3).map(item => safeText(item.stratigraphic_unit)).join("；") : "无"],
    ["井斜测量", data.deviation_summary ? `测点 ${safeText(data.deviation_summary.survey_points)}，最大井深 ${safeText(data.deviation_summary.max_measured_depth_m)} m` : "无"],
    ["Checkshot/VSP", data.checkshot_summary ? `测点 ${safeText(data.checkshot_summary.survey_points)}，最大 TVD ${safeText(data.checkshot_summary.max_tvd_m)} m` : "无"],
    ["取样与装备", `取样 ${safeText(data.sampling_count)} 条，装备 ${safeText(data.equipment_count)} 条，文献 ${safeText(data.bibliography_count)} 条`]
  ];

  container.innerHTML = cards.map(([title, desc]) => `
    <article class="info-tile">
      <h4>${title}</h4>
      <p>${desc}</p>
    </article>
  `).join("");
}

function renderCurveInsights(container, rows = []) {
  if (!rows.length) {
    container.innerHTML = `<article class="insight-item"><strong>暂无曲线解读</strong><p>当前没有对应的曲线采样数据。</p></article>`;
    return;
  }
  const average = values => (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2);
  const grValues = rows.map(row => Number(row.gr_api));
  const rtValues = rows.map(row => Number(row.rt_ohmm));
  const rhobValues = rows.map(row => Number(row.rhob_gcc));
  const lithology = [...new Set(rows.map(row => row.lithology))].join(" / ");
  const interpretations = [...new Set(rows.map(row => row.interpretation))].join(" / ");
  container.innerHTML = [
    ["曲线覆盖", `${rows[0].well_name}，深度 ${rows[0].depth_m}m 至 ${rows[rows.length - 1].depth_m}m`],
    ["平均 GR", `${average(grValues)} API，岩性以 ${lithology} 为主`],
    ["平均电阻率", `${average(rtValues)} Ω·m，可结合含油气显示进一步判别`],
    ["平均密度", `${average(rhobValues)} g/cc，当前解释：${interpretations}`]
  ].map(([title, desc]) => `
    <article class="insight-item">
      <strong>${title}</strong>
      <p>${desc}</p>
    </article>
  `).join("");
}

function renderTable(container, rows) {
  const fields = ["well_name", "basin", "block", "depth_m", "gr_api", "rt_ohmm", "rhob_gcc", "nphi_vv", "lithology", "formation", "interpretation"];
  const labels = { well_name: "井名", basin: "盆地", block: "区块", depth_m: "深度(m)", gr_api: "GR", rt_ohmm: "RT", rhob_gcc: "RHOB", nphi_vv: "NPHI", lithology: "岩性", formation: "层位", interpretation: "解释" };
  container.innerHTML = `
    <table>
      <thead><tr>${fields.map(field => `<th>${labels[field]}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(row => `<tr>${fields.map(field => `<td>${safeText(row[field])}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
}

function scale(value, min, max, start, end) {
  if (max === min) return (start + end) / 2;
  return start + ((value - min) / (max - min)) * (end - start);
}

function renderChart(canvas, rows) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!rows.length) {
    context.fillStyle = "#64748b";
    context.font = "16px Microsoft YaHei, Arial";
    context.fillText("当前没有可绘制的曲线数据。", 24, 40);
    return;
  }

  const depths = rows.map(row => Number(row.depth_m));
  const minDepth = Math.min(...depths);
  const maxDepth = Math.max(...depths);
  const tracks = [
    { key: "gr_api", label: "GR(API)", color: "#1d62d6", xStart: 80, xEnd: 270 },
    { key: "rt_ohmm", label: "RT(Ω·m)", color: "#13a37f", xStart: 350, xEnd: 540 },
    { key: "rhob_gcc", label: "RHOB(g/cc)", color: "#d97706", xStart: 620, xEnd: 820 }
  ];

  context.font = "14px Microsoft YaHei, Arial";
  context.fillStyle = "#667085";
  context.fillText(`井号：${rows[0].well_name}，深度范围：${minDepth}-${maxDepth}m`, 24, 24);
  context.strokeStyle = "#dbe3ef";
  context.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const y = scale(i, 0, 5, 50, 310);
    context.beginPath();
    context.moveTo(50, y);
    context.lineTo(850, y);
    context.stroke();
    context.fillStyle = "#667085";
    context.fillText(`${Math.round(scale(i, 0, 5, minDepth, maxDepth))}m`, 16, y + 4);
  }

  tracks.forEach(track => {
    const values = rows.map(row => Number(row[track.key]));
    context.strokeStyle = track.color;
    context.lineWidth = 2;
    context.beginPath();
    rows.forEach((row, index) => {
      const x = scale(Number(row[track.key]), Math.min(...values), Math.max(...values), track.xStart, track.xEnd);
      const y = scale(Number(row.depth_m), minDepth, maxDepth, 50, 310);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    context.fillStyle = track.color;
    context.fillText(track.label, track.xStart, 34);
  });
}

async function init() {
  const root = renderShell({
    currentKey: "wells",
    heroTitle: "井资料工作台",
    heroDesc: "查看井档案、井史、专题资料和测井曲线。",
    heroMeta: ["井档案", "井史", "测井曲线"]
  });
  const state = await loadPlatformState({ includeMapLayers: false });
  const options = getWellOptions(state);
  const wellRecords = getWellRecords(state);
  const wellRecordByName = Object.fromEntries(wellRecords.map(record => [record.name, record]));
  const defaultOption = options[0];

  root.innerHTML = `
    <section class="content-section">
      <div class="section-heading section-heading--inline">
        <div>
          <h3>井资料与曲线</h3>
          <p>按井查看基础资料、井史摘要和曲线信息。</p>
        </div>
        <label class="inline-select">曲线示例井<select id="wellSelect"></select></label>
      </div>
      <div class="content-grid content-grid--logs">
        <div class="column-stack">
          <article class="content-card">
            <h3>井档案摘要</h3>
            <div id="wellProfile" class="profile-grid"></div>
          </article>
          <article class="content-card">
            <h3>井史事件</h3>
            <div id="wellHistory" class="history-list"></div>
          </article>
          <article class="content-card">
            <h3>井专题资料</h3>
            <div id="wellDatasets" class="tiles-grid"></div>
          </article>
        </div>
        <div class="column-stack">
          <article class="content-card">
            <h3>测井曲线</h3>
            <p class="muted">当前曲线区使用样例曲线数据展示。</p>
            <canvas id="logChart" width="900" height="360"></canvas>
          </article>
          <article class="content-card">
            <h3>曲线解释提示</h3>
            <div id="curveInsights" class="insight-grid"></div>
          </article>
          <article class="content-card">
            <h3>测井采样表</h3>
            <div class="table-wrap" id="logTableWrap"></div>
          </article>
        </div>
      </div>
    </section>
  `;

  const select = root.querySelector("#wellSelect");
  select.innerHTML = options.map(option => `<option value="${option.value}">${option.label}</option>`).join("");

  const profileContainer = root.querySelector("#wellProfile");
  const historyContainer = root.querySelector("#wellHistory");
  const datasetsContainer = root.querySelector("#wellDatasets");
  const insightsContainer = root.querySelector("#curveInsights");
  const tableWrap = root.querySelector("#logTableWrap");
  const canvas = root.querySelector("#logChart");

  function update(wellName) {
    const record = wellRecordByName[wellName] || {};
    const rows = record.rows || [];
    const fallback = rows[0] || record.feature?.properties || {};
    const profile = record.profile || state.wellProfiles?.[wellName] || {};
    renderProfile(profileContainer, profile, fallback);
    renderHistory(historyContainer, profile.history || []);
    renderWellDatasets(datasetsContainer, wellName, state.wellTables);
    renderChart(canvas, rows);
    renderCurveInsights(insightsContainer, rows);
    renderTable(tableWrap, rows);
  }

  update(defaultOption?.value);
  select.value = defaultOption?.value || "";
  select.addEventListener("change", event => update(event.target.value));
}

init().catch(error => {
  document.body.innerHTML = `<pre class="error-panel">${error.message}</pre>`;
});


