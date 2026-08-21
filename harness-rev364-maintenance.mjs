// REV364 harness: maintenance mode.
// Real assertions against the shipped modules (no string-presence checks on source).
// Run: node harness-rev364-maintenance.mjs   (needs node_modules: react, react-dom, esbuild)
import { build, transform } from "esbuild";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

let n = 0; const fails = [];
const ok = (cond, what) => { n++; if (!cond) fails.push(what); };

const dir = mkdtempSync(join(tmpdir(), "rev364-"));

// 1. MaintenancePage.jsx transformed (JSX -> JS), imported as real ESM.
const mpSrc = readFileSync(new URL("./src/MaintenancePage.jsx", import.meta.url), "utf8");
const mpOut = await transform(mpSrc, { loader: "jsx", format: "esm" });
const mpPath = join(dir, "MaintenancePage.mjs");
writeFileSync(mpPath, mpOut.code.replace(/from "react"/g, 'from "' + pathToFileURL(new URL("./node_modules/react/index.js", import.meta.url).pathname).href + '"'));
const MP = await import(pathToFileURL(mpPath).href);
const { default: MaintenancePage, isMaintenanceGated, fmtMaintSince } = MP;

// 2. data.js bundled with the Supabase client stubbed, so maintenanceFrom is the shipped mapper.
const stubPath = join(dir, "supabaseClient.js");
writeFileSync(stubPath, "export const supabase = { from() { throw new Error('not in harness'); }, rpc() { throw new Error('not in harness'); } };");
const dataOut = await build({
  entryPoints: [new URL("./src/data.js", import.meta.url).pathname],
  bundle: true, write: false, format: "esm", platform: "node",
  plugins: [{ name: "stub", setup(b) { b.onResolve({ filter: /^\.\/supabaseClient$/ }, () => ({ path: stubPath })); } }],
});
const dataPath = join(dir, "data.mjs");
writeFileSync(dataPath, dataOut.outputFiles[0].text);
const { maintenanceFrom } = await import(pathToFileURL(dataPath).href);

// 3. errorCatalog is plain ESM already.
const { catalogErr } = await import(new URL("./src/errorCatalog.js", import.meta.url).href);

// ---- gate predicate ----
ok(isMaintenanceGated({ maintenance: true }, false) === true, "member on maintenance project is gated");
ok(isMaintenanceGated({ maintenance: true }, true) === false, "admin is exempt");
ok(isMaintenanceGated({ maintenance: false }, false) === false, "maintenance off: not gated");
ok(isMaintenanceGated(null, false) === false, "missing meta: not gated (fail open, never locks out)");
ok(isMaintenanceGated(undefined, false) === false, "undefined meta: not gated");

// ---- mapper ----
const row = { maintenance: true, maintenance_message: " m ", maintenance_since: "2026-08-21T14:30:00Z", maintenance_by: "u1", maintenance_contact_name: "Ruain Burrows", maintenance_contact_email: "ruain.b@cs-nordics.com" };
const m = maintenanceFrom(row);
ok(m.maintenance === true && m.maintenanceMessage === " m " && m.maintenanceSince === row.maintenance_since && m.maintenanceBy === "u1", "mapper carries the five columns");
ok(m.maintenanceContactName === "Ruain Burrows" && m.maintenanceContactEmail === "ruain.b@cs-nordics.com", "mapper carries contact");
const m0 = maintenanceFrom({});
ok(m0.maintenance === false && m0.maintenanceMessage === "" && m0.maintenanceSince === null && m0.maintenanceContactName === "" && m0.maintenanceContactEmail === "", "mapper defaults on a row without the columns");
ok(maintenanceFrom(null).maintenance === false, "mapper tolerates null");
ok(!Object.keys(m).some((k) => /eta|expected/i.test(k)), "no ETA field exists on the mapped shape");

// ---- since formatter ----
ok(fmtMaintSince("") === "" && fmtMaintSince(null) === "" && fmtMaintSince("garbage") === "", "since formatter is empty on bad input");
ok(/2026/.test(fmtMaintSince("2026-08-21T14:30:00Z")), "since formatter renders a real date");

