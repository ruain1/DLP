// Captured verbatim from the live Supabase deployment on 2026-07-12 (dashboard Code tab).
// The repo previously held no copy of this function; this file is the deployable truth.
// REV280: caller gate added. The function now requires a valid signed-in user (the
// same Authorization-header pattern admin-users uses); anonymous callers holding only
// the public anon key are rejected with 401 before any Anthropic call is made. The app
// invokes this via supabase.functions.invoke, which attaches the session token, so
// legitimate weekly and morning narratives pass unchanged.
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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
  "- Two to four sentences by default, professional British English, suitable for a client. If the section guidance asks for bullet points or a list, produce short bullet lines instead, one point per line, each starting with a dash.",
  "- Do not add, remove, or change any number, percentage, date, or proper noun.",
  "- Do not introduce any figure, activity, company, or fact that is not in the supplied facts.",
  "- Prefer naming causes and chains over listing; if the facts show pushes, lead with the driver.",
  "- Do not use em dashes or en dashes. Use commas, full stops, semicolons, or hyphens.",
  "Return only the summary. No preamble, no quotation marks. Do not use markdown headings or emphasis; simple dash bullet lines are allowed when asked for.",
].join(" ");

// REV300: the Morning Cx Update is a fast, scannable field brief, not a client narrative.
// It gets its own system prompt: the author's instruction leads and the model is free to
// choose structure (bullets by default), within the same hard factual limits.
const MORNING_SYSTEM = [
  "You write the executive summary at the top of a data centre commissioning team's Morning Cx Update email.",
  "It is read fast on a phone on site at the start of the day. It exists to tell the team what to act on today. Actionability and scannability beat prose.",
  "You are given a block of drafted facts. Those facts are the entire universe of what you may say.",
  "Write five to seven bullet lines, never more than eight. Each bullet is one line and one idea: a single action to take today or the single fact that forces it. Keep each bullet to about one sentence, roughly fifteen to twenty five words; do not stack multiple activities or clauses into one bullet. Lead each bullet with the action or the owner who must act (for example: chase, resolve, confirm, push, escalate). Order by priority: critical path blockers first, then today's commitments, then approaching risks. Every bullet starts with a dash and a space. Only write flowing paragraphs instead if the author's instruction explicitly asks for prose.",
  "The author's instruction below is the primary guide to tone, emphasis, and format. Follow it. If it asks for bullets, use bullets; if it asks for something specific, do that.",
  "Absolute limits, no exceptions:",
  "- Do not add, remove, or change any number, percentage, date, or proper noun.",
  "- Do not introduce any figure, activity, company, or fact that is not in the supplied facts.",
  "- Do not use markdown (no #, no **bold**, no backticks). Plain text with simple dash bullets only.",
  "- Do not use em dashes or en dashes. Use commas, full stops, semicolons, colons, parentheses, or hyphens.",
  "Return only the summary itself. No preamble, no sign-off, no quotation marks.",
].join(" ");

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    if (!ANTHROPIC_API_KEY) return json({ error: "no_key" });

    const body = await req.json().catch(() => ({}));

    // REV280: caller gate. Require a real signed-in user before spending API credits.
    // The app attaches the session token automatically via functions.invoke; a caller
    // with only the public anon key has no user and is rejected here.
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anon) return json({ error: "no_auth_config" }, 500);
    const authHeader = req.headers.get("Authorization") || "";
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "not_signed_in" }, 401);

    // REV194: section narrative mode. Additive; requests without mode fall
    // through to the original polish path untouched.
    if (body && body.mode === "morning") {
      const facts = typeof body.facts === "string" ? body.facts.trim() : "";
      if (!facts) return json({ error: "no_facts" });
      const steerClean = (typeof body.steer === "string" ? body.steer.trim() : "").slice(0, 400);
      let system = MORNING_SYSTEM;
      if (steerClean) system += ' Author instruction, primary guide (never invents or changes a figure, date, or name): "' + steerClean + '".';
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 900,
          system,
          messages: [{ role: "user", content: "Write the morning summary from these facts:\n\n" + facts }],
        }),
      });
      if (!r.ok) { const detail = (await r.text()).slice(0, 400); return json({ error: "api_error", detail }); }
      const data = await r.json();
      const text = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
      return json({ text });
    }

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
