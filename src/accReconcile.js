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
  fokRef:        ["fok register id", "register id", "fok id", "fok ref", "ref", "id"],
  discipline:    ["discipline", "trade"],
  title:         ["activity", "title", "description", "fok description", "activity name"],
  plannedDate:   ["date", "planned date", "fok date", "forecast", "forecast date", "witness date"],
  assigneeEmail: ["assignee email", "assignee", "email", "responsible", "responsible email"],
  accUrl:        ["acc link", "acc", "link", "report", "acc url"],
  notes:         ["notes", "comments", "remarks", "comment"],
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
  return idx;
}

// rows: 2D array of cell values, first row is the header. Returns clean register objects.
// A row with no FOK reference is skipped (blank spacer rows, totals, etc).
export function parseFokRegister(rows) {
  if (!rows || !rows.length) return [];
  const idx = mapFokHeaders(rows[0]);
  if (idx.fokRef === -1) throw new Error("FOK register has no recognisable reference column. Headers seen: " + (rows[0] || []).join(", "));
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const at = (f) => (idx[f] === -1 ? "" : norm(row[idx[f]]));
    const fokRef = at("fokRef");
    if (!fokRef) continue;
    out.push({
      fokRef,
      discipline:    at("discipline") || null,
      title:         at("title") || null,
      plannedDate:   at("plannedDate") || null,
      assigneeEmail: (at("assigneeEmail") || "").toLowerCase() || null,
      accUrl:        at("accUrl") || null,
      notes:         at("notes") || null,
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
