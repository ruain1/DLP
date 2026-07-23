// REV334: pure error catalogue. Turns raw database and network failures into a plain
// language line a member can act on, keyed on recognisable message shapes. Trigger
// messages written since REV330 are already human-readable and pass through as-is.
// Unknown shapes fall back to the raw text so nothing is ever hidden.
// No em or en dashes anywhere in this file.

export function catalogErr(raw) {
  const t = String(raw || "");
  if (/^(This activity|Not allowed:|Commit or uncommit|Progress on this activity)/.test(t)) return { kind: "guard", plain: t };
  if (/row-level security/i.test(t)) return { kind: "rls", plain: "The database refused this change: your account does not have permission for it on this activity. If you believe you should, press Report to admin so it can be put right." };
  if (/duplicate key/i.test(t)) return { kind: "dup", plain: "This record already exists; the duplicate was blocked. Refresh to see the current state." };
  if (/(failed to fetch|networkerror|network request failed|err_network|load failed\.)/i.test(t)) return { kind: "net", plain: "Could not reach the database. Check your connection; the app retries automatically when you save again." };
  if (/(jwt|token|expired|session)/i.test(t)) return { kind: "auth", plain: "Your session needs a refresh. Sign out and back in, then retry." };
  return { kind: "raw", plain: t };
}

export function erRef(n) {
  return "ER-" + String(n == null ? 0 : n).padStart(4, "0");
}
