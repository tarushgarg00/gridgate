import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import * as XLSX from "xlsx";

const input = process.argv[2];
const root = process.cwd();
const outputCsv = path.join(root, "data", "lbnl-queue-projects.csv");
const outputSummary = path.join(root, "data", "lbnl-queue-summary.json");

if (!input) {
  console.error(
    "Usage: node scripts/prepare-queue-data.mjs <lbnl-workbook.xlsx>",
  );
  process.exit(1);
}

const workbook = XLSX.readFile(input);
const projectSheetName =
  workbook.SheetNames.find((name) => /project|queue/i.test(name)) ??
  workbook.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[projectSheetName], {
  defval: null,
});

const normalized = rows.map(normalizeRow).filter((row) => row.region);
const summaries = new Map();

for (const row of normalized) {
  const existing = summaries.get(row.region) ?? {
    region: row.region,
    activeProjects: 0,
    activeMw: 0,
    completedWaits: [],
  };

  if (row.status === "active") {
    existing.activeProjects += 1;
    existing.activeMw += row.mw ?? 0;
  }

  if (row.waitYears !== null) {
    existing.completedWaits.push(row.waitYears);
  }

  summaries.set(row.region, existing);
}

const regions = {};
for (const [region, value] of summaries.entries()) {
  const typicalWaitYears = median(value.completedWaits) ?? 5;
  regions[region] = {
    region,
    activeProjects: value.activeProjects,
    activeMw: Math.round(value.activeMw),
    typicalWaitYears,
    congestionLevel: congestionLevel(value.activeMw, typicalWaitYears),
    note: "Regional generation/storage queue context from LBNL Queued Up workbook; not a site-specific load interconnection position.",
  };
}

const csv = [
  "region,active_projects,active_mw,typical_wait_years,congestion_level,note",
  ...Object.values(regions).map((region) =>
    [
      region.region,
      region.activeProjects,
      region.activeMw,
      region.typicalWaitYears,
      region.congestionLevel,
      JSON.stringify(region.note),
    ].join(","),
  ),
].join("\n");

fs.writeFileSync(outputCsv, `${csv}\n`);
fs.writeFileSync(
  outputSummary,
  `${JSON.stringify(
    {
      source: {
        name: "LBNL U.S. Interconnection Queue Data Through 2025",
        url: "https://eta.lbl.gov/publications/us-interconnection-queue-data-0",
      },
      regions,
    },
    null,
    2,
  )}\n`,
);

function normalizeRow(row) {
  const region = text(pick(row, ["region", "ISO", "RTO", "Entity", "Queue"]));
  const statusValue = text(pick(row, ["status", "Queue Status", "q_status"]));
  const requestDate = dateValue(pick(row, ["Request Date", "request_date", "Date Entered Queue"]));
  const completionDate = dateValue(pick(row, ["IA Date", "COD", "Commercial Operation Date", "completion_date"]));
  const mw = numberValue(pick(row, ["MW", "Capacity (MW)", "capacity_mw"]));
  const status = /active|queued|under study/i.test(statusValue ?? "")
    ? "active"
    : "other";
  const waitYears =
    requestDate && completionDate
      ? Math.round(((completionDate - requestDate) / (365.25 * 24 * 60 * 60 * 1000)) * 10) / 10
      : null;

  return { region, status, mw, waitYears };
}

function pick(row, keys) {
  const entries = Object.entries(row);
  for (const key of keys) {
    const match = entries.find(([name]) => name.toLowerCase() === key.toLowerCase());
    if (match) {
      return match[1];
    }
  }
  return null;
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function dateValue(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function median(values) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10
    : sorted[middle];
}

function congestionLevel(activeMw, waitYears) {
  if (activeMw > 300000 || waitYears >= 5.5) {
    return "Severe";
  }
  if (activeMw > 150000 || waitYears >= 4.5) {
    return "High";
  }
  if (activeMw > 75000 || waitYears >= 3) {
    return "Moderate";
  }
  return "Low";
}
