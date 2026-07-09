// src/benchmarkImport.js
// REV166: manual FOK register import, the path Ruain uses while ACC authorisation is pending.
// It reads the real multi sheet workbook (discipline tabs, metadata rows above a row 7 header,
// ACC links embedded as hyperlinks on the title cell) and produces the same benchmark rows the
// ACC webhook will later produce, so both feed one staging table. exceljs is loaded on demand
// (it is ~900KB) to keep the Benchmarks page light.
import { parseFokRegister } from "./accReconcile.js";

// Sheets that hold FOK items. Everything else (Main, Lists, Documentation, Spare_Del) is skipped.
// Matched case-insensitively; the discipline shown is the sheet's own name.
const DISCIPLINE_SHEETS = ["Electrical", "Mechanical", "CSA"];

// UTC-safe YYYY-MM-DD so a midnight register date never slips a day across time zones.
function isoDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return d;
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
}

// Turn one exceljs cell into a plain value, and surface the first http hyperlink on the row
// (the title cell's ACC link; the assignee's mailto is ignored because it is not http).
function cellValue(cell, linkSink) {
  let v = cell.value;
  if (v instanceof Date) return isoDate(v);   // a Date is also an object, so catch it first
  if (v && typeof v === "object") {
    if (v.hyperlink && typeof v.hyperlink === "string" && v.hyperlink.slice(0, 4) === "http" && !linkSink.acc) linkSink.acc = v.hyperlink;
    if ("text" in v) v = v.text;
    else if ("result" in v) v = v.result;      // formula cell: use the computed result
    else if ("richText" in v) v = (v.richText || []).map((t) => t.text).join("");
    else v = null;
  }
  if (v instanceof Date) v = isoDate(v);
  return v == null ? "" : v;
}

// arrayBuffer: the uploaded .xlsx bytes. Returns { rows, perSheet, sheetsSeen }.
export async function importFokWorkbook(arrayBuffer) {
  const ExcelJS = (await import("exceljs")).default || (await import("exceljs"));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);

  const all = [];
  const perSheet = {};
  const sheetsSeen = [];
  wb.eachSheet((ws) => {
    sheetsSeen.push(ws.name);
    const disc = DISCIPLINE_SHEETS.find((d) => d.toLowerCase() === ws.name.trim().toLowerCase());
    if (!disc) return;

    const rows = [];
    const linkByRow = {};
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const cells = [];
      const sink = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => { cells[colNumber - 1] = cellValue(cell, sink); });
      rows[rowNumber - 1] = cells;
      if (sink.acc) linkByRow[rowNumber - 1] = sink.acc;
    });

    const parsed = parseFokRegister(rows, { discipline: disc, optional: true });
    for (const p of parsed) {
      if (!p.accUrl && linkByRow[p.sourceRow]) p.accUrl = linkByRow[p.sourceRow];
    }
    perSheet[disc] = parsed.length;
    all.push(...parsed);
  });

  return { rows: all, perSheet, sheetsSeen };
}
