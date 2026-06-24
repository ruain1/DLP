import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { fetchBranding, applyBrandToTab, submitAccessRequest } from "./data";

export default function Login() {
  const [view, setView] = useState("login"); // login | request | sent
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [brand, setBrand] = useState({ projectName: "FIN04", appName: "DLP", tagline: "Collaborative Digital Planning", logoUrl: null });
  // request form
  const [req, setReq] = useState({ name: "", email: "", organisation: "", note: "", hp: "" });
  const [reqMsg, setReqMsg] = useState("");
  const [reqBusy, setReqBusy] = useState(false);

  useEffect(() => { fetchBranding().then((b) => { setBrand(b); applyBrandToTab(b); }).catch(() => {}); }, []);

  const signIn = async () => {
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setMsg(error.message);
    setBusy(false);
  };
  const reset = async () => {
    if (!email) { setMsg("Enter your email first."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setMsg(error ? error.message : "Password reset email sent.");
  };
  const sendRequest = async () => {
    setReqMsg("");
    if (req.hp) { setView("sent"); return; } // honeypot: silently treat bots as done
    if (!req.name.trim() || !req.email.trim()) { setReqMsg("Add your name and a work email."); return; }
    if (!/.+@.+\..+/.test(req.email.trim())) { setReqMsg("That email does not look right."); return; }
    setReqBusy(true);
    try { await submitAccessRequest(req); setView("sent"); setReq({ name: "", email: "", organisation: "", note: "", hp: "" }); }
    catch (e) { setReqMsg("Could not send the request. Please try again, or contact your project administrator."); }
    setReqBusy(false);
  };

  const wrap = { minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F8FA", fontFamily: "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif", color: "#16202E", padding: 24, boxSizing: "border-box" };
  const card = { width: 380, maxWidth: "100%", background: "#fff", border: "1px solid #DCE1E8", borderRadius: 16, padding: 32, boxShadow: "0 10px 40px rgba(20,32,46,.08)" };
  const input = { width: "100%", border: "1px solid #DCE1E8", borderRadius: 9, padding: "11px 13px", fontSize: 14, marginTop: 6, boxSizing: "border-box", fontFamily: "inherit", color: "#16202E" };
  const label = { fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".1em", color: "#6B7785", fontWeight: 600 };
  const btn = { width: "100%", marginTop: 18, background: "#1E5FCC", color: "#fff", border: 0, borderRadius: 9, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
  const btnSec = { width: "100%", marginTop: 10, background: "#fff", color: "#1E5FCC", border: "1px solid #1E5FCC", borderRadius: 9, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
  const btnGhost = { background: "none", border: 0, color: "#6B7785", fontSize: 12, marginTop: 12, cursor: "pointer", width: "100%" };
  const divider = { display: "flex", alignItems: "center", gap: 12, margin: "20px 0 4px", color: "#6B7785", fontSize: 11 };
  const dLine = { flex: 1, height: 1, background: "#E4E8EE" };

  const Brand = ({ title, tag }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 24 }}>
      {brand.logoUrl && <img src={brand.logoUrl} alt="" style={{ maxHeight: 64, maxWidth: 200, objectFit: "contain", marginBottom: 14 }} />}
      <div style={{ fontWeight: 700, fontSize: 21, letterSpacing: "-0.01em" }}>{title}</div>
      <div style={{ fontSize: 11, color: "#6B7785", marginTop: 5, textTransform: "uppercase", letterSpacing: ".12em" }}>{tag}</div>
    </div>
  );

  return (
    <div style={wrap}>
      {view === "login" && (
        <div style={card}>
          <Brand title={`${brand.projectName} ${brand.appName}`} tag={brand.tagline} />
          <div style={label}>Email</div>
          <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && signIn()} />
          <div style={{ ...label, marginTop: 14 }}>Password</div>
          <input style={input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && signIn()} />
          <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={signIn}>{busy ? "Signing in…" : "Sign in"}</button>
          <button style={btnGhost} onClick={reset}>Forgot password</button>
          {msg && <div style={{ marginTop: 12, fontSize: 12.5, color: msg.includes("sent") ? "#0E9384" : "#C0392B", textAlign: "center" }}>{msg}</div>}
          <div style={divider}><span style={dLine} />New to the project<span style={dLine} /></div>
          <button style={btnSec} onClick={() => { setReqMsg(""); setView("request"); }}>Request access</button>
          <div style={{ marginTop: 18, fontSize: 11, color: "#6B7785", lineHeight: 1.5, textAlign: "center" }}>Requests are reviewed by an administrator. If approved, you will get an email with a link to set your password.</div>
        </div>
      )}

      {view === "request" && (
        <div style={card}>
          <Brand title="Request access" tag={`${brand.projectName} ${brand.appName}`} />
          <div style={label}>Full name</div>
          <input style={input} type="text" value={req.name} onChange={(e) => setReq({ ...req, name: e.target.value })} />
          <div style={{ ...label, marginTop: 14 }}>Work email</div>
          <input style={input} type="email" value={req.email} onChange={(e) => setReq({ ...req, email: e.target.value })} />
          <div style={{ ...label, marginTop: 14 }}>Organisation</div>
          <input style={input} type="text" placeholder="The company you work for" value={req.organisation} onChange={(e) => setReq({ ...req, organisation: e.target.value })} />
          <div style={{ ...label, marginTop: 14 }}>Reason for access (optional)</div>
          <textarea style={{ ...input, minHeight: 74, resize: "vertical" }} value={req.note} onChange={(e) => setReq({ ...req, note: e.target.value })} />
          {/* honeypot: hidden from people, catches bots */}
          <input type="text" tabIndex={-1} autoComplete="off" value={req.hp} onChange={(e) => setReq({ ...req, hp: e.target.value })} aria-hidden="true" style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }} />
          <button style={{ ...btn, opacity: reqBusy ? 0.6 : 1 }} disabled={reqBusy} onClick={sendRequest}>{reqBusy ? "Sending…" : "Send request"}</button>
          <button style={btnGhost} onClick={() => setView("login")}>Back to sign in</button>
          {reqMsg && <div style={{ marginTop: 12, fontSize: 12.5, color: "#C0392B", textAlign: "center" }}>{reqMsg}</div>}
        </div>
      )}

      {view === "sent" && (
        <div style={card}>
          <div style={{ textAlign: "center", padding: "6px 4px" }}>
            <div style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(14,147,132,.12)", color: "#0E9384", display: "flex", alignItems: "center", justifyContent: "center", margin: "6px auto 16px" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Request sent</div>
            <div style={{ fontSize: 13.5, color: "#33485C", maxWidth: 300, margin: "0 auto" }}>An administrator will review your request. If it is approved, you will receive an email with a link to set your password.</div>
            <button style={{ ...btn, maxWidth: 200, margin: "22px auto 0" }} onClick={() => setView("login")}>Back to sign in</button>
          </div>
        </div>
      )}
    </div>
  );
}
