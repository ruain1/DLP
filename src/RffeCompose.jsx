// REV134: RFFE compose modal. Opened from the energisation notification feed for one
// asset or several combined. Recipients, subject and body are fixed by the agreed rules;
// the user reviews, downloads the PDF if they want, and sends. Nothing auto-sends.
import React, { useState, useEffect } from "react";
import { buildRffePdf, downloadRffePdf } from "./rffePdf";
import { setAssetEventState, projName } from "./data";

const RFFE_TO = [
  "andreas.bjornstad@veloxelectro-nordics.com",
  "szymon.wieczorek@veloxelectro-nordics.com",
  "Robert.Targosz@veloxelectro-nordics.com",
  "konrad.kroc@veloxelectro-nordics.com",
];
const RFFE_GROUP = "sap.vantaa@veloxelectro-nordics.com";
const RFFE_CC = [
  "karolina.d@cs-nordics.com",
  "damian.c@cs-nordics.com",
  "mark.r@cs-nordics.com",
  "christopher.j@cts-nordics.com",
  "mark.he@cts-nordics.com",
];

const CSS = `
.rffe-modal{width:100%;max-width:760px;max-height:90vh;display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.5);overflow:hidden}
.rffe-head{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line)}
.rffe-head h3{margin:0;font-size:15.5px;color:var(--head)}
.rffe-head .lk-btn{margin-left:auto}
.rffe-body{padding:14px 18px;overflow:auto}
.rffe-f{margin-bottom:12px}
.rffe-f>label{display:block;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}
.rffe-pills{display:flex;flex-wrap:wrap;gap:6px}
.rffe-pill{background:var(--chipbg);border:1px solid var(--line);color:var(--ink);font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px}
.rffe-pill.cc{opacity:.85}
.rffe-pill.grp{border-style:dashed}
.rffe-chk{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11.5px;color:var(--ink);font-weight:500}
.rffe-subj{font-size:13px;font-weight:700;color:var(--ink);background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:8px 11px}
.rffe-preview{background:#eef1f5;border:1px solid var(--line);border-radius:10px;padding:14px;overflow:auto;max-height:340px}
.rffe-att{font-size:12.5px;font-weight:700;color:var(--ink);background:var(--chipbg);border:1px solid var(--line);border-radius:8px;padding:7px 11px;display:inline-block}
.rffe-note{font-size:11px;color:var(--muted);margin-top:6px}
.rffe-msg{margin-top:10px;font-size:12px;font-weight:700;border-radius:8px;padding:8px 11px}
.rffe-msg.ok{background:rgba(24,182,155,.12);color:#0f8a76;border:1px solid rgba(24,182,155,.5)}
.rffe-msg.err{background:rgba(226,86,78,.12);color:#c0392b;border:1px solid rgba(226,86,78,.5)}
.rffe-foot{display:flex;align-items:center;gap:9px;padding:12px 18px;border-top:1px solid var(--line);background:var(--card2)}
`;

