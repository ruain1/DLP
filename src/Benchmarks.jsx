// Benchmarks.jsx
// REV167: the Benchmarks page. Reads the acc_benchmarks staging table (filled today by manual
// FOK import, later by the ACC webhook) and shows each register row against the board via the
// five status states from accReconcile. Import and the member-visibility toggle are Owner and
// Admin only; Send to Board follows in the next revision. The page itself is visible to members
// only when an admin turns on the visibility toggle (gated in App.jsx; enforced here too).
import React, { useState, useEffect, useMemo, useRef } from "react";
import { loadBenchmarks, writeBenchmarks } from "./data";
import { benchmarksWithStatus } from "./accReconcile";
import { importFokWorkbook } from "./benchmarkImport";

const STATUS_META = {
  on_board: { label: "On Board",       fg: "#8fb6dc", bg: "rgba(79,155,217,.14)" },
  ready:    { label: "Ready To Send",  fg: "#e6cf87", bg: "rgba(224,168,58,.16)" },
  changed:  { label: "Changed In ACC", fg: "#e69a90", bg: "rgba(224,109,95,.16)" },
  no_date:  { label: "No Date",        fg: "var(--muted)", bg: "var(--hover)" },
  removed:  { label: "Removed In ACC", fg: "#c7b3ea", bg: "rgba(124,58,237,.16)" },
};
const STATUS_ORDER = ["ready", "changed", "on_board", "no_date", "removed"];

