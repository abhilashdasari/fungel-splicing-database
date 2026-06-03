const DATA_URL = "data/splicing_event_distribution.csv";
const TOOL_DATA_URL = "data/splicing_tool_distribution.csv";
const NAME_MAP_URL = "data/comparison_name_mapping.csv";
const GENE_MANIFEST_URL = "data/gene_list_manifest.json";
const UNIQUE_GENE_SETS_URL = "data/unique_gene_sets.json";
const TOOL_TYPES = [
  { key: "DEXSeq_count", label: "DEXSeq", color: "#0f766e" },
  { key: "Sleuth_count", label: "Sleuth", color: "#b7791f" },
  { key: "Leafcutter_count", label: "Leafcutter", color: "#2563eb" },
  { key: "rMATS_gene_count", label: "rMATS", color: "#b8325f" },
];
const EVENT_TYPES = [
  { key: "SE_count", label: "SE", color: "#0f766e" },
  { key: "RI_count", label: "RI", color: "#b7791f" },
  { key: "MXE_count", label: "MXE", color: "#2563eb" },
  { key: "A3SS_count", label: "A3SS", color: "#b8325f" },
  { key: "A5SS_count", label: "A5SS", color: "#15803d" },
];

let allRows = [];
let toolRows = [];
let filteredRows = [];
let nameMap = new Map();
let geneManifest = [];
let uniqueGeneSets = {};
let currentGeneRows = [];
let filteredGeneRows = [];
let webRInstance = null;
const comparisonSort = { key: "total_tool_gene_hits", direction: "desc" };
const geneSort = { key: "gene_name", direction: "asc" };

const els = {
  search: document.querySelector("#searchInput"),
  disease: document.querySelector("#diseaseFilter"),
  minEvents: document.querySelector("#minEvents"),
  sortBy: document.querySelector("#sortBy"),
  body: document.querySelector("#resultsBody"),
  tableCount: document.querySelector("#tableCount"),
  compositionChart: document.querySelector("#compositionChart"),
  toolChart: document.querySelector("#toolChart"),
  diseaseChart: document.querySelector("#diseaseChart"),
  upDownChart: document.querySelector("#upDownChart"),
  metricComparisons: document.querySelector("#metricComparisons"),
  metricGenesSummed: document.querySelector("#metricGenesSummed"),
  metricGenesUnion: document.querySelector("#metricGenesUnion"),
  metricEvents: document.querySelector("#metricEvents"),
  downloadFiltered: document.querySelector("#downloadFiltered"),
  geneComparison: document.querySelector("#geneComparison"),
  geneSetFilter: document.querySelector("#geneSetFilter"),
  geneSearch: document.querySelector("#geneSearch"),
  geneSummary: document.querySelector("#geneSummary"),
  geneBody: document.querySelector("#geneBody"),
  downloadGenes: document.querySelector("#downloadGenes"),
  sortButtons: document.querySelectorAll(".sort-header"),
  runR: document.querySelector("#runR"),
  rCode: document.querySelector("#rCode"),
  rOutput: document.querySelector("#rOutput"),
  webRStatus: document.querySelector("#webrStatus"),
};

init();

async function init() {
  const [csv, toolCsv, mapCsv, manifest, uniqueSets] = await Promise.all([
    fetchText(DATA_URL),
    fetchText(TOOL_DATA_URL),
    fetchText(NAME_MAP_URL),
    fetch(GENE_MANIFEST_URL).then((response) => {
      if (!response.ok) throw new Error(`Could not load ${GENE_MANIFEST_URL}`);
      return response.json();
    }),
    fetch(UNIQUE_GENE_SETS_URL).then((response) => {
      if (!response.ok) throw new Error(`Could not load ${UNIQUE_GENE_SETS_URL}`);
      return response.json();
    }),
  ]);

  nameMap = new Map(parseCsv(mapCsv).map((row) => [row.old_name, row.new_name]));
  geneManifest = manifest;
  uniqueGeneSets = uniqueSets;
  toolRows = parseCsv(toolCsv).map(normalizeToolRow);
  allRows = parseCsv(csv).map(normalizeRow);
  attachToolCounts(allRows, toolRows);
  populateDiseaseFilter(allRows);
  populateGeneComparisons(geneManifest);
  bindEvents();
  applyFilters();
  await loadSelectedGeneList();
}

