// REV144: report_runs claim resilience.
//
// The digest claim is a single table insert into report_runs. A transient
// transport failure (the browser's "TypeError: Failed to fetch", a cold or
// briefly unreachable Supabase, a momentary network drop) used to fall straight
// into the fatal branch, abort the whole digest, and show a red "Digest claim
// failed" toast that reads like a data problem when it is really a connectivity
// blip. This module retries transport errors a few times with a short backoff,
// and never retries a deterministic error: a duplicate claim from another tab
// (23505) or an RLS block must surface unchanged so the caller can adopt the
// existing claim or show the real reason.
//
// Returns one of:
//   { id }                 claim taken, id is the report_runs row id
//   { duplicate: true, error }  a row already exists for this kind and date
//   { error, transport? }  claim failed; transport true means it never reached
//                          the database (retry-on-next-tick territory)

export function isTransportError(e) {
  if (!e) return false;
  const m = String((e && e.message) || e || "");
  if (/failed to fetch|networkerror|network error|load failed|fetch failed|err_network|err_connection|typeerror: (failed|network)/i.test(m)) return true;
  // supabase-js wraps a transport failure with an empty PostgREST code and a
  // fetch-flavoured message; a real query error carries a code or SQLSTATE.
  const code = e.code == null ? "" : String(e.code);
  return code === "" && /fetch|network/i.test(m);
}

export function isDuplicateError(e) {
  if (!e) return false;
  return String(e.code) === "23505" || /duplicate|unique/i.test(String((e && e.message) || ""));
}

export async function claimReportRun(supabase, kind, runDate, opts) {
  const attempts = (opts && opts.attempts) || 3;
  const backoff = (opts && opts.backoff) || 400;
  const sleep = (opts && opts.sleep) || ((ms) => new Promise((r) => setTimeout(r, ms)));
  let last = null;
  for (let i = 0; i < attempts; i++) {
    let res;
    try {
      res = await supabase.from("report_runs").insert({ kind, run_date: runDate, status: "sending", recipients: 0 }).select("id").single();
    } catch (thrown) {
      // some supabase-js builds throw on a network failure rather than returning
      // an error object; normalise so the classifier below still works.
      res = { data: null, error: { message: String((thrown && thrown.message) || thrown), code: "" } };
    }
    if (!res.error) return { id: res.data.id };
    last = res.error;
    if (isDuplicateError(res.error)) return { duplicate: true, error: res.error };
    if (!isTransportError(res.error)) return { error: res.error };
    if (i < attempts - 1) await sleep(backoff * (i + 1));
  }
  return { error: last, transport: true };
}
