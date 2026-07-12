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
import { MultiSel, inSel } from "./multisel";

// REV258: chips colour through the theme and palette variables (with color-mix for
// the tints), so the Display palette toggle and light mode finally reach this page.
const STATUS_META = {
  on_board:  { label: "On Board",       cls: "bmk-onboard" },
  ready:     { label: "Ready To Send",  cls: "bmk-ready" },
  changed:   { label: "Changed In ACC", cls: "bmk-changed" },
  no_date:   { label: "No Date",        cls: "bmk-nodate" },
  removed:   { label: "Removed In ACC", cls: "bmk-removed" },
  completed: { label: "Completed",      cls: "bmk-done" },
};
const BMK_CSS = `
.bmk-chip{display:inline-block;font-size:10.5px;font-weight:700;border-radius:20px;padding:3px 10px;white-space:nowrap}
.bmk-ready{color:var(--amber,#b45309);background:color-mix(in srgb, var(--amber,#b45309) 15%, transparent)}
.bmk-changed{color:var(--red,#d62828);background:color-mix(in srgb, var(--red,#d62828) 12%, transparent)}
.bmk-done{color:var(--green,#0e9e6e);background:color-mix(in srgb, var(--green,#0e9e6e) 14%, transparent)}
.bmk-onboard{color:var(--linkc,#4f9bd9);background:color-mix(in srgb, var(--linkc,#4f9bd9) 13%, transparent)}
.bmk-nodate{color:var(--muted);background:var(--hover)}
.bmk-removed{color:#8b5cf6;background:color-mix(in srgb, #8b5cf6 13%, transparent)}
.bmk-flag{display:inline-block;font-size:10px;font-weight:800;border-radius:999px;padding:3px 8px;margin-left:6px;white-space:nowrap}
.bmk-link{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:color-mix(in srgb, var(--linkc,#4f9bd9) 13%, transparent);color:var(--linkc,#4f9bd9);text-decoration:none;font-family:ui-monospace,monospace;white-space:nowrap}
`;
const STATUS_ORDER = ["ready", "changed", "on_board", "no_date", "completed", "removed"];
const norm = (x) => String(x || "").trim().toLowerCase();
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function BenchmarksPage({ projectId, isAdmin = false, isOwner = false, cu, activities = [], settings = {}, update, onSendToBoard, onOpenActivity, users = [], companies = [] }) {
  const admin = isAdmin || isOwner;
  const [benchmarks, setBenchmarks] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [disc, setDisc] = useState([]);   // REV270: multi-select; empty = all
  const [stat, setStat] = useState([]);   // REV270: multi-select; empty = all
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
  const [diffOpen, setDiffOpen] = useState(null);     // REV256: fok_ref whose send-diff is expanded
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
    .filter((r) => ((r.completed_at || r.status === "completed") ? showDone : true)) // REV197: board-complete counts as completed
    .filter((r) => inSel(disc, r.discipline))
    .filter((r) => inSel(stat, r.status))
    // REV198: completed rows are exempt from the past filter; finished work is past by
    // nature, so hiding the past silently overruled Show Completed and the toggle read
    // as dead. Completed visibility is governed by its own toggle alone.
    .filter((r) => !hidePast || r.completed_at || r.status === "completed" || !r.planned_date || r.planned_date >= today)
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
      // REV197: a register that previously carried planned dates and suddenly carries none
      // is almost always a renamed date column, not a real change. Losing 173 dates must
      // never be silent again; the importer decides with the facts in front of them.
      const newWith = imported.filter((r) => r.plannedDate).length;
      if (newWith === 0) {
        let prevWith = 0;
        try { const ims = await loadBenchmarkImports(projectId); const snap = (ims && ims[0] && ims[0].snapshot) || []; prevWith = snap.filter((x) => x && x.planned).length; } catch (e2) {}
        if (prevWith >= 10 && !window.confirm("This file carries no planned dates at all, but the previous import carried " + prevWith + ". That usually means the register's date column header changed and the parser missed it. Import anyway and wipe every planned date?")) {
          setMsg("Import cancelled: the file carried no planned dates (previous import had " + prevWith + "). Existing data untouched.");
          setBusy(false); return;
        }
      }
      const res = await writeBenchmarks(projectId, imported, cu && cu.name);
      if (res.error) throw new Error(res.error);
      setMsg("Imported " + res.count + " benchmarks" + (res.duplicates ? " (" + res.duplicates + " duplicate ref collapsed)" : "") + " \u00b7 " + Object.entries(perSheet).map(([k, v]) => k + " " + v).join(", ") + " \u00b7 planned dates on " + newWith + " of " + res.count + " rows" + (newWith === 0 ? " \u26A0" : ""));
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
  // REV193: three-layer matcher. (1) The local part of an assignee email is a person's
  // name (jukka.mechelin -> Jukka Mechelin), matched against the user directory, which
  // resolves both the person and their company. (2) Explicit company domains. (3) A domain
  // map learned during the run: every person match teaches assignee-domain -> company, so
  // an unknown address at a known domain still resolves. Names without an @ match as before.
  const localName = (email) => norm(String(email).split("@")[0].replace(/[._-]+/g, " "));
  const matchAll = () => {
    const list = benchmarks || [];
    const learned = {};
    companies.forEach((c) => { if (c.domain) learned[c.domain.toLowerCase()] = c.id; });
    list.forEach((b) => { const a = String(b.assignee_email || ""); if (b.company_id && a.indexOf("@") !== -1) learned[a.split("@")[1].toLowerCase()] = b.company_id; });
    const out = []; let byPerson = 0, byDomain = 0; const unknownDomains = new Set();
    const pass = (learnOnly) => list.forEach((b) => {
      if (out.some((u) => u.fok_ref === b.fok_ref)) return;
      const a = String(b.assignee_email || "").trim();
      if (!a) return;
      if (a.indexOf("@") !== -1) {
        const dom = a.split("@")[1].toLowerCase();
        const u = users.find((x) => norm(x.name) === localName(a));
        if (u) { byPerson++; if (u.companyId) learned[dom] = u.companyId; out.push({ fok_ref: b.fok_ref, company_id: u.companyId || null, resolved_email: a }); return; }
        if (!learnOnly && learned[dom]) { byDomain++; out.push({ fok_ref: b.fok_ref, company_id: learned[dom], resolved_email: a }); return; }
        if (!learnOnly) unknownDomains.add(dom);
      } else if (!learnOnly) {
        const u = users.find((x) => norm(x.name) === norm(a));
        if (u) { byPerson++; out.push({ fok_ref: b.fok_ref, company_id: u.companyId || null, resolved_email: "" }); }
      }
    });
    pass(true); pass(false);
    return { updates: out, byPerson, byDomain, unknownDomains: Array.from(unknownDomains) };
  };
  const matchAssignees = async () => {
    setBusy(true); setMsg("Matching assignees to people and companies\u2026");
    const { updates, byPerson, byDomain, unknownDomains } = matchAll();
    const res = await resolveBenchmarkCompanies(projectId, updates.filter((u) => u.company_id || u.resolved_email));
    setBusy(false);
    const matched = updates.filter((u) => u.company_id).length;
    const tail = unknownDomains.length ? (" Unknown domains left as-is: " + unknownDomains.join(", ") + ". Set the domain on the company (Settings, Companies, Manage) or add the person to Global Contacts and re-run.") : "";
    setMsg(res.error ? ("Match failed: " + res.error) : ("Matched " + matched + " of " + (benchmarks || []).length + " (" + byPerson + " by person, " + byDomain + " by domain)." + tail));
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
    h1: { fontSize: 18, fontWeight: 700, margin: 0, color: "var(--head)" },
    sub: { fontSize: 11.5, color: "var(--muted)" },
    ownerPill: { fontSize: 10, fontWeight: 700, color: "#fff", background: "#7c3aed", borderRadius: 20, padding: "3px 9px" },
    filters: { display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", borderBottom: "1px solid var(--line)", flexWrap: "wrap", fontSize: 12 },
    sel: { background: "var(--card)", border: "1px solid var(--line)", color: "var(--ink)", borderRadius: 8, padding: "6px 10px", fontSize: 12 },
    count: { marginLeft: "auto", color: "var(--muted)", fontSize: 12 },
    scroll: { flex: 1, overflow: "auto", minHeight: 0 },
    th: { textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--muted)", fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 3, background: "var(--card)" },
    td: { padding: "10px 14px", borderBottom: "1px solid var(--line)", fontSize: 12.5, verticalAlign: "middle" },
    switch: () => ({ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", cursor: "pointer", userSelect: "none" }),
    track: (on) => ({ width: 34, height: 18, borderRadius: 20, background: on ? "#34d1a3" : "var(--hover)", position: "relative", flex: "0 0 auto" }),
    knob: (on) => ({ position: "absolute", top: 2, left: on ? 18 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff" }),
    inp: { background: "var(--paper)", border: "1px solid var(--line)", color: "var(--ink)", borderRadius: 6, padding: "4px 6px", fontSize: 12 },
  };

  const pill = (r) => {
    const key = r.completed_at ? "completed" : r.status;
    const m = STATUS_META[key] || STATUS_META.no_date;
    // REV256: the Board column now carries the activity code for every state, so the
    // chip is purely about state again; the tooltip keeps the linkage readable here.
    const code = "";
    return <span className={"bmk-chip " + m.cls} title={r.activityId ? "On the planning board" + (r.activityCode != null ? " as activity #" + r.activityCode : "") : ""}>{m.label}</span>;
  };

  return (
    <div style={S.wrap}>
      <style>{BMK_CSS}</style>
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
        <MultiSel label="All Disciplines" options={disciplines} value={disc} onChange={setDisc} />
        <MultiSel label="All Statuses" options={[{ v: "completed", t: "Completed" }, ...STATUS_ORDER.map((k) => ({ v: k, t: STATUS_META[k].label }))]} value={stat} onChange={setStat} />
        <button className={"lk-btn" + (hidePast ? " primary" : "")} onClick={() => setHidePast((v) => !v)} title="Hide anything in the past and focus on present and future">{hidePast ? "Showing Present & Future" : "Hide Past"}</button>
        <label style={S.switch()} onClick={() => setShowDone((v) => !v)}><span style={S.track(showDone)}><span style={S.knob(showDone)} /></span>Show Completed</label>
        <span style={S.count}>{shown.length} of {rows.length} benchmarks{(() => { const n = rows.filter((r) => r.activityId).length; return n ? " \u00b7 " + n + " on the board" : ""; })()}</span>
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
              <th style={S.th}>Assignee</th><th style={S.th}>Company</th><th style={S.th}>ACC</th><th style={S.th}>Board</th><th style={S.th}>Board Status</th>{admin && <th style={S.th}></th>}
            </tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.fok_ref} style={r.status === "removed" || r.status === "no_date" || r.completed_at ? { opacity: .6 } : null}>
                  <td style={{ ...S.td, fontFamily: "ui-monospace, monospace", color: "var(--muted)" }}>{r.fok_ref}</td>
                  <td style={S.td}>{r.discipline || ""}</td>
                  <td style={S.td}>{r.title || ""}</td>
                  <td style={S.td}>{r.planned_date || "Not set"}</td>
                  <td style={S.td} title={r.resolved_email || r.assignee_email || ""}>{(() => { const a = String(r.resolved_email || r.assignee_email || ""); if (!a) return ""; const u = a.indexOf("@") !== -1 ? users.find((x) => norm(x.name) === localName(a)) : users.find((x) => norm(x.name) === norm(a)); return u ? u.name : a; })()}</td>
                  <td style={S.td}>{companyName(r.company_id) || <span style={{ color: "var(--faint)" }}>-</span>}</td>
                  <td style={S.td}>{r.acc_url ? <a href={r.acc_url} target="_blank" rel="noreferrer" style={{ color: "var(--linkc, #4f9bd9)", textDecoration: "none" }}>Open</a> : ""}</td>
                  <td style={S.td}>{r.activityId
                    ? <a href="#" className="bmk-link" onClick={(e) => { e.preventDefault(); if (onOpenActivity) onOpenActivity(r.activityId); }} title={"Open this activity on the planning board"}>{r.activityCode != null ? "#" + r.activityCode : "On board"}</a>
                    : <span style={{ color: "var(--faint)" }}>-</span>}</td>
                  <td style={S.td}>{pill(r)}{r.status === "removed" && r.boardDone ? <span className="bmk-flag bmk-done" title="Witness passed on the board; the row has since left the register (expected for finished FOKs)">Completed</span> : null}</td>
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
              <div><h1 style={S.h1}>Register change log</h1><div style={S.sub}>Compare an import against an earlier one. Compares Title, Planned date, Assignee, Discipline, ACC link and Notes per FOK ref; a re-saved workbook with identical content correctly shows no differences. Notes and ACC links are only tracked from 10 Jul 2026 onward, so comparisons against older imports judge the original four fields.</div></div>
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
              {(() => { const blind = (im) => im && Array.isArray(im.snapshot) && im.snapshot.length > 0 && !im.snapshot.some((x) => x && x.planned); const bA = blind(A), bB = blind(B); return (bA || bB) ? <div style={{ border: "1px solid rgba(224,161,6,.5)", background: "rgba(224,161,6,.08)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#E0A106", marginBottom: 12 }}>{"\u26A0"} The {bA && bB ? "compared imports carry" : (bA ? "newer import carries" : "older import carries")} no planned dates at all, which usually means the register's date column header changed and the parser missed it. A comparison against a date-blind import understates real change.</div> : null; })()}
              {d.added.length > 0 && <><div style={glabel("#5fd0a6")}>Added ({d.added.length})</div>{d.added.map((r) => <div key={r.ref} style={row}><span style={refCell}>{r.ref}</span><span style={{ flex: 1, color: "var(--ink)" }}>{r.title}</span><span style={{ color: "var(--muted)" }}>{[r.discipline, r.planned].filter(Boolean).join(" \u00b7 ")}</span></div>)}</>}
              {d.removed.length > 0 && <><div style={glabel("#ff8079")}>Removed ({d.removed.length})</div>{d.removed.map((r) => <div key={r.ref} style={row}><span style={refCell}>{r.ref}</span><span style={{ flex: 1, color: "var(--ink)" }}>{r.title}</span><span style={{ color: "var(--muted)" }}>no longer in the register</span></div>)}</>}
              {d.changed.length > 0 && <><div style={glabel("#e6b23a")}>Changed ({d.changed.length})</div>{d.changed.map((r) => <div key={r.ref} style={row}><span style={refCell}>{r.ref}</span><span style={{ flex: 1 }}><div style={{ color: "var(--ink)" }}>{r.title}</div>{r.fields.map((f, i) => <div key={i} style={{ color: "var(--muted)", marginTop: 2 }}>{f.label}: <span style={{ textDecoration: "line-through" }}>{(f.from || "(blank)").length > 90 ? (f.from || "").slice(0, 90) + "..." : (f.from || "(blank)")}</span> {"\u2192"} <span style={{ color: "#e6d08a", fontWeight: 600 }}>{(f.to || "(blank)").length > 90 ? (f.to || "").slice(0, 90) + "..." : (f.to || "(blank)")}</span></div>)}</span></div>)}</>}
              {d.added.length + d.removed.length + d.changed.length === 0 && <div style={{ padding: "18px 0", color: "var(--muted)", fontSize: 13 }}>No differences between these two imports.</div>}
            </div>}
          </div>
        </div>;
      })()}
      {/* REV256: what Send will change vs the live card. Proposed reflects the row's
          current edits in this dialog, so the comparison is exactly what Send will do. */}
      {stbOpen && admin && (() => {
        const boardDiff = (r) => {
          const a = (activities || []).find((x) => x.id === r.activityId);
          if (!a) return null;
          const title = rowTitle[r.fok_ref] != null ? rowTitle[r.fok_ref] : (r.title || "");
          const date = rowDate[r.fok_ref] != null ? rowDate[r.fok_ref] : (r.planned_date || "");
          const time = rowTime[r.fok_ref] != null ? rowTime[r.fok_ref] : defTime;
          const hrs = rowHours[r.fok_ref] != null ? rowHours[r.fok_ref] : defHours;
          const asg = rowAssignee[r.fok_ref] != null ? rowAssignee[r.fok_ref] : (r.resolved_email || r.assignee_email || "");
          const bw = String(a.witnessAt || "");
          const bDate = bw ? bw.slice(0, 10) : "";
          const bTime = bw.length >= 16 ? bw.slice(11, 16) : "";
          const bDur = a.witnessDurationMin != null ? a.witnessDurationMin / 60 : null;
          const bAsg = String(a.assigneeEmail || "");
          const bAcc = String(a.accUrl || "");
          const nAcc = String(r.acc_url || "");
          return [
            { field: "Title", board: a.desc || "Not set", proposed: title || "Not set", moved: String(a.desc || "") !== String(title || "") },
            { field: "Date & time", board: bDate ? bDate + (bTime ? ", " + bTime : "") : "Not set", proposed: date ? date + ", " + time : "Not set", moved: bDate !== date || (bTime && bTime !== time) },
            { field: "Assignee", board: bAsg || "Not set", proposed: asg || "Not set", moved: bAsg.toLowerCase() !== String(asg || "").toLowerCase() },
            { field: "Duration", board: bDur != null ? bDur + " h" : "Not set", proposed: hrs + " h", moved: bDur != null ? Number(bDur) !== Number(hrs) : true },
            { field: "ACC link", board: bAcc ? "Set" : "Not set", proposed: nAcc ? (nAcc === bAcc ? "Set (unchanged)" : "Set (new link)") : "Not set", moved: bAcc !== nAcc },
          ];
        };
        return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(4,8,12,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 60 }} onClick={() => setStbOpen(false)}>
          <div style={{ width: 920, maxWidth: "100%", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", maxHeight: "85vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Send to Board</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Confirm and fix each benchmark before it goes to the board. Correct the assignee or date, set the time and duration, and toggle whether an invite is created. Nothing is committed or sent here.</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: "1px solid var(--line)", background: "var(--paper)", flexWrap: "wrap" }}>
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
                    <React.Fragment key={r.fok_ref}>
                    <tr>
                      <td style={S.td}><input type="checkbox" checked={!!sel[r.fok_ref]} onChange={(e) => setSel((m) => ({ ...m, [r.fok_ref]: e.target.checked }))} style={{ accentColor: "#34d1a3" }} /></td>
                      <td style={{ ...S.td, fontFamily: "ui-monospace, monospace", color: "var(--muted)", whiteSpace: "nowrap" }}>{r.fok_ref}{r.status === "changed" ? <><span style={{ color: "var(--amber, #e0a83a)", fontSize: 10, marginLeft: 6 }}>changed</span>{r.activityId ? <button title="Show exactly what Send will change vs the board" onClick={() => setDiffOpen((v) => (v === r.fok_ref ? null : r.fok_ref))} style={{ marginLeft: 6, width: 17, height: 17, borderRadius: "50%", border: 0, background: diffOpen === r.fok_ref ? "color-mix(in srgb, var(--linkc, #4f9bd9) 32%, transparent)" : "color-mix(in srgb, var(--linkc, #4f9bd9) 15%, transparent)", color: "var(--linkc, #4f9bd9)", fontSize: 10.5, fontWeight: 800, cursor: "pointer", verticalAlign: "-3px", padding: 0 }}>i</button> : null}</> : null}</td>
                      <td style={S.td}><input value={rowTitle[r.fok_ref] != null ? rowTitle[r.fok_ref] : (r.title || "")} onChange={(e) => setRowTitle((m) => ({ ...m, [r.fok_ref]: e.target.value }))} style={{ ...S.inp, width: 210 }} /></td>
                      <td style={{ ...S.td, whiteSpace: "nowrap" }}>{r.discipline}</td>
                      <td style={S.td}>{r.status === "changed"
                        ? <select value={rowAction[r.fok_ref] || "update"} onChange={(e) => setRowAction((m) => ({ ...m, [r.fok_ref]: e.target.value }))} style={{ ...S.inp, width: 120 }}><option value="update">Update{r.activityCode != null ? " #" + r.activityCode : ""}</option><option value="keep">Keep current</option></select>
                        : <span style={{ fontSize: 11, color: "var(--green, #7fe3b8)" }}>New</span>}</td>
                      <td style={S.td}><label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", whiteSpace: "nowrap" }} title={att.join(", ")}><input type="checkbox" checked={inv} onChange={(e) => setRowInvite((m) => ({ ...m, [r.fok_ref]: e.target.checked }))} style={{ accentColor: "#34d1a3" }} /><span style={{ fontSize: 11, color: "var(--muted)" }}>{inv ? att.length + " to" : "no invite"}</span></label></td>
                      <td style={S.td}><input value={rowAssignee[r.fok_ref] != null ? rowAssignee[r.fok_ref] : (r.resolved_email || r.assignee_email || "")} onChange={(e) => setRowAssignee((m) => ({ ...m, [r.fok_ref]: e.target.value }))} placeholder="assignee" style={{ ...S.inp, width: 175 }} /></td>
                      <td style={S.td}><input type="date" value={rowDate[r.fok_ref] != null ? rowDate[r.fok_ref] : (r.planned_date || "")} onChange={(e) => setRowDate((m) => ({ ...m, [r.fok_ref]: e.target.value }))} style={{ ...S.inp, width: 132 }} /></td>
                      <td style={S.td}><input value={rowTime[r.fok_ref] != null ? rowTime[r.fok_ref] : defTime} onChange={(e) => setRowTime((m) => ({ ...m, [r.fok_ref]: e.target.value }))} style={{ ...S.inp, width: 56, textAlign: "center" }} /></td>
                      <td style={S.td}><input type="number" min="0.5" step="0.5" value={rowHours[r.fok_ref] != null ? rowHours[r.fok_ref] : defHours} onChange={(e) => setRowHours((m) => ({ ...m, [r.fok_ref]: Number(e.target.value) }))} style={{ ...S.inp, width: 48, textAlign: "center" }} /></td>
                    </tr>
                    {diffOpen === r.fok_ref && (() => { const d = boardDiff(r); if (!d) return null; return (
                      <tr><td colSpan={10} style={{ padding: "0 12px 14px", background: "color-mix(in srgb, var(--linkc, #4f9bd9) 6%, transparent)", borderBottom: "1px solid var(--line)" }}>
                        <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", marginTop: 2 }}>
                          <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 800, color: "var(--linkc, #4f9bd9)", background: "color-mix(in srgb, var(--linkc, #4f9bd9) 10%, transparent)", letterSpacing: ".04em" }}>{"WHAT SEND WILL CHANGE" + (r.activityCode != null ? " ON ACTIVITY #" + r.activityCode : "") + " \u00b7 PROPOSED REFLECTS YOUR EDITS IN THIS DIALOG"}</div>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
                            <tr><td style={{ padding: "7px 10px" }}></td><td style={{ padding: "7px 10px", fontSize: 10, fontWeight: 800, letterSpacing: ".07em", color: "var(--muted)" }}>ON THE BOARD</td><td style={{ padding: "7px 10px", fontSize: 10, fontWeight: 800, letterSpacing: ".07em", color: "var(--muted)" }}>PROPOSED</td></tr>
                            {d.map((x) => (
                              <tr key={x.field}>
                                <td style={{ padding: "6px 10px", fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--faint)", whiteSpace: "nowrap" }}>{x.field}{x.moved ? <span style={{ fontSize: 9.5, fontWeight: 800, color: "var(--amber, #e0a83a)", marginLeft: 7, letterSpacing: ".05em" }}>CHANGED</span> : null}</td>
                                <td style={{ padding: "6px 10px", fontSize: 12, color: x.moved ? "var(--amber, #e0a83a)" : "var(--muted)", fontWeight: x.moved ? 700 : 400 }}>{x.board}</td>
                                <td style={{ padding: "6px 10px", fontSize: 12, color: x.moved ? "var(--ink)" : "var(--muted)", fontWeight: x.moved ? 600 : 400 }}>{x.proposed}</td>
                              </tr>
                            ))}
                          </tbody></table>
                        </div>
                      </td></tr>); })()}
                    </React.Fragment>
                  ); })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", padding: "10px 18px", borderTop: "1px solid var(--line)", background: "var(--paper)", lineHeight: 1.5 }}>Creates activities on the board, not committed and with no invitations sent. Commit them in the lookahead, then release invites from the Witness Schedule with Send All Pending.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderTop: "1px solid var(--line)" }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{selCount} of {modalRows.length} selected</span>
              <div style={{ flex: 1 }} />
              <button className="lk-btn" onClick={() => setStbOpen(false)}>Cancel</button>
              <button className="lk-btn primary" disabled={!selCount} onClick={confirmStb}>Send {selCount} to Board</button>
            </div>
          </div>
        </div>
        ); })()}
    </div>
  );
}