function fetchText(url) {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`Could not load ${url}`);
    return response.text();
  });
}

function bindEvents() {
  [els.search, els.disease, els.minEvents].forEach((el) => {
    el.addEventListener("input", applyFilters);
  });
  els.sortBy.addEventListener("input", () => {
    comparisonSort.key = els.sortBy.value;
    comparisonSort.direction = "desc";
    applyFilters();
  });
  els.downloadFiltered.addEventListener("click", downloadFilteredCsv);
  els.geneComparison.addEventListener("change", loadSelectedGeneList);
  els.geneSetFilter.addEventListener("input", applyGeneFilters);
  els.geneSearch.addEventListener("input", applyGeneFilters);
  els.downloadGenes.addEventListener("click", downloadGeneCsv);
  els.sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const state = button.dataset.table === "genes" ? geneSort : comparisonSort;
      if (state.key === button.dataset.key) {
        state.direction = state.direction === "asc" ? "desc" : "asc";
      } else {
        state.key = button.dataset.key;
        state.direction = defaultSortDirection(button.dataset.key);
      }

      if (button.dataset.table === "genes") {
        applyGeneFilters();
      } else {
        applyFilters();
      }
    });
  });
  els.runR.addEventListener("click", runRAnalysis);
}

function normalizeRow(row) {
  const numericColumns = [
    "total_unique_genes",
    "total_rmats_events",
    "SE_count",
    "RI_count",
    "MXE_count",
    "A3SS_count",
    "A5SS_count",
    "pct_SE",
    "pct_RI",
    "pct_MXE",
    "pct_A3SS",
    "pct_A5SS",
  ];

  numericColumns.forEach((column) => {
    row[column] = Number(row[column] || 0);
  });
  row.display_name = nameMap.get(row.comparison_id) || row.condition || row.comparison_id;

  return row;
}

function normalizeToolRow(row) {
  row.gene_count = Number(row.gene_count || 0);
  return row;
}

function attachToolCounts(rows, tools) {
  const byComparison = new Map();
  tools.forEach((row) => {
    if (!byComparison.has(row.comparison_id)) {
      byComparison.set(row.comparison_id, {
        DEXSeq_count: 0,
        Sleuth_count: 0,
        Leafcutter_count: 0,
        rMATS_gene_count: 0,
      });
    }

    const target = byComparison.get(row.comparison_id);
    if (row.tool === "DEXSeq") target.DEXSeq_count = row.gene_count;
    if (row.tool === "Sleuth") target.Sleuth_count = row.gene_count;
    if (row.tool === "Leafcutter") target.Leafcutter_count = row.gene_count;
    if (row.tool === "rMATS") target.rMATS_gene_count = row.gene_count;
  });

  rows.forEach((row) => {
    const counts = byComparison.get(row.comparison_id) || {};
    TOOL_TYPES.forEach((tool) => {
      row[tool.key] = Number(counts[tool.key] || 0);
    });
    row.total_tool_gene_hits = TOOL_TYPES.reduce((total, tool) => total + row[tool.key], 0);
  });
}

function populateDiseaseFilter(rows) {
  const diseases = [...new Set(rows.map((row) => row.disease_group_combined).filter(Boolean))].sort();
  diseases.forEach((disease) => {
    const option = document.createElement("option");
    option.value = disease;
    option.textContent = disease;
    els.disease.appendChild(option);
  });
}

function populateGeneComparisons(manifest) {
  els.geneComparison.innerHTML = "";
  manifest
    .slice()
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .forEach((item) => {
      const option = document.createElement("option");
      option.value = item.comparison_id;
      option.textContent = `${item.display_name} (${formatNumber(item.unique_gene_count)} unique genes)`;
      els.geneComparison.appendChild(option);
    });
}

