// multisel.jsx (REV270): the shared multi-select filter control. Filter dropdowns
// across the app convert to this in tranches; value-editor selects stay native single.
// Semantics: value is an array; empty means All (the label shows and nothing filters).
// The popover is instant-apply checkboxes with a Select all row that clears to All.
import React, { useState, useEffect, useRef } from "react";

// The one predicate every converted filter uses: empty selection passes everything.
export const inSel = (sel, v) => !sel || sel.length === 0 || sel.includes(v);

// light: for surfaces outside the app's CSS-variable scope (the hub); switches the
// fallback palette so an undefined var never leaves a dark control on a light page.
export function MultiSel({ label, options, value, onChange, minWidth, light }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const md = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const kd = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", md);
    document.addEventListener("keydown", kd);
    return () => { document.removeEventListener("mousedown", md); document.removeEventListener("keydown", kd); };
  }, [open]);

  const opts = (options || []).map((o) => (typeof o === "string" ? { v: o, t: o } : o));
  const sel = value || [];
  const tOf = (v) => { const o = opts.find((x) => x.v === v); return o ? o.t : String(v); };
  const summary = sel.length === 0 ? label : sel.length === 1 ? tOf(sel[0]) : tOf(sel[0]) + " +" + (sel.length - 1);
  const active = sel.length > 0;
  const toggle = (v) => onChange(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]);

  const T = light
    ? { card: "#ffffff", line: "#d5dbe4", line2: "#b9c2cf", ink: "#1c2733", muted: "#5f6c7b", accent: "#2456A6", shadow: "0 14px 34px rgba(23,34,52,.18)" }
    : { card: "var(--card, #141d2c)", line: "var(--line, #28354a)", line2: "var(--line2, #3b4a5e)", ink: "var(--ink, #e6edf6)", muted: "var(--muted, #8b98ab)", accent: "var(--accent, #5B9BF3)", shadow: "0 14px 34px rgba(0,0,0,.45)" };
  const C = {
    wrap: { position: "relative", display: "inline-block" },
    btn: { display: "inline-flex", alignItems: "center", gap: 8, background: T.card, border: "1px solid " + (active ? T.accent : T.line), borderRadius: 9, padding: "7px 12px", fontSize: 12.5, fontWeight: 650, color: T.ink, cursor: "pointer", minWidth: minWidth || 0, whiteSpace: "nowrap" },
    caret: { color: T.muted, fontSize: 10, lineHeight: 1 },
    pop: { position: "absolute", top: "calc(100% + 7px)", left: 0, minWidth: 200, maxHeight: 320, overflow: "auto", background: T.card, border: "1px solid " + T.line, borderRadius: 11, padding: "6px 0", boxShadow: T.shadow, zIndex: 70 },
    row: { display: "flex", gap: 9, alignItems: "center", padding: "7px 12px", cursor: "pointer", fontSize: 12.5, color: T.ink, userSelect: "none" },
    box: (on) => ({ width: 15, height: 15, borderRadius: 4, flex: "0 0 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1.5px solid " + (on ? T.accent : T.line2), background: on ? T.accent : "transparent", color: "#fff", fontSize: 10, fontWeight: 900, lineHeight: 1 }),
    div: { height: 1, background: T.line, margin: "4px 0" },
  };

  return (
    <span style={C.wrap} ref={ref}>
      <button type="button" style={C.btn} onClick={() => setOpen((v) => !v)} onFocus={(e) => { e.currentTarget.style.outline = "2px solid " + (light ? "#2456A6" : "var(--accent, #5B9BF3)"); e.currentTarget.style.outlineOffset = "2px"; }} onBlur={(e) => { e.currentTarget.style.outline = "none"; }} title={active ? sel.map(tOf).join(", ") : label}>
        {summary}<span style={C.caret}>{"\u25be"}</span>
      </button>
      {open && (
        <div style={C.pop}>
          <div style={{ ...C.row, opacity: 0.8 }} onClick={() => onChange([])}>
            <span style={C.box(false)} />Select all
          </div>
          <div style={C.div} />
          {opts.map((o) => (
            <div key={String(o.v)} style={C.row} onClick={() => toggle(o.v)}>
              <span style={C.box(sel.includes(o.v))}>{sel.includes(o.v) ? "\u2713" : ""}</span>{o.t}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}