export default function RffeCompose({ events, projectId, olAcct, organiser, onClose, onSent, onConnect }) {
  const list = events || [];
  const [includeGroup, setIncludeGroup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (!list.length) return null;

  const assets = list.map((e) => ({ name: e.asset_name || e.asset_tag, tag: e.asset_tag }));
  const multi = assets.length > 1;
  const subject = multi ? projName() + " - RFFE - " + assets[0].tag + " + " + (assets.length - 1) + " more" : projName() + " - RFFE " + assets[0].tag;
  const origin = (typeof window !== "undefined" && window.location && window.location.origin) ? window.location.origin : "";
  const base = origin + "/?p=" + encodeURIComponent(projectId || "");
  const appUrl = multi ? base + "&page=assets" : base + "&page=assets&asset=" + encodeURIComponent(assets[0].tag);
  const [html, setHtml] = useState("");
  useEffect(() => {
    let live = true;
    // outlook.js carries msal; import it lazily so the RFFE modal does not drag msal into
    // the initial bundle. buildRffeEmailHtml itself is pure.
    import("./outlook").then((m) => { if (live) setHtml(m.buildRffeEmailHtml({ assets, organiser, appUrl })); }).catch(() => {});
    return () => { live = false; };
  }, [events, projectId, organiser]);
  const to = includeGroup ? RFFE_TO.concat(RFFE_GROUP) : RFFE_TO.slice();
  const pdfName = multi ? projName() + " RFFE - " + assets.length + " assets.pdf" : "RFFE " + assets[0].tag + ".pdf";

  const download = async () => {
    try { await downloadRffePdf(assets, pdfName); }
    catch (e) { setMsg({ ok: false, t: "PDF failed: " + (e && e.message ? e.message : e) }); }
  };
  const send = async () => {
    if (!olAcct) { setMsg({ ok: false, t: "Connect Outlook first." }); return; }
    setBusy(true); setMsg(null);
    try {
      const att = await buildRffePdf(assets, pdfName);
      const ol = await import("./outlook");
      await ol.sendMailMessage({ subject, html, to, cc: RFFE_CC, attachments: [att] });
      for (const e of list) { await setAssetEventState(e.id, "rffe_sent"); }
      setMsg({ ok: true, t: "RFFE sent from " + olAcct + " to " + to.length + " recipients." });
      if (onSent) onSent();
      setTimeout(() => { if (onClose) onClose(); }, 1000);
    } catch (e) { setMsg({ ok: false, t: "Send failed: " + (e && e.message ? e.message : e) }); }
    setBusy(false);
  };
  const testToMe = async () => {
    // REV135: send the exact RFFE, PDF and all, to yourself only. No Velox, no Cc, no state
    // change on the event. Lets you eyeball it in your real inbox before the real send.
    if (!olAcct) { setMsg({ ok: false, t: "Connect Outlook first." }); return; }
    setBusy(true); setMsg(null);
    try {
      const att = await buildRffePdf(assets, pdfName);
      const ol = await import("./outlook");
      await ol.sendMailMessage({ subject: "[TEST] " + subject, html, to: [olAcct], attachments: [att] });
      setMsg({ ok: true, t: "Test copy sent to " + olAcct + ". Nothing went to Velox and no status changed." });
    } catch (e) { setMsg({ ok: false, t: "Test failed: " + (e && e.message ? e.message : e) }); }
    setBusy(false);
  };

  return <div className="lk-modal-bg" onClick={onClose}>
    <style>{CSS}</style>
    <div className="rffe-modal" onClick={(e) => e.stopPropagation()}>
      <div className="rffe-head"><h3>Request For Energisation{multi ? " - " + assets.length + " assets" : ""}</h3><button className="lk-btn icon" onClick={onClose}>{"\u2715"}</button></div>
      <div className="rffe-body">
        <div className="rffe-f"><label>To - Velox SAP</label>
          <div className="rffe-pills">{RFFE_TO.map((a) => <span key={a} className="rffe-pill">{a.split("@")[0]}</span>)}{includeGroup && <span className="rffe-pill grp">{RFFE_GROUP.split("@")[0]} (group)</span>}</div>
          <label className="rffe-chk"><input type="checkbox" checked={includeGroup} onChange={(e) => setIncludeGroup(e.target.checked)} /> Include the group mailbox {RFFE_GROUP}</label>
        </div>
        <div className="rffe-f"><label>Cc, always copied</label><div className="rffe-pills">{RFFE_CC.map((a) => <span key={a} className="rffe-pill cc">{a.split("@")[0]}</span>)}</div></div>
        <div className="rffe-f"><label>Subject</label><div className="rffe-subj">{subject}</div></div>
        <div className="rffe-f"><label>Email preview</label><div className="rffe-preview">{html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <div style={{ color: "var(--muted)", fontSize: 12 }}>Preparing preview...</div>}</div></div>
        <div className="rffe-f"><label>Attachment</label><div className="rffe-att">{pdfName}</div><div className="rffe-note">The Registration Form For Energisation rides as a PDF. SJA and supporting docs are handled outside DLP.</div></div>
        {msg && <div className={"rffe-msg " + (msg.ok ? "ok" : "err")}>{msg.t}</div>}
      </div>
      <div className="rffe-foot">
        {!olAcct && <button className="lk-btn" onClick={onConnect}>Connect Outlook</button>}
        <span style={{ flex: 1 }} />
        <button className="lk-btn" disabled={busy || !olAcct} title={!olAcct ? "Connect Outlook first" : "Send this exact RFFE to yourself only"} onClick={testToMe}>Test To Me</button>
        <button className="lk-btn" onClick={download}>Download PDF</button>
        <button className="lk-btn primary" disabled={busy || !olAcct} onClick={send}>{busy ? "Sending..." : "Send RFFE"}</button>
      </div>
    </div>
  </div>;
}