function applyFilters() {
  const query = els.search.value.trim().toLowerCase();
  const disease = els.disease.value;
  const minEvents = Number(els.minEvents.value || 0);

  filteredRows = allRows
    .filter((row) => {
      const searchable = [
        row.comparison_id,
        row.display_name,
        row.condition,
        row.disease_group,
        row.disease_group_combined,
        row.section_target,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!query || searchable.includes(query)) &&
        (!disease || row.disease_group_combined === disease) &&
        row.total_tool_gene_hits >= minEvents
      );
    })
    .sort((a, b) => compareValues(a, b, comparisonSort.key, comparisonSort.direction));

  if (els.sortBy.value !== comparisonSort.key && [...els.sortBy.options].some((option) => option.value === comparisonSort.key)) {
    els.sortBy.value = comparisonSort.key;
  }

  renderMetrics(filteredRows);
  renderTable(filteredRows);
  updateSortIndicators("comparison", comparisonSort);
  renderToolChart(filteredRows.slice(0, 20));
  renderCompositionChart(filteredRows.slice(0, 20));
  renderDiseaseChart(filteredRows);
  renderUpDownChart(filteredRows.slice(0, 20));
}

function renderMetrics(rows) {
  els.metricComparisons.textContent = formatNumber(rows.length);
  els.metricGenesSummed.textContent = formatNumber(sumUniqueGeneSetSizes(rows));
  els.metricGenesUnion.textContent = formatNumber(countUnionGenes(rows));
  els.metricEvents.textContent = formatNumber(sum(rows, "total_tool_gene_hits"));
}

function renderTable(rows) {
  els.tableCount.textContent = `${formatNumber(rows.length)} rows`;
  els.body.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.className = "empty";
    td.colSpan = 14;
    td.textContent = "No comparisons match the current filters.";
    tr.appendChild(td);
    els.body.appendChild(tr);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    [
      row.display_name,
      row.condition,
      row.disease_group_combined,
      row.total_unique_genes,
      row.total_tool_gene_hits,
      row.DEXSeq_count,
      row.Sleuth_count,
      row.Leafcutter_count,
      row.rMATS_gene_count,
      row.total_rmats_events,
      row.SE_count,
      row.RI_count,
      row.MXE_count,
      row.A3SS_count,
      row.A5SS_count,
    ].forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = index >= 3 ? formatNumber(value) : value;
      tr.appendChild(td);
    });
    els.body.appendChild(tr);
  });
}

function renderToolChart(rows) {
  if (!rows.length) {
    els.toolChart.innerHTML = '<p class="empty">No chart data available.</p>';
    return;
  }

  const width = 980;
  const rowHeight = 30;
  const labelWidth = 245;
  const chartWidth = width - labelWidth - 56;
  const axisHeight = 34;
  const height = rows.length * rowHeight + 82;
  const maxTotal = Math.max(...rows.map((row) => row.total_tool_gene_hits), 1);

  const bars = rows
    .map((row, rowIndex) => {
      let x = labelWidth;
      const y = rowIndex * rowHeight + 30;
      const segments = TOOL_TYPES.map((tool) => {
        const segmentWidth = (row[tool.key] / maxTotal) * chartWidth;
        const rect = `<rect x="${x}" y="${y}" width="${segmentWidth}" height="18" fill="${tool.color}"><title>${tool.label}: ${formatNumber(row[tool.key])}</title></rect>`;
        x += segmentWidth;
        return rect;
      }).join("");

      return `
        <text x="0" y="${y + 14}" font-size="12" fill="#18201c">${escapeHtml(shorten(row.display_name, 34))}</text>
        ${segments}
        <text x="${labelWidth + chartWidth + 8}" y="${y + 14}" font-size="12" fill="#66726b">${formatNumber(row.total_tool_gene_hits)}</text>
      `;
    })
    .join("");

  els.toolChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
      ${legend(width, TOOL_TYPES)}
      ${bars}
      ${axisTicks(labelWidth, rows.length * rowHeight + 38, chartWidth, maxTotal, axisHeight)}
    </svg>
  `;
}

function renderCompositionChart(rows) {
  if (!rows.length) {
    els.compositionChart.innerHTML = '<p class="empty">No chart data available.</p>';
    return;
  }

  const width = 980;
  const rowHeight = 30;
  const labelWidth = 245;
  const chartWidth = width - labelWidth - 56;
  const axisHeight = 34;
  const height = rows.length * rowHeight + 82;
  const maxTotal = Math.max(...rows.map((row) => row.total_rmats_events), 1);

  const bars = rows
    .map((row, rowIndex) => {
      let x = labelWidth;
      const y = rowIndex * rowHeight + 30;
      const segments = EVENT_TYPES.map((event) => {
        const segmentWidth = (row[event.key] / maxTotal) * chartWidth;
        const rect = `<rect x="${x}" y="${y}" width="${segmentWidth}" height="18" fill="${event.color}"><title>${event.label}: ${formatNumber(row[event.key])}</title></rect>`;
        x += segmentWidth;
        return rect;
      }).join("");

      return `
        <text x="0" y="${y + 14}" font-size="12" fill="#18201c">${escapeHtml(shorten(row.display_name, 34))}</text>
        ${segments}
        <text x="${labelWidth + chartWidth + 8}" y="${y + 14}" font-size="12" fill="#66726b">${formatNumber(row.total_rmats_events)}</text>
      `;
    })
    .join("");

  els.compositionChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
      ${legend(width, EVENT_TYPES)}
      ${bars}
      ${axisTicks(labelWidth, rows.length * rowHeight + 38, chartWidth, maxTotal, axisHeight)}
    </svg>
  `;
}

