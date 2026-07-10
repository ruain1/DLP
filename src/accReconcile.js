// src/accReconcile.js
// REV163: the brain of the ACC to DLP sync. Pure, environment agnostic logic with no
// imports and no secrets, so the edge function (Deno, unattended) and the client (for a
// preview) can both run it and the Node harness can test it exhaustively. It turns a parsed
// FOK register into board changes and PENDING invites. It never talks to ACC, never sends an
// invite, and never deletes an activity. Those guardrails are asserted in the harness.
//
// Two guarantees baked in and tested:
//   1. Invites are only ever produced as pending. There is no "send" here; releasing invites
//      stays a human action through the existing Send All Pending flow.
//   2. Removals are only ever candidates. A row dropping out of the register is flagged, never
//      auto-deleted, because the register is not the sole source of truth for a live board.

// Header driven, not positional. The W26 asset register taught us columns get renamed and
// reordered between weeks, so we locate by header text against aliases and tolerate absence.
const HEADER_ALIASES = {
  fokRef:         ["fok register id", "register id", "fok id", "fok ref", "ref", "id"],
  discipline:     ["discipline", "trade", "package / contract"],
  title:          ["planned fok title", "fok title", "activity", "title"],
  description:    ["new fok description description / scope", "description / scope", "description", "scope"],
  plannedDate:    ["planned start date", "planned completion date", "planned date", "fok date", "date"],
  assigneeEmail:  ["assignee", "assignee email", "responsible", "email"],
  accUrl:         ["acc link", "acc url", "acc", "link", "report"],
  registerStatus: ["fok status", "status"],
  notes:          ["actions / comments summary linked ss_fok", "actions / comments summary", "notes", "comments", "remarks"],
};

function norm(v) { return String(v == null ? "" : v).trim(); }
function normKey(v) { return norm(v).toLowerCase().replace(/\s+/g, " "); }

// Map the header row to column indices. First matching alias wins; unknown headers ignored.
export function mapFokHeaders(headerRow) {
  const idx = {};
  const cells = (headerRow || []).map(normKey);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    let found = -1;
    for (const alias of aliases) {
      const at = cells.indexOf(alias);
      if (at !== -1) { found = at; break; }
    }
    idx[field] = found;
  }
  // REV197: the planned date column gets a substring fallback. Its header has been
  // reworded between weeks; an exact-alias miss silently nulled every date on 10 Jul,
  // which cascaded into every status reading No Date. Any header containing "date"
  // alongside "planned" or "target" now matches.
  if (idx.plannedDate === -1) idx.plannedDate = cells.findIndex((c) => c.includes("date") && (c.includes("planned") || c.includes("target")));
  return idx;
}

// rows: 2D array of cell values. The real register carries metadata rows above the table and
// the header does not sit on row 0, so we scan for the header (the first row that yields both
// a FOK reference and a title column). opts.discipline overrides the discipline for every row,
// because on the real sheets discipline is the tab, not a column. opts.optional returns [] for
// non-FOK sheets (Lists, Documentation) instead of throwing. Dates should be pre-formatted to
// YYYY-MM-DD by the caller; the ACC hyperlink is attached by the import layer via sourceRow.
export function parseFokRegister(rows, opts) {
  opts = opts || {};
  if (!rows || !rows.length) return [];
  let hIdx = -1, idx = null;
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const m = mapFokHeaders(rows[r]);
    if (m.fokRef !== -1 && m.title !== -1) { hIdx = r; idx = m; break; }
  }
  if (hIdx === -1) {
    if (opts.optional) return [];
    throw new Error("No FOK header row found (need a FOK Register ID and a Planned FOK Title column).");
  }
  const out = [];
  for (let r = hIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const at = (f) => (idx[f] == null || idx[f] === -1 ? "" : norm(row[idx[f]]));
    const fokRef = at("fokRef");
    if (!fokRef) continue;
    const rawAssignee = at("assigneeEmail");
    out.push({
      fokRef,
      discipline:     opts.discipline || at("discipline") || null,
      title:          at("title") || null,
      description:    at("description") || null,
      plannedDate:    at("plannedDate") || null,
      // Electrical carries emails, Mechanical and CSA carry names; keep emails lowercased, names as-is.
      assigneeEmail:  rawAssignee ? (rawAssignee.includes("@") ? rawAssignee.toLowerCase() : rawAssignee) : null,
      accUrl:         at("accUrl") || null,
      registerStatus: at("registerStatus") || null,
      notes:          at("notes") || null,
      sourceRow:      r,
    });
  }
  return out;
}

// Canonical, key sorted signature so change detection compares like for like against jsonb
// output (the SharePoint sync learned this the hard way with order sensitive JSON compares).
const COMPARE_KEYS = ["title", "plannedDate", "assigneeEmail", "accUrl", "discipline", "notes"];
export function reconcileSignature(o) {
  const src = o || {};
  return JSON.stringify(COMPARE_KEYS.reduce((a, k) => { a[k] = src[k] == null ? null : String(src[k]); return a; }, {}));
}

// Default projection from an existing activity row to the comparable shape. Overridable via
// opts.fromActivity so the caller can match its own column names without editing this file.
function defaultFromActivity(a) {
  return {
    title:         a.desc != null ? a.desc : (a.title != null ? a.title : null),
    plannedDate:   a.witness_at || a.witnessAt || null,
    assigneeEmail: (a.assignee_email || a.assigneeEmail || "") ? String(a.assignee_email || a.assigneeEmail).toLowerCase() : null,
    accUrl:        a.acc_url || a.accUrl || null,
    discipline:    a.discipline || null,
    notes:         a.notes || null,
  };
}

