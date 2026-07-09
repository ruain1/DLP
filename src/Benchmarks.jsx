// Benchmarks.jsx
// The Benchmarks page (the benchmark board). Reads acc_benchmarks (filled by manual FOK import
// today, the ACC webhook later) and shows each register row against the planning board with the
// five status states from accReconcile. Import, Match Assignees, Send to Board and the member
// visibility toggle are Owner and Admin only. CSA stays here and never goes to the planning
// board. Buttons use the planning board's lk-btn styles.
import React, { useState, useEffect, useMemo, useRef } from "react";
import { loadBenchmarks, writeBenchmarks, resolveBenchmarkCompanies, setBenchmarkComplete, loadBenchmarkImports, diffBenchmarkSnapshots } from "./data";
import { benchmarksWithStatus } from "./accReconcile";
import { importFokWorkbook } from "./benchmarkImport";
import { witnessRecipients } from "./witnessContacts";

const STATUS_META = {
  on_board:  { label: "On Board",       fg: "#8fb6dc", bg: "rgba(79,155,217,.14)" },
  ready:     { label: "Ready To Send",  fg: "#e6cf87", bg: "rgba(224,168,58,.16)" },
  changed:   { label: "Changed In ACC", fg: "#e69a90", bg: "rgba(224,109,95,.16)" },
  no_date:   { label: "No Date",        fg: "var(--muted)", bg: "var(--hover)" },
  removed:   { label: "Removed In ACC", fg: "#c7b3ea", bg: "rgba(124,58,237,.16)" },
  completed: { label: "Completed",      fg: "#7fe3b8", bg: "rgba(52,209,163,.16)" },
};
const STATUS_ORDER = ["ready", "changed", "on_board", "no_date", "removed"];
const norm = (x) => String(x || "").trim().toLowerCase();
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function BenchmarksPage({ projectId, isAdmin = false, isOwner = false, cu, activities = [], settings = {}, update, onSendToBoard, users = [], companies = [] }) {
  const admin = isAdmin || isOwner;
  const [benchmarks, setBenchmarks] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [disc, setDisc] = useState("all");
  const [stat, setStat] = useState("all");
  const [hidePast, setHidePast] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const fileRef = useRef(null);
  const [stbOpen, setStbOpen] = useState(false);
  const [defTime, setDefTime] = useState("10:00");
  const [defHours, setDefHours] = useState(2);
  const [sel, setSel] = useState({});
  const [rowTime, setRowTime] = useState({});
  const [rowHours, setRowHours] = useState({});
  const [rowTitle, setRowTitle] = useState({});
  const [rowAssignee, setRowAssignee] = useState({});
  const [rowDate, setRowDate] = useState({});
  const [rowInvite, setRowInvite] = useState({});
  const [rowAction, setRowAction] = useState({});
  const [hidePastStb, setHidePastStb] = useState(true);
  const [histOpen, setHistOpen] = useState(false);   // REV177: register change log
  const [imports, setImports] = useState([]);
  const [idxA, setIdxA] = useState(0);
  const [idxB, setIdxB] = useState(1);

  const reload = () => {
    if (!projectId) { setBenchmarks([]); return; }
    loadBenchmarks(projectId).then(setBenchmarks).catch(() => setBenchmarks([]));
  };
  useEffect(reload, [projectId]);

  const { rows, summary } = useMemo(() => benchmarksWithStatus(benchmarks || [], activities || []), [benchmarks, activities]);
  const disciplines = useMemo(() => Array.from(new Set(rows.map((r) => r.discipline).filter(Boolean))).sort(), [rows]);
  const companyName = (id) => { const c = companies.find((c) => c.id === id); return c ? c.name : null; };
  const attendees = (d) => { const { to } = witnessRecipients([String(d || "").toUpperCase()]); return to; };

  const today = todayISO();
  const shown = rows
    .filter((r) => (r.completed_at ? showDone : true))
    .filter((r) => disc === "all" || r.discipline === disc)
    .filter((r) => stat === "all" || r.status === stat)
    .filter((r) => !hidePast || !r.planned_date || r.planned_date >= today)
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || String(a.planned_date || "9999").localeCompare(String(b.planned_date || "9999")));

  // CSA has no witness routing, so it never goes to the planning board; it stays here only.
  const sendable = rows.filter((r) => !r.completed_at && (r.status === "ready" || r.status === "changed") && r.planned_date && attendees(r.discipline).length > 0);

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
      const res = await writeBenchmarks(projectId, imported, cu && cu.name);
      if (res.error) throw new Error(res.error);
      setMsg("Imported " + res.count + " benchmarks" + (res.duplicates ? " (" + res.duplicates + " duplicate ref collapsed)" : "") + " \u00b7 " + Object.entries(perSheet).map(([k, v]) => k + " " + v).join(", "));
      reload();
    } catch (err) {
      setMsg("Import failed: " + (err && err.message ? err.message : String(err)));
    }
    setBusy(false);
  };

  const openHistory = async () => {
    setHistOpen(true);
    const ims = await loadBenchmarkImports(projectId);
    setImports(ims); setIdxA(0); setIdxB(ims.length > 1 ? 1 : 0);
  };

  // Match each assignee to a company: an email by domain, a name against the user directory.
  const matchCompany = (assignee) => {
    const a = String(assignee || "").trim();
    if (!a) return null;
    if (a.indexOf("@") !== -1) {
      const dom = a.split("@")[1].toLowerCase();
      const c = companies.find((c) => c.domain && (dom === c.domain.toLowerCase() || dom.indexOf(c.domain.toLowerCase()) !== -1));
      return { companyId: c ? c.id : null, email: a };
    }
    const u = users.find((u) => norm(u.name) === norm(a));
    return u ? { companyId: u.companyId, email: "" } : { companyId: null, email: "" };
  };
  const matchAssignees = async () => {
    setBusy(true); setMsg("Matching assignees to companies\u2026");
    const updates = [];
    (benchmarks || []).forEach((b) => {
      const m = matchCompany(b.assignee_email);
      if (m && (m.companyId || m.email)) updates.push({ fok_ref: b.fok_ref, company_id: m.companyId, resolved_email: m.email });
    });
    const res = await resolveBenchmarkCompanies(projectId, updates);
    setBusy(false);
    const matched = updates.filter((u) => u.company_id).length;
    setMsg(res.error ? ("Match failed: " + res.error) : ("Matched " + matched + " of " + (benchmarks || []).length + " benchmarks to a company. Unmatched names are not in the user directory."));
    reload();
  };

  const toggleComplete = async (r) => {
    if (!admin) return;
    await setBenchmarkComplete(projectId, r.fok_ref, !r.completed_at);
    reload();
  };

  const visible = !!settings.benchmarksVisible;
  const toggleVisibility = () => {
    if (!admin || !update) return;
    update((p) => ({ ...p, settings: { ...p.settings, benchmarksVisible: !p.settings.benchmarksVisible } }), { action: "Change setting", detail: "Benchmarks visible to members " + (!visible ? "on" : "off") });
  };

  const effDate = (r) => (rowDate[r.fok_ref] != null ? rowDate[r.fok_ref] : (r.planned_date || ""));
  const isPast = (r) => { const d = effDate(r); return d && d < today; };
  const modalRows = sendable.filter((r) => !hidePastStb || !isPast(r));
  const pastCount = sendable.filter(isPast).length;
  const willSend = (r) => sel[r.fok_ref] && !(r.status === "changed" && (rowAction[r.fok_ref] || "update") === "keep");
  const openStb = () => {
    const m = {}, inv = {}, act = {};
    sendable.forEach((r) => { m[r.fok_ref] = true; inv[r.fok_ref] = attendees(r.discipline).length > 0; if (r.status === "changed") act[r.fok_ref] = "update"; });
    setSel(m); setRowInvite(inv); setRowAction(act); setRowTime({}); setRowHours({}); setRowTitle({}); setRowAssignee({}); setRowDate({}); setHidePastStb(true); setStbOpen(true);
  };
  const selCount = modalRows.filter(willSend).length;
  const confirmStb = () => {
    const items = modalRows.filter(willSend).map((r) => ({
      benchmark: r,
      title: rowTitle[r.fok_ref] != null ? rowTitle[r.fok_ref] : (r.title || ""),
      assigneeEmail: rowAssignee[r.fok_ref] != null ? rowAssignee[r.fok_ref] : (r.resolved_email || r.assignee_email || ""),
      date: rowDate[r.fok_ref] != null ? rowDate[r.fok_ref] : (r.planned_date || ""),
      time: rowTime[r.fok_ref] || defTime,
      durationMin: Math.round((rowHours[r.fok_ref] != null ? rowHours[r.fok_ref] : defHours) * 60),
      invite: rowInvite[r.fok_ref] != null ? !!rowInvite[r.fok_ref] : (attendees(r.discipline).length > 0),
    }));
    if (!items.length) return;
    if (onSendToBoard) onSendToBoard(items);
    setStbOpen(false);
    const inv = items.filter((i) => i.invite).length;
    const upd = modalRows.filter((r) => willSend(r) && r.status === "changed").length;
    setMsg("Sent " + items.length + " to the board: " + upd + " updated, " + (items.length - upd) + " new, " + inv + " with an invite. Nothing is committed or emailed: commit them in the lookahead, then release invites with Send All Pending.");
  };

  const S = {
    wrap: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "var(--card)" },
    head: { display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" },
    h1: { fontSize: 18, fontWeight: 700, margin: 0 },
    sub: { fontSize: 11.5, color: "var(--muted)" },
    ownerPill: { fontSize: 10, fontWeight: 700, color: "#fff", background: "#7c3aed", borderRadius: 20, padding: "3px 9px" },
    filters: { display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", borderBottom: "1px solid var(--line)", flexWrap: "wrap", fontSize: 12 },
    sel: { background: "var(--card)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 8, padding: "6px 10px", fontSize: 12 },
    count: { marginLeft: "auto", color: "var(--muted)", fontSize: 12 },
    scroll: { flex: 1, overflow: "auto", minHeight: 0 },
    th: { textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--muted)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 3, background: "var(--card)" },
    td: { padding: "10px 14px", borderBottom: "1px solid var(--line)", fontSize: 12.5, verticalAlign: "middle" },
    switch: () => ({ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", cursor: "pointer", userSelect: "none" }),
    track: (on) => ({ width: 34, height: 18, borderRadius: 20, background: on ? "#34d1a3" : "var(--hover)", position: "relative", flex: "0 0 auto" }),
    knob: (on) => ({ position: "absolute", top: 2, left: on ? 18 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff" }),
    inp: { background: "var(--bg)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 6, padding: "4px 6px", fontSize: 12 },
  };

  const pill = (r) => {
    const key = r.completed_at ? "completed" : r.status;
    const m = STATUS_META[key] || STATUS_META.no_date;
    const code = (key === "on_board" || key === "changed") && r.activityCode != null ? " #" + r.activityCode : "";
    return <span title={code ? "On the planning board as activity #" + r.activityCode : ""} style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: "3px 10px", color: m.fg, background: m.bg }}>{m.label}{code}</span>;
  };

  return (
    <div style={S.wrap}>
      <div style={S.head}>
        <div>
          <h1 style={S.h1}>Benchmarks</h1>
          <div style={S.sub}>{lastSynced ? "Last imported " + lastSynced : "No register imported yet"}{summary.sendable ? " \u00b7 " + sendable.length + " ready to send" : ""}</div>
        </div>
        <div style={{ flex: 1 }} />
        {admin && <>
          <span style={S.ownerPill}>Owner &amp; Admin</span>
          <div style={S.switch()} onClick={toggleVisibility} title="When on, project members can see the Benchmarks page">
            <span style={S.track(visible)}><span style={S.knob(visible)} /></span>Visible to members
          </div>
          <button className="lk-btn" onClick={openHistory}>History</button>
          <button className="lk-btn" disabled={busy || !(benchmarks && benchmarks.length)} onClick={matchAssignees}>Match Assignees</button>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: "none" }} onChange={onFile} />
          <button className="lk-btn" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}>{busy ? "Working\u2026" : "Import Register"}</button>
          <button className="lk-btn primary" disabled={!sendable.length} onClick={openStb}>Send to Board{sendable.length ? " (" + sendable.length + ")" : ""}</button>
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
        <button className={"lk-btn" + (hidePast ? " primary" : "")} onClick={() => setHidePast((v) => !v)} title="Hide anything in the past and focus on present and future">{hidePast ? "Showing Present & Future" : "Hide Past"}</button>
        <label style={S.switch()} onClick={() => setShowDone((v) => !v)}><span style={S.track(showDone)}><span style={S.knob(showDone)} /></span>Show Completed</label>
        <span style={S.count}>{shown.length} of {rows.length} benchmarks</span>
      </div>

      <div style={S.scroll}>
        {benchmarks == null ? (
          <div style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>{"Loading\u2026"}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>{admin ? "No benchmarks yet. Use Import Register to load the FOK register while ACC sync is being set up." : "No benchmarks have been imported yet."}</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={S.th}>FOK Ref</th><th style={S.th}>Discipline</th><th style={S.th}>Title</th><th style={S.th}>Planned Date</th>
              <th style={S.th}>Assignee</th><th style={S.th}>Company</th><th style={S.th}>ACC</th><th style={S.th}>Board Status</th>{admin && <th style={S.th}></th>}
            </tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.fok_ref} style={r.status === "removed" || r.status === "no_date" || r.completed_at ? { opacity: .6 } : null}>
                  <td style={{ ...S.td, fontFamily: "ui-monospace, monospace", color: "var(--muted)" }}>{r.fok_ref}</td>
                  <td style={S.td}>{r.discipline || ""}</td>
                  <td style={S.td}>{r.title || ""}</td>
                  <td style={S.td}>{r.planned_date || "Not set"}</td>
                  <td style={S.td}>{r.resolved_email || r.assignee_email || ""}</td>
                  <td style={S.td}>{companyName(r.company_id) || <span style={{ color: "var(--faint)" }}>-</span>}</td>
                  <td style={S.td}>{r.acc_url ? <a href={r.acc_url} target="_blank" rel="noreferrer" style={{ color: "#4f9bd9", textDecoration: "none" }}>Open</a> : ""}</td>
                  <td style={S.td}>{pill(r)}</td>
                  {admin && <td style={S.td}><button className="lk-btn" style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => toggleComplete(r)}>{r.completed_at ? "Restore" : "Complete"}</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {histOpen && admin && (() => {
        const A = imports[idxA], B = imports[idxB];
        const d = (A && B) ? diffBenchmarkSnapshots(B.snapshot || [], A.snapshot || []) : { added: [], removed: [], changed: [], unchanged: 0 };
        const fmt = (im) => im ? new Date(im.imported_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + (im.imported_by_name ? " \u00b7 " + im.imported_by_name : "") : "";
        const pill = (bg, fg) => ({ fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 999, background: bg, color: fg });
        const glabel = (c) => ({ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: c, margin: "16px 0 6px" });
        const row = { display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid var(--line)", fontSize: 12.5 };
        const refCell = { color: "var(--accent)", fontVariantNumeric: "tabular-nums", width: 54, flexShrink: 0, fontWeight: 600 };
        return <div style={{ position: "fixed", inset: 0, background: "rgba(4,8,12,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 60 }} onClick={() => setHistOpen(false)}>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, width: "min(880px, 96vw)", maxHeight: "84vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...S.head, position: "sticky", top: 0, background: "var(--card)", zIndex: 2 }}>
              <div><h1 style={S.h1}>Register change log</h1><div style={S.sub}>Compare an import against an earlier one</div></div>
              <div style={{ flex: 1 }} />
              <button className="lk-btn" onClick={() => setHistOpen(false)}>Close</button>
            </div>
            {imports.length < 2 ? <div style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>Only one import on record so far. The next import will compare against this one.</div> : <div style={{ padding: "14px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <select className="lk-select" value={idxA} onChange={(e) => setIdxA(Number(e.target.value))}>{imports.map((im, i) => <option key={im.id} value={i}>{fmt(im)}</option>)}</select>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>vs</span>
                <select className="lk-select" value={idxB} onChange={(e) => setIdxB(Number(e.target.value))}>{imports.map((im, i) => <option key={im.id} value={i}>{fmt(im)}</option>)}</select>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={pill("#0f2a20", "#5fd0a6")}>{d.added.length} added</span>
                <span style={pill("#2f1a1c", "#ff8079")}>{d.removed.length} removed</span>
                <span style={pill("#2e2713", "#e6b23a")}>{d.changed.length} changed</span>
                <span style={pill("var(--card2)", "var(--muted)")}>{d.unchanged} unchanged</span>
              </div>
              {d.added.length > 0 && <><div style={glabel("#5fd0a6")}>Added ({d.added.length})</div>{d.added.map((r) => <div key={r.ref} style={row}><span style={refCell}>{r.ref}</span><span style={{ flex: 1, color: "var(--ink)" }}>{r.title}</span><span style={{ color: "var(--muted)" }}>{[r.discipline, r.planned].filter(Boolean).join(" \u00b7 ")}</span></div>)}</>}
              {d.removed.length > 0 && <><div style={glabel("#ff8079")}>Removed ({d.removed.length})</div>{d.removed.map((r) => <div key={r.ref} style={row}><span style={refCell}>{r.ref}</span><span style={{ flex: 1, color: "var(--ink)" }}>{r.title}</span><span style={{ color: "var(--muted)" }}>no longer in the register</span></div>)}</>}
              {d.changed.length > 0 && <><div style={glabel("#e6b23a")}>Changed ({d.changed.length})</div>{d.changed.map((r) => <div key={r.ref} style={row}><span style={refCell}>{r.ref}</span><span style={{ flex: 1 }}><div style={{ color: "var(--ink)" }}>{r.title}</div>{r.fields.map((f, i) => <div key={i} style={{ color: "var(--muted)", marginTop: 2 }}>{f.label}: <span style={{ textDecoration: "line-through" }}>{f.from || "(blank)"}</span> {"\u2192"} <span style={{ color: "#e6d08a", fontWeight: 600 }}>{f.to || "(blank)"}</span></div>)}</span></div>)}</>}
              {d.added.length + d.removed.length + d.changed.length === 0 && <div style={{ padding: "18px 0", color: "var(--muted)", fontSize: 13 }}>No differences between these two imports.</div>}
            </div>}
          </div>
        </div>;
      })()}
      {stbOpen && admin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(4,8,12,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 60 }} onClick={() => setStbOpen(false)}>
          <div style={{ width: 920, maxWidth: "100%", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", maxHeight: "85vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Send to Board</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Confirm and fix each benchmark before it goes to the board. Correct the assignee or date, set the time and duration, and toggle whether an invite is created. Nothing is committed or sent here.</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: "1px solid var(--line)", background: "var(--bg)", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px" }}>Default Time</span>
              <input value={defTime} onChange={(e) => setDefTime(e.target.value)} style={{ ...S.inp, width: 72, textAlign: "center" }} />
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px" }}>Duration (h)</span>
              <input type="number" min="0.5" step="0.5" value={defHours} onChange={(e) => setDefHours(Number(e.target.value) || 2)} style={{ ...S.inp, width: 62, textAlign: "center" }} />
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto", cursor: "pointer", fontSize: 12, color: "var(--muted)" }} title="Exclude benchmarks whose date is before today"><input type="checkbox" checked={hidePastStb} onChange={(e) => setHidePastStb(e.target.checked)} style={{ accentColor: "#34d1a3" }} />Hide past{pastCount ? " (" + pastCount + " hidden)" : ""}</label>
            </div>
            <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr>
                  <th style={{ ...S.th, width: 30 }}></th><th style={S.th}>FOK Ref</th><th style={S.th}>Title</th><th style={S.th}>Discipline</th><th style={S.th}>Board</th><th style={S.th}>Invite</th><th style={S.th}>Assignee</th><th style={S.th}>Date</th><th style={S.th}>Time</th><th style={S.th}>Hrs</th>
                </tr></thead>
                <tbody>
                  {modalRows.map((r) => { const att = attendees(r.discipline); const inv = rowInvite[r.fok_ref] != null ? rowInvite[r.fok_ref] : att.length > 0; return (
                    <tr key={r.fok_ref}>
                      <td style={S.td}><input type="checkbox" checked={!!sel[r.fok_ref]} onChange={(e) => setSel((m) => ({ ...m, [r.fok_ref]: e.target.checked }))} style={{ accentColor: "#34d1a3" }} /></td>
                      <td style={{ ...S.td, fontFamily: "ui-monospace, monospace", color: "var(--muted)", whiteSpace: "nowrap" }}>{r.fok_ref}{r.status === "changed" ? <span style={{ color: "#e0a83a", fontSize: 10, marginLeft: 6 }}>changed</span> : null}</td>
                      <td style={S.td}><input value={rowTitle[r.fok_ref] != null ? rowTitle[r.fok_ref] : (r.title || "")} onChange={(e) => setRowTitle((m) => ({ ...m, [r.fok_ref]: e.target.value }))} style={{ ...S.inp, width: 210 }} /></td>
                      <td style={{ ...S.td, whiteSpace: "nowrap" }}>{r.discipline}</td>
                      <td style={S.td}>{r.status === "changed"
                        ? <select value={rowAction[r.fok_ref] || "update"} onChange={(e) => setRowAction((m) => ({ ...m, [r.fok_ref]: e.target.value }))} style={{ ...S.inp, width: 120 }}><option value="update">Update{r.activityCode != null ? " #" + r.activityCode : ""}</option><option value="keep">Keep current</option></select>
                        : <span style={{ fontSize: 11, color: "#7fe3b8" }}>New</span>}</td>
                      <td style={S.td}><label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", whiteSpace: "nowrap" }} title={att.join(", ")}><input type="checkbox" checked={inv} onChange={(e) => setRowInvite((m) => ({ ...m, [r.fok_ref]: e.target.checked }))} style={{ accentColor: "#34d1a3" }} /><span style={{ fontSize: 11, color: "var(--muted)" }}>{inv ? att.length + " to" : "no invite"}</span></label></td>
                      <td style={S.td}><input value={rowAssignee[r.fok_ref] != null ? rowAssignee[r.fok_ref] : (r.resolved_email || r.assignee_email || "")} onChange={(e) => setRowAssignee((m) => ({ ...m, [r.fok_ref]: e.target.value }))} placeholder="assignee" style={{ ...S.inp, width: 175 }} /></td>
                      <td style={S.td}><input type="date" value={rowDate[r.fok_ref] != null ? rowDate[r.fok_ref] : (r.planned_date || "")} onChange={(e) => setRowDate((m) => ({ ...m, [r.fok_ref]: e.target.value }))} style={{ ...S.inp, width: 132 }} /></td>
                      <td style={S.td}><input value={rowTime[r.fok_ref] != null ? rowTime[r.fok_ref] : defTime} onChange={(e) => setRowTime((m) => ({ ...m, [r.fok_ref]: e.target.value }))} style={{ ...S.inp, width: 56, textAlign: "center" }} /></td>
                      <td style={S.td}><input type="number" min="0.5" step="0.5" value={rowHours[r.fok_ref] != null ? rowHours[r.fok_ref] : defHours} onChange={(e) => setRowHours((m) => ({ ...m, [r.fok_ref]: Number(e.target.value) }))} style={{ ...S.inp, width: 48, textAlign: "center" }} /></td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", padding: "10px 18px", borderTop: "1px solid var(--line)", background: "var(--bg)", lineHeight: 1.5 }}>Creates activities on the board, not committed and with no invitations sent. Commit them in the lookahead, then release invites from the Witness Schedule with Send All Pending.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderTop: "1px solid var(--line)" }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{selCount} of {modalRows.length} selected</span>
              <div style={{ flex: 1 }} />
              <button className="lk-btn" onClick={() => setStbOpen(false)}>Cancel</button>
              <button className="lk-btn primary" disabled={!selCount} onClick={confirmStb}>Send {selCount} to Board</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