function renderDiseaseChart(rows) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = row.disease_group_combined || "unknown";
    grouped.set(key, (grouped.get(key) || 0) + row.total_tool_gene_hits);
  });

  const data = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
  if (!data.length) {
    els.diseaseChart.innerHTML = '<p class="empty">No chart data available.</p>';
    return;
  }

  const width = 620;
  const rowHeight = 44;
  const labelWidth = 180;
  const chartWidth = width - labelWidth - 86;
  const height = data.length * rowHeight + 30;
  const maxValue = Math.max(...data.map((item) => item[1]), 1);

  const bars = data
    .map(([label, value], index) => {
      const y = index * rowHeight + 18;
      const barWidth = (value / maxValue) * chartWidth;
      return `
        <text x="0" y="${y + 18}" font-size="13" fill="#18201c">${escapeHtml(label)}</text>
        <rect x="${labelWidth}" y="${y}" width="${barWidth}" height="24" rx="4" fill="#0f766e"></rect>
        <text x="${labelWidth + barWidth + 8}" y="${y + 18}" font-size="12" fill="#66726b">${formatNumber(value)}</text>
      `;
    })
    .join("");

  els.diseaseChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">${bars}</svg>`;
}

function renderUpDownChart(rows) {
  const manifestByComparison = new Map(geneManifest.map((item) => [item.comparison_id, item]));
  const data = rows
    .map((row) => {
    const manifest = manifestByComparison.get(row.comparison_id);
    const counts = manifest?.category_counts || {};
    const up = Number(counts["Upregulated genes"] || 0);
    const down = Number(counts["Downregulated genes"] || 0);
      return {
        label: row.display_name,
        up,
        down,
        total: up + down,
      };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  if (!data.length) {
    els.upDownChart.innerHTML = '<p class="empty">No chart data available.</p>';
    return;
  }

  const width = 620;
  const rowHeight = 44;
  const labelWidth = 180;
  const chartWidth = width - labelWidth - 86;
  const axisHeight = 34;
  const height = data.length * rowHeight + 66;
  const maxValue = Math.max(...data.map((item) => item.total), 1);

  const bars = data
    .map((item, index) => {
      const y = index * rowHeight + 18;
      const upWidth = (item.up / maxValue) * chartWidth;
      const downWidth = (item.down / maxValue) * chartWidth;
      return `
        <text x="0" y="${y + 18}" font-size="13" fill="#18201c">${escapeHtml(shorten(item.label, 28))}</text>
        <rect x="${labelWidth}" y="${y}" width="${upWidth}" height="24" rx="4" fill="#0f766e"><title>Upregulated: ${formatNumber(item.up)}</title></rect>
        <rect x="${labelWidth + upWidth}" y="${y}" width="${downWidth}" height="24" rx="4" fill="#b8325f"><title>Downregulated: ${formatNumber(item.down)}</title></rect>
        <text x="${labelWidth + upWidth + downWidth + 8}" y="${y + 18}" font-size="12" fill="#66726b">${formatNumber(item.total)}</text>
      `;
    })
    .join("");

  els.upDownChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
      ${legend(width, [
        { label: "Upregulated", color: "#0f766e" },
        { label: "Downregulated", color: "#b8325f" },
      ])}
      ${bars}
      ${axisTicks(labelWidth, data.length * rowHeight + 28, chartWidth, maxValue, axisHeight)}
    </svg>
  `;
}

async function loadSelectedGeneList() {
  const selected = geneManifest.find((item) => item.comparison_id === els.geneComparison.value);
  if (!selected) return;

  els.geneBody.innerHTML = '<tr><td class="empty" colspan="3">Loading gene list...</td></tr>';
  const csv = await fetchText(`data/${selected.filename}`);
  currentGeneRows = parseCsv(csv);
  populateGeneSetFilter(currentGeneRows);
  applyGeneFilters();
}

function populateGeneSetFilter(rows) {
  const previousValue = els.geneSetFilter.value;
  const geneSets = [...new Set(rows.map((row) => row.gene_set).filter(Boolean))].sort();
  els.geneSetFilter.innerHTML = '<option value="">All gene sets</option>';
  geneSets.forEach((geneSet) => {
    const option = document.createElement("option");
    option.value = geneSet;
    option.textContent = geneSet;
    els.geneSetFilter.appendChild(option);
  });
  els.geneSetFilter.value = geneSets.includes(previousValue) ? previousValue : "";
}

function applyGeneFilters() {
  const selected = geneManifest.find((item) => item.comparison_id === els.geneComparison.value);
  const geneSet = els.geneSetFilter.value;
  const query = els.geneSearch.value.trim().toLowerCase();

  filteredGeneRows = currentGeneRows.filter((row) => {
    return (
      (!geneSet || row.gene_set === geneSet) &&
      (!query || row.gene_name.toLowerCase().includes(query))
    );
  });
  filteredGeneRows.sort((a, b) => compareValues(a, b, geneSort.key, geneSort.direction));

  renderGeneSummary(selected, filteredGeneRows);
  renderGeneTable(filteredGeneRows);
  updateSortIndicators("genes", geneSort);
}

function renderGeneSummary(selected, rows) {
  if (!selected) {
    els.geneSummary.innerHTML = "";
    return;
  }

  const chips = [
    selected.display_name,
    selected.disease_group || "unknown disease",
    `${formatNumber(selected.unique_gene_count)} unique genes`,
    `${formatNumber(rows.length)} visible rows`,
  ];

  els.geneSummary.innerHTML = chips
    .map((chip) => `<span class="summary-chip">${escapeHtml(chip)}</span>`)
    .join("");
}

function renderGeneTable(rows) {
  els.geneBody.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.className = "empty";
    td.colSpan = 3;
    td.textContent = "No genes match the current filters.";
    tr.appendChild(td);
    els.geneBody.appendChild(tr);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    [row.comparison_name, row.gene_set, row.gene_name].forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    els.geneBody.appendChild(tr);
  });

}

async function runRAnalysis() {
  els.runR.disabled = true;
  els.rOutput.textContent = "";

  try {
    if (!webRInstance) {
      els.webRStatus.textContent = "Loading webR...";
      const { WebR } = await import("https://webr.r-wasm.org/latest/webr.mjs");
      webRInstance = new WebR();
      await webRInstance.init();
    }

    els.webRStatus.textContent = "Running R...";
    const csv = toCsv(filteredRows);
    await webRInstance.FS.writeFile("/filtered_splicing_data.csv", csv);
    await webRInstance.evalRVoid('filtered_data <- read.csv("/filtered_splicing_data.csv", check.names = FALSE)');

    const result = await webRInstance.evalR(`capture.output({ ${els.rCode.value} })`);
    const output = await result.toArray();
    els.rOutput.textContent = output.join("\n");
    els.webRStatus.textContent = "R analysis complete";
  } catch (error) {
    els.rOutput.textContent = error.stack || error.message;
    els.webRStatus.textContent = "R analysis failed";
  } finally {
    els.runR.disabled = false;
  }
}

function downloadFilteredCsv() {
  const blob = new Blob([toCsvRows(filteredRows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "filtered_splicing_events.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function downloadGeneCsv() {
  const selected = geneManifest.find((item) => item.comparison_id === els.geneComparison.value);
  const comparisonName = selected ? selected.display_name : "genes";
  const geneSet = els.geneSetFilter.value || "all_gene_sets";
  const blob = new Blob([toCsvRows(filteredGeneRows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(comparisonName)}_${slugify(geneSet)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows.shift();
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

function toCsv(rows) {
  const headers = Object.keys(allRows[0] || {});
  const lines = rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","));
  return [headers.join(","), ...lines].join("\n");
}

function toCsvRows(rows) {
  const headers = Object.keys(rows[0] || {});
  const lines = rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","));
  return [headers.join(","), ...lines].join("\n");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function sumEvents(rows) {
  return Object.fromEntries(EVENT_TYPES.map((event) => [event.key, sum(rows, event.key)]));
}

function countUnionGenes(rows) {
  const genes = new Set();
  rows.forEach((row) => {
    (uniqueGeneSets[row.comparison_id] || []).forEach((gene) => genes.add(gene));
  });
  return genes.size;
}

function sumUniqueGeneSetSizes(rows) {
  return rows.reduce((total, row) => total + (uniqueGeneSets[row.comparison_id] || []).length, 0);
}

function compareValues(a, b, key, direction) {
  const aValue = a[key] ?? "";
  const bValue = b[key] ?? "";
  const aNumber = Number(aValue);
  const bNumber = Number(bValue);
  const multiplier = direction === "asc" ? 1 : -1;

  if (aValue !== "" && bValue !== "" && Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return (aNumber - bNumber) * multiplier;
  }

  return String(aValue).localeCompare(String(bValue), undefined, {
    numeric: true,
    sensitivity: "base",
  }) * multiplier;
}

function defaultSortDirection(key) {
  return /count|total|genes|events|hits/i.test(key) ? "desc" : "asc";
}

function updateSortIndicators(table, state) {
  els.sortButtons.forEach((button) => {
    if (button.dataset.table !== table) return;
    button.removeAttribute("aria-sort");
    if (button.dataset.key === state.key) {
      button.setAttribute("aria-sort", state.direction === "asc" ? "ascending" : "descending");
    }
  });
}

function legend(width, items) {
  let x = width - Math.min(520, items.length * 108);
  return items.map((event) => {
    const item = `
      <rect x="${x}" y="0" width="12" height="12" fill="${event.color}"></rect>
      <text x="${x + 17}" y="11" font-size="12" fill="#66726b">${event.label}</text>
    `;
    x += Math.max(76, event.label.length * 8 + 34);
    return item;
  }).join("");
}

function axisTicks(x, y, width, maxValue, height) {
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => {
    const ratio = index / tickCount;
    const tickX = x + ratio * width;
    const value = Math.round(maxValue * ratio);
    return `
      <line x1="${tickX}" y1="${y}" x2="${tickX}" y2="${y + 6}" stroke="#9aa49d"></line>
      <text x="${tickX}" y="${y + 22}" font-size="11" fill="#66726b" text-anchor="${index === 0 ? "start" : index === tickCount ? "end" : "middle"}">${formatCompact(value)}</text>
      <line x1="${tickX}" y1="28" x2="${tickX}" y2="${y}" stroke="#e5e9e3"></line>
    `;
  }).join("");

  return `
    <line x1="${x}" y1="${y}" x2="${x + width}" y2="${y}" stroke="#9aa49d"></line>
    ${ticks}
    <text x="${x + width / 2}" y="${y + height}" font-size="11" fill="#66726b" text-anchor="middle">Gene or event count scale</text>
  `;
}

function shorten(text, maxLength) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugify(text) {
  return String(text)
    .trim()
    .replaceAll(/[^A-Za-z0-9._-]+/g, "_")
    .replaceAll(/^_+|_+$/g, "") || "download";
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatCompact(value) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}
