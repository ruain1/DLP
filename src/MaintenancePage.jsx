import React, { useEffect } from "react";

// REV364: maintenance mode holding page.
// Pure: everything it shows arrives as props; the only side effect is the optional
// reopen poll (onCheck), a fallback for the realtime path that normally restores the
// board the moment an admin ends maintenance. No reopen date or time is ever shown.
// No em or en dashes anywhere in this file.

// Shared gate predicate. App uses it in the pre-return effect and the render so the two
// can never disagree. Admins, supers and the owner (cu.role === "admin") are exempt.
export function isMaintenanceGated(meta, isAdmin) {
  return !!(meta && meta.maintenance) && !isAdmin;
}

export function fmtMaintSince(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const initials = (n) => String(n || "").trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

const CSS = `
.mt-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 16px;box-sizing:border-box}
.mt-card{width:520px;max-width:100%;background:var(--card);border:1px solid var(--line);border-radius:16px;box-shadow:0 10px 40px rgba(20,32,46,.08);overflow:hidden}
.mt-strip{height:5px;background:repeating-linear-gradient(135deg,var(--mt-amber) 0 14px,var(--mt-amberline) 14px 28px)}
.mt-body{padding:30px 32px 26px}
.mt-brand{display:flex;align-items:center;gap:12px;margin-bottom:22px}
.mt-brand img{height:40px;max-width:160px;object-fit:contain}
.mt-logo{width:40px;height:40px;border-radius:10px;background:var(--accent);color:#fff;display:grid;place-items:center;font-weight:800;font-size:13px;letter-spacing:.02em;flex:none}
.mt-brand .t{font-weight:700;font-size:15px}
.mt-brand .s{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;margin-top:2px}
.mt-h{font-size:22px;font-weight:700;letter-spacing:-.01em;margin:0 0 10px;display:flex;align-items:center;gap:10px}
.mt-p{margin:0 0 14px;color:var(--ink);font-size:14px;line-height:1.5}
.mt-msg{border-left:3px solid var(--mt-amber);background:var(--mt-amberbg);color:var(--ink);padding:10px 14px;border-radius:0 8px 8px 0;font-size:13.5px;margin:0 0 18px;white-space:pre-line;line-height:1.5}
.mt-kv{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;margin:0 0 18px}
.mt-kv .k{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:600}
.mt-kv .v{font-size:13px;margin-top:2px}
.mt-status{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--paper);font-size:12.5px;color:var(--muted);line-height:1.45}
.mt-status b{color:var(--ink);font-weight:600}
.mt-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
.mt-dot.amber{background:var(--mt-amber);animation:mtpulse 2.4s infinite}
@keyframes mtpulse{0%{box-shadow:0 0 0 0 rgba(180,83,9,.45)}70%{box-shadow:0 0 0 8px rgba(180,83,9,0)}100%{box-shadow:0 0 0 0 rgba(180,83,9,0)}}
@media (prefers-reduced-motion:reduce){.mt-dot.amber{animation:none}}
.mt-contacts{margin:18px 0 0;padding-top:16px;border-top:1px solid var(--line)}
.mt-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:600}
.mt-contacts .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.mt-contacts a,.mt-contacts span.nolink{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:4px 10px 4px 5px;font-size:12px;color:var(--ink);text-decoration:none;background:var(--card)}
.mt-contacts a:hover{background:var(--hover)}
.mt-av{width:20px;height:20px;border-radius:50%;background:var(--chipbg);color:var(--accent);font-size:9.5px;font-weight:800;display:grid;place-items:center}
.mt-foot{display:flex;gap:10px;justify-content:space-between;align-items:center;margin-top:20px;flex-wrap:wrap}
.mt-btn{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:9px;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
.mt-btn.ghost{background:none;border-color:transparent;color:var(--muted)}
.mt-btn:focus-visible{outline:2px solid var(--head);outline-offset:2px}
@media (max-width:480px){.mt-body{padding:22px 18px}.mt-kv{grid-template-columns:1fr}}
`;

export default function MaintenancePage({ brand, meta, theme, hasPortal, onPortal, onSignOut, onCheck }) {
  const dark = theme === "dark";
  const vars = dark
    ? { "--mt-amber": "#F5B85C", "--mt-amberbg": "#2A2213", "--mt-amberline": "#5C4418" }
    : { "--mt-amber": "#B45309", "--mt-amberbg": "#FFF4E0", "--mt-amberline": "#F3C98B" };
  const m = meta || {};
  const projName = (brand && brand.projectName) || m.name || m.code || "This project";
  const subline = [m.client, (brand && brand.appName) || "DLP"].filter(Boolean).join(" \u00b7 ");
  const logo = brand ? (dark ? (brand.logoDark || brand.logoUrl) : (brand.logoUrl || brand.logoDark)) : null;
  const since = fmtMaintSince(m.maintenanceSince);
  const cName = (m.maintenanceContactName || "").trim();
  const cEmail = (m.maintenanceContactEmail || "").trim();
  const firstName = cName.split(/\s+/)[0] || "";

  // Fallback reopen check: realtime normally does this within a second, but a tab that
  // missed the event should not sit on the holding page for ever. Every 60 seconds and on
  // return to the tab; onCheck decides what to reload, this component never does.
  useEffect(() => {
    if (typeof onCheck !== "function") return undefined;
    const go = () => { try { const r = onCheck(); if (r && typeof r.catch === "function") r.catch(() => {}); } catch (e) {} };
    const iv = setInterval(go, 60000);
    const onVis = () => { if (typeof document !== "undefined" && document.visibilityState === "visible") go(); };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis); };
  }, [onCheck]);

  return (
    <div className="mt-wrap" style={vars} data-testid="maintenance-page">
      <style>{CSS}</style>
      <div className="mt-card" role="status" aria-live="polite">
        <div className="mt-strip" aria-hidden="true" />
        <div className="mt-body">
          <div className="mt-brand">
            {logo ? <img src={logo} alt="" /> : <div className="mt-logo">{((brand && brand.appName) || "DLP").slice(0, 3).toUpperCase()}</div>}
            <div><div className="t">{projName}</div>{subline && <div className="s">{subline}</div>}</div>
          </div>

          <h1 className="mt-h"><span className="mt-dot amber" aria-hidden="true" />Planned maintenance in progress</h1>
          <p className="mt-p">The {projName} planning board is closed while an update is applied. Nothing you have recorded is lost; the board reopens on this page automatically.</p>

          {m.maintenanceMessage && <div className="mt-msg" data-testid="maintenance-notice">{m.maintenanceMessage}</div>}

          <div className="mt-kv">
            <div><div className="k">Closed since</div><div className="v">{since || "Just now"}</div></div>
            <div><div className="k">Reopens</div><div className="v">Until further notice</div></div>
          </div>

          <div className="mt-status">
            <span className="mt-dot" style={{ background: "var(--st-done, #15803D)" }} />
            <span><b>Watching for reopen.</b> This page checks the project status live and loads the board the moment maintenance ends. You can leave it open.</span>
          </div>

          <div className="mt-contacts">
            <div className="mt-label">{cName ? "Urgent? Contact " + firstName : "Urgent? Contact your project admin"}</div>
            {cName && <div className="row">
              {cEmail
                ? <a href={"mailto:" + cEmail} data-testid="maintenance-contact"><span className="mt-av">{initials(cName)}</span>{cName} {"\u00b7"} {cEmail}</a>
                : <span className="nolink" data-testid="maintenance-contact"><span className="mt-av">{initials(cName)}</span>{cName}</span>}
            </div>}
          </div>

          <div className="mt-foot">
            <div>{hasPortal && <button className="mt-btn" onClick={onPortal} data-testid="maintenance-portal">My projects</button>}</div>
            <button className="mt-btn ghost" onClick={onSignOut} data-testid="maintenance-signout">Sign out</button>
          </div>
        </div>
      </div>
    </div>
  );
}