// ---- holding page render: full case ----
const brand = { projectName: "FIN04 Koski", appName: "DLP", logoUrl: null, logoDark: null };
const meta = { code: "FIN04", name: "FIN04 Koski", client: "atnorth", location: "Koski", ...m, maintenanceMessage: "All scheduled witness invites are cancelled until further notice." };
const html = renderToStaticMarkup(React.createElement(MaintenancePage, { brand, meta, theme: "light", hasPortal: true, onPortal: () => {}, onSignOut: () => {}, onCheck: null }));
ok(html.includes("Planned maintenance in progress"), "headline present");
ok(html.includes("All scheduled witness invites are cancelled until further notice."), "notice rendered verbatim");
ok(html.includes('href="mailto:ruain.b@cs-nordics.com"'), "contact is a mailto link");
ok(html.includes("Urgent? Contact Ruain"), "contact label uses the first name");
ok(html.includes("Until further notice") && html.includes("Closed since"), "reopens reads until further notice, closed since shown");
ok(!/expected back|estimate|ETA/i.test(html), "no reopen date, estimate or ETA anywhere");
ok(html.includes('data-testid="maintenance-portal"'), "My projects shown when the user has a portal");
ok(html.includes('data-testid="maintenance-signout"'), "sign out present");
ok(html.includes("FIN04 Koski") && html.includes("atnorth"), "brand and client shown");
ok(!/[\u2013\u2014]/.test(html), "no em or en dash in rendered output");

// ---- single-project member: no portal button ----
const html1 = renderToStaticMarkup(React.createElement(MaintenancePage, { brand, meta, theme: "dark", hasPortal: false, onPortal: () => {}, onSignOut: () => {} }));
ok(!html1.includes('data-testid="maintenance-portal"'), "My projects hidden for single-project members");
ok(html1.includes('data-testid="maintenance-signout"'), "sign out still present");

// ---- no contact configured ----
const html2 = renderToStaticMarkup(React.createElement(MaintenancePage, { brand, meta: { ...meta, maintenanceContactName: "", maintenanceContactEmail: "" }, theme: "light", hasPortal: false }));
ok(html2.includes("Contact your project admin") && !html2.includes("mailto:"), "no contact: generic label, no link");

// ---- contact without email ----
const html3 = renderToStaticMarkup(React.createElement(MaintenancePage, { brand, meta: { ...meta, maintenanceContactEmail: "" }, theme: "light", hasPortal: false }));
ok(html3.includes("Ruain Burrows") && !html3.includes("mailto:") && html3.includes('class="nolink"'), "contact without email renders as plain chip");

// ---- no notice: block omitted ----
const html4 = renderToStaticMarkup(React.createElement(MaintenancePage, { brand, meta: { ...meta, maintenanceMessage: "" }, theme: "light", hasPortal: false }));
ok(!html4.includes('data-testid="maintenance-notice"'), "empty notice omits the notice block");

// ---- brand logo path ----
const html5 = renderToStaticMarkup(React.createElement(MaintenancePage, { brand: { ...brand, logoUrl: "https://x/logo.png" }, meta, theme: "light", hasPortal: false }));
ok(html5.includes('src="https://x/logo.png"'), "brand logo used when present");

// ---- error catalogue ----
const c1 = catalogErr("DLP_MAINTENANCE: FIN04 is closed for maintenance. Changes are not accepted until it reopens.");
ok(c1.kind === "maint" && /closed for maintenance/i.test(c1.plain) && /not saved/i.test(c1.plain), "trigger error maps to plain language");
const c2 = catalogErr("DLP_FORBIDDEN: only project admins can change maintenance mode");
ok(c2.kind === "guard" && /project admins/i.test(c2.plain), "RPC forbidden maps to plain language");
ok(catalogErr("something else").kind === "raw", "unrelated errors untouched");

console.log(n + " assertions, " + fails.length + " failed");
for (const f of fails) console.log("  FAIL: " + f);
process.exit(fails.length ? 1 : 0);