export default function BenchmarksPage({ projectId, isAdmin = false, isOwner = false, cu, activities = [], settings = {}, update }) {
  const admin = isAdmin || isOwner;
  const [benchmarks, setBenchmarks] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [disc, setDisc] = useState("all");
  const [stat, setStat] = useState("all");
  const fileRef = useRef(null);

  const reload = () => {
    if (!projectId) { setBenchmarks([]); return; }
    loadBenchmarks(projectId).then(setBenchmarks).catch(() => setBenchmarks([]));
  };
  useEffect(reload, [projectId]);

  const { rows, summary } = useMemo(
    () => benchmarksWithStatus(benchmarks || [], activities || []),
    [benchmarks, activities]
  );
  const disciplines = useMemo(() => Array.from(new Set(rows.map((r) => r.discipline).filter(Boolean))).sort(), [rows]);
  const shown = rows
    .filter((r) => disc === "all" || r.discipline === disc)
    .filter((r) => stat === "all" || r.status === stat)
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || String(a.planned_date || "9999").localeCompare(String(b.planned_date || "9999")));

  const lastSynced = useMemo(() => {
    const t = (benchmarks || []).map((b) => b.synced_at).filter(Boolean).sort().slice(-1)[0];
    return t ? new Date(t).toLocaleString() : null;
  }, [benchmarks]);

  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true); setMsg("Reading " + f.name + "\u2026");
    try {
      const ab = await f.arrayBuffer();
      const { rows: imported, perSheet } = await importFokWorkbook(ab);
      if (!imported.length) throw new Error("No FOK rows found. Check the workbook has the Electrical, Mechanical or CSA sheets.");
      const res = await writeBenchmarks(projectId, imported);
      if (res.error) throw new Error(res.error);
      setMsg("Imported " + res.count + " benchmarks" + (res.duplicates ? " (" + res.duplicates + " duplicate ref collapsed)" : "") + " \u00b7 " + Object.entries(perSheet).map(([k, v]) => k + " " + v).join(", "));
      reload();
    } catch (err) {
      setMsg("Import failed: " + (err && err.message ? err.message : String(err)));
    }
    setBusy(false);
  };

  const visible = !!settings.benchmarksVisible;
  const toggleVisibility = () => {
    if (!admin || !update) return;
    update(
      (p) => ({ ...p, settings: { ...p.settings, benchmarksVisible: !p.settings.benchmarksVisible } }),
      { action: "Change setting", detail: "Benchmarks visible to members " + (!visible ? "on" : "off") }
    );
  };

  const S = {
    wrap: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 },
    head: { display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" },
    h1: { fontSize: 18, fontWeight: 700, margin: 0 },
    sub: { fontSize: 11.5, color: "var(--muted)" },
    grow: { flex: 1 },
    ownerPill: { fontSize: 10, fontWeight: 700, color: "#fff", background: "#7c3aed", borderRadius: 20, padding: "3px 9px" },
    btn: { border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
    btnPri: { border: "none", background: "#34d1a3", color: "#06231b", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
    filters: { display: "flex", alignItems: "center", gap: 8, padding: "11px 20px", borderBottom: "1px solid var(--line)", flexWrap: "wrap", fontSize: 12 },
    sel: { background: "var(--card)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 8, padding: "6px 10px", fontSize: 12 },
    count: { marginLeft: "auto", color: "var(--muted)", fontSize: 12 },
    scroll: { flex: 1, overflow: "auto", minHeight: 0 },
    th: { textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--muted)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, background: "var(--bg)" },
    td: { padding: "10px 14px", borderBottom: "1px solid var(--line)", fontSize: 12.5, verticalAlign: "middle" },
    switch: (on) => ({ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", cursor: "pointer", userSelect: "none" }),
    track: (on) => ({ width: 34, height: 18, borderRadius: 20, background: on ? "#34d1a3" : "var(--hover)", position: "relative", transition: "background .15s", flex: "0 0 auto" }),
    knob: (on) => ({ position: "absolute", top: 2, left: on ? 18 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left .15s" }),
  };

  const pill = (s) => {
    const m = STATUS_META[s] || STATUS_META.no_date;
    return <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: "3px 10px", color: m.fg, background: m.bg }}>{m.label}</span>;
  };

  return (
    <div style={S.wrap}>
      <div style={S.head}>
        <div>
          <h1 style={S.h1}>Benchmarks</h1>
          <div style={S.sub}>{lastSynced ? "Last imported " + lastSynced : "No register imported yet"}{summary.sendable ? " \u00b7 " + summary.sendable + " ready to send" : ""}</div>
        </div>
        <div style={S.grow} />
        {admin && <>
          <span style={S.ownerPill}>Owner &amp; Admin</span>
          <div style={S.switch(visible)} onClick={toggleVisibility} title="When on, project members can see the Benchmarks page">
            <span style={S.track(visible)}><span style={S.knob(visible)} /></span>
            Visible to members
          </div>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: "none" }} onChange={onFile} />
          <button style={S.btn} disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}>{busy ? "Importing\u2026" : "Import Register"}</button>
        </>}
      </div>

      {msg && <div style={{ padding: "9px 20px", fontSize: 12, color: msg.indexOf("failed") !== -1 ? "var(--red)" : "var(--muted)", borderBottom: "1px solid var(--line)" }}>{msg}</div>}

      <div style={S.filters}>
        <select style={S.sel} value={disc} onChange={(e) => setDisc(e.target.value)}>
          <option value="all">All Disciplines</option>
          {disciplines.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select style={S.sel} value={stat} onChange={(e) => setStat(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <span style={S.count}>{shown.length} of {rows.length} benchmarks</span>
      </div>

      <div style={S.scroll}>
        {benchmarks == null ? (
          <div style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>{"Loading\u2026"}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>
            {admin ? "No benchmarks yet. Use Import Register to load the FOK register while ACC sync is being set up." : "No benchmarks have been imported yet."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={S.th}>FOK Ref</th><th style={S.th}>Discipline</th><th style={S.th}>Title</th>
              <th style={S.th}>Planned Date</th><th style={S.th}>Assignee</th><th style={S.th}>ACC</th><th style={S.th}>Board Status</th>
            </tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.fok_ref} style={r.status === "removed" || r.status === "no_date" ? { opacity: .6 } : null}>
                  <td style={{ ...S.td, fontFamily: "ui-monospace, monospace", color: "var(--muted)" }}>{r.fok_ref}</td>
                  <td style={S.td}>{r.discipline || ""}</td>
                  <td style={S.td}>{r.title || ""}</td>
                  <td style={S.td}>{r.planned_date || "Not set"}</td>
                  <td style={S.td}>{r.assignee_email || ""}</td>
                  <td style={S.td}>{r.acc_url ? <a href={r.acc_url} target="_blank" rel="noreferrer" style={{ color: "#4f9bd9", textDecoration: "none" }}>Open</a> : ""}</td>
                  <td style={S.td}>{pill(r.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