// The core diff. Keyed on FOK reference.
//   registerRows: output of parseFokRegister
//   activities:   existing board activities that carry a fok_ref
//   opts.fromActivity(a): optional projection to the comparable shape
// Returns a structured, side effect free plan. The caller applies it; this only decides it.
export function reconcileFok(registerRows, activities, opts) {
  opts = opts || {};
  const fromActivity = opts.fromActivity || defaultFromActivity;
  const regList = registerRows || [];
  const acts = activities || [];

  const byRef = new Map();
  for (const a of acts) {
    const ref = a.fok_ref || a.fokRef;
    if (ref) byRef.set(String(ref), a);
  }
  const seen = new Set();

  const toAdd = [];
  const toUpdate = [];
  const invitesPending = [];
  let unchanged = 0;

  for (const row of regList) {
    const ref = String(row.fokRef);
    seen.add(ref);
    const intended = {
      title: row.title, plannedDate: row.plannedDate, assigneeEmail: row.assigneeEmail,
      accUrl: row.accUrl, discipline: row.discipline, notes: row.notes,
    };
    const existing = byRef.get(ref);
    if (!existing) {
      toAdd.push({ fokRef: ref, ...intended });
      if (row.assigneeEmail) invitesPending.push({ fokRef: ref, action: "create", to: [row.assigneeEmail], status: "pending" });
      continue;
    }
    const before = fromActivity(existing);
    if (reconcileSignature(before) === reconcileSignature(intended)) { unchanged++; continue; }
    const changes = {};
    for (const k of COMPARE_KEYS) {
      const b = before[k] == null ? null : String(before[k]);
      const n = intended[k] == null ? null : String(intended[k]);
      if (b !== n) changes[k] = { from: before[k] == null ? null : before[k], to: intended[k] == null ? null : intended[k] };
    }
    toUpdate.push({ id: existing.id, fokRef: ref, changes });
    // Only refresh the invite when something a witness would care about moved.
    if (changes.plannedDate || changes.assigneeEmail) {
      const to = row.assigneeEmail ? [row.assigneeEmail] : [];
      invitesPending.push({ fokRef: ref, action: "update", to, status: "pending" });
    }
  }

  // Rows that fell out of the register. Candidates only. Never deleted here.
  const removedCandidates = [];
  for (const [ref, a] of byRef) {
    if (!seen.has(ref)) removedCandidates.push({ id: a.id, fokRef: ref });
  }

  return {
    toAdd,
    toUpdate,
    removedCandidates,
    invitesPending,
    unchanged,
    summary: {
      added: toAdd.length,
      changed: toUpdate.length,
      removedCandidates: removedCandidates.length,
      unchanged,
      invitesPending: invitesPending.length,
    },
  };
}

// --- REV165: Benchmarks page status derivation ------------------------------
// The Benchmarks page shows each synced register row against the board. Status is pure:
//   removed  -> the ref dropped out of the latest ACC register (present === false)
//   no_date  -> synced but the register carries no date, so it cannot be sent
//   ready    -> dated and not yet on the board (a Send to Board candidate)
//   changed  -> on the board, but the ACC date or assignee has since moved (resend to update)
//   on_board -> on the board and matching ACC
function benchDate(v) { return v ? String(v).slice(0, 10) : null; }
function benchEmail(v) { return v ? String(v).toLowerCase() : null; }

export function benchmarkStatus(benchmark, activity) {
  const b = benchmark || {};
  if (b.present === false) return "removed";
  // REV197: a finished board activity makes its benchmark Completed, and completion
  // wins over a missing date; a done FOK is done regardless of register hygiene.
  if (activity && activity.status === "complete") return "completed";
  if (!b.planned_date) return "no_date";
  if (!activity) return "ready";
  const dateMoved = benchDate(b.planned_date) !== benchDate(activity.witness_at || activity.witnessAt || activity.planned_date);
  const assigneeMoved = benchEmail(b.assignee_email) !== benchEmail(activity.assignee_email || activity.assigneeEmail);
  return (dateMoved || assigneeMoved) ? "changed" : "on_board";
}

// Attach status to each benchmark by matching it to its board activity: stored link first,
// then fok_ref, then an exact normalised title match so a FOK already on the board without a
// ref is still detected (prevents duplicates on Send to Board). Exposes the matched code.
export function benchmarksWithStatus(benchmarks, activities) {
  const list = benchmarks || [];
  const acts = activities || [];
  const byId = new Map(acts.map((a) => [a.id, a]));
  const byRef = new Map();
  const byTitle = new Map();
  for (const a of acts) {
    const r = a.fok_ref || a.fokRef; if (r) byRef.set(String(r), a);
    const t = normKey(a.desc || a.descr || ""); if (t && !byTitle.has(t)) byTitle.set(t, a);
  }
  const rows = list.map((b) => {
    const act = (b.board_activity_id && byId.get(b.board_activity_id))
      || byRef.get(String(b.fok_ref))
      || byTitle.get(normKey(b.title || ""))
      || null;
    return { ...b, status: benchmarkStatus(b, act), activityId: act ? act.id : null, activityCode: act && act.code != null ? act.code : null };
  });
  const summary = rows.reduce((s, r) => { s[r.status] = (s[r.status] || 0) + 1; return s; }, {});
  summary.sendable = rows.filter((r) => r.status === "ready" || r.status === "changed").length;
  return { rows, summary };
}
