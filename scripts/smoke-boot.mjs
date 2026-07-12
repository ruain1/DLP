// REV271: the boot smoke. Boots the bundled App in jsdom with a fake session and the
// data-layer double, and asserts the three frames tonight's crashes lived in:
// module evaluation, the booting frame, and the booting-to-Portal transition.
import { JSDOM } from "jsdom";
import { readFileSync } from "fs";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "https://localhost/?p=smoke-proj", pretendToBeVisual: true });
const w = dom.window;
global.window = w; global.document = w.document;
Object.defineProperty(global, "navigator", { value: w.navigator, configurable: true });
for (const k of ["localStorage", "HTMLElement", "Element", "Node", "CustomEvent", "Event", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "location", "history"]) global[k] = w[k];
w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {} }));
global.matchMedia = w.matchMedia;
class RO { observe() {} unobserve() {} disconnect() {} }
w.ResizeObserver = RO; global.ResizeObserver = RO;
w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }; global.IntersectionObserver = w.IntersectionObserver;
w.scrollTo = () => {}; global.scrollTo = w.scrollTo;
global.fetch = () => Promise.reject(new Error("smoke: network disabled"));
w.fetch = global.fetch;

process.on("uncaughtException", (e) => { console.error("SMOKE FAIL (uncaught):", e && e.message); process.exit(1); });
process.on("unhandledRejection", (e) => { console.error("SMOKE FAIL (rejection):", e && e.message); process.exit(1); });
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { console.error("SMOKE FAIL:", m); process.exit(1); };

// 1) module evaluation + mount (the TDZ class dies here)
try { await import("./smoke-bundle.cjs"); } catch (e) { fail("bundle evaluation threw: " + (e && e.stack || e)); }
await tick(30);
const html1 = document.getElementById("root").innerHTML;
if (!html1 || html1.length < 10) fail("nothing rendered on first frame");
if (!/loading/i.test(html1)) console.warn("smoke note: booting frame lacks Loading text (layout change?), continuing");
console.log("frame 1 (booting) rendered,", html1.length, "chars");

// 2) the transition: loadProjects resolves -> Portal (the hook-count class dies here)
await tick(250);
const errs = window.__SMOKE_ERRORS || [];
if (errs.length) fail("errors during transition: " + errs.join(" | "));
const html2 = document.getElementById("root").innerHTML;
if (!html2 || html2.length < 10) fail("blank after transition (white page class)");
if (!/QMC|portal|project/i.test(html2)) console.warn("smoke note: Portal marker not found, dumping first 300 chars:\n" + html2.slice(0, 300));
console.log("frame 2 (portal) rendered,", html2.length, "chars, 0 errors");
// 3) the full board frame, past every early return (the hook-count class dies here)
await tick(350);
const errs3 = window.__SMOKE_ERRORS || [];
if (errs3.length) fail("errors reaching the board frame: " + errs3.join(" | "));
const html3 = document.getElementById("root").innerHTML;
if (!html3 || html3.length < 10) fail("blank board frame");
if (!/lk-rail/.test(html3)) fail("board frame lacks the rail; early returns not passed. First 300 chars:\n" + html3.slice(0, 300));
console.log("frame 3 (board) rendered,", html3.length, "chars, rail present, 0 errors");
console.log("BOOT SMOKE PASS");
process.exit(0);
