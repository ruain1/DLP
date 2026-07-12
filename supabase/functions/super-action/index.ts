// Captured verbatim from the live Supabase deployment on 2026-07-12 (dashboard Code tab).
// The repo previously held no copy of this function; this file is the deployable truth.
// Known follow-up: this function performs NO caller verification (no getUser, no role
// check). Anyone holding the public anon key can invoke it and spend Anthropic API
// credits. A future REV should add a session gate like admin-users before doing work.
// Supabase Edge Function (the app invokes the slug "super-action")
// Rewrites the deterministic weekly-report summary into cleaner prose, and
// (REV194) writes short per-section narratives from supplied fact blocks.
//
// This is YOUR deployed function, unchanged, with one additive branch marked
// REV194: when the body carries mode:"section", it narrates the given facts
// instead of polishing a draft. The polish path, CORS handling, model default,
// dash rule and error keys are exactly as you had them. Both paths obey the
// same absolute rule: nothing may appear that is not in the source text, and
// the client independently rejects any output whose figures drift.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("REPORT_NARRATIVE_MODEL") || "claude-sonnet-4-6";

// Reflect whatever headers the browser asks for in its preflight, so CORS can never mismatch.
function corsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      req.headers.get("Access-Control-Request-Headers") ||
      "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
    "Access-Control-Max-Age": "86400",
  };
}

const SYSTEM = [
  "You are an editor polishing the executive summary of a data centre commissioning project's weekly report.",
  "Rewrite the text into clear, concise, professional British English suitable for a client.",
  "Absolute rules, no exceptions:",
  "- Do not add, remove, or change any number, percentage, date, or proper noun.",
  "- Do not introduce any figure, statistic, or fact that is not already in the source text.",
  "- Keep exactly the same set of facts; only improve flow, clarity, and tone.",
  "- Do not use em dashes or en dashes. Use commas, full stops, semicolons, or hyphens.",
  "Return only the rewritten paragraph. No preamble, no markdown, no quotation marks.",
].join(" ");

// REV194: system prompt for section narratives. The facts are the entire universe;
// the model's only job is prose.
const SECTION_SYSTEM = [
  "You write one short narrative paragraph for a named section of a data centre commissioning project's weekly report.",
  "You are given a block of drafted facts. Those facts are the entire universe of what you may say.",
  "Absolute rules, no exceptions:",
  "- Two to four sentences, professional British English, suitable for a client.",
  "- Do not add, remove, or change any number, percentage, date, or proper noun.",
  "- Do not introduce any figure, activity, company, or fact that is not in the supplied facts.",
  "- Prefer naming causes and chains over listing; if the facts show pushes, lead with the driver.",
  "- Do not use em dashes or en dashes. Use commas, full stops, semicolons, or hyphens.",
  "Return only the paragraph. No preamble, no markdown, no quotation marks.",
].join(" ");

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    if (!ANTHROPIC_API_KEY) return json({ error: "no_key" });

    const body = await req.json().catch(() => ({}));

    // REV194: section narrative mode. Additive; requests without mode fall
    // through to the original polish path untouched.
    if (body && body.mode === "section") {
      const facts = typeof body.facts === "string" ? body.facts.trim() : "";
      const section = typeof body.section === "string" ? body.section.trim().slice(0, 80) : "this section";
      if (!facts) return json({ error: "no_facts" });
      const steerClean = (typeof body.steer === "string" ? body.steer.trim() : "").slice(0, 400);
      const toneClean = (typeof body.tone === "string" ? body.tone.trim() : "").slice(0, 400);
      let system = SECTION_SYSTEM;
      if (toneClean) system += ' Report-wide tone guidance, to be followed only where it does not require inventing or changing any figure, date, or name: "' + toneClean + '".';
      if (steerClean) system += ' Section guidance, same limits: "' + steerClean + '".';

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 400,
          system,
          messages: [{ role: "user", content: 'Section: "' + section + '". Write the narrative from these facts:\n\n' + facts }],
        }),
      });
      if (!r.ok) {
        const detail = (await r.text()).slice(0, 400);
        return json({ error: "api_error", detail });
      }
      const data = await r.json();
      const text = (data.content || [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("")
        .trim();
      return json({ text });
    }

    // REV157: read the optional steer alongside the draft.
    const { draft, steer } = body;
    if (!draft || typeof draft !== "string") return json({ error: "no_draft" });

    // REV157: append the author steer to the system prompt, bounded so it can
    // never justify inventing or altering a figure, date, or name.
    const steerClean = (typeof steer === "string" ? steer.trim() : "").slice(0, 400);
    const system = steerClean
      ? SYSTEM + ' Author style guidance, to be followed only where it does not require inventing or changing any figure, date, or name: "' + steerClean + '".'
      : SYSTEM;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: "Rewrite this summary:\n\n" + draft }],
      }),
    });

    if (!r.ok) {
      const detail = (await r.text()).slice(0, 400);
      return json({ error: "api_error", detail });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("")
      .trim();

    return json({ text });
  } catch (e) {
    return json({ error: "exception", detail: String((e as any)?.message || e) });
  }
});
