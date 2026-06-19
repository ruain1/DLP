import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { fetchBranding, applyBrandToTab, claimInvite } from "./data";

// Onboarding page reached from an invite link (?token=...). The person sets their
// own password and is signed straight in. No temporary password involved.
export default function SetupAccount({ token, onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [brand, setBrand] = useState({ projectName: "FIN04", appName: "DLP", tagline: "Collaborative Digital Planning", logoUrl: null });

  useEffect(() => { fetchBranding().then((b) => { setBrand(b); applyBrandToTab(b); }).catch(() => {}); }, []);

  const save = async () => {
    if (pw.length < 8) { setMsg("Use at least 8 characters."); return; }
    if (pw !== pw2) { setMsg("Passwords do not match."); return; }
    setBusy(true); setMsg("");
    try {
      const res = await claimInvite(token, pw);
      if (res && res.email) {
        const { error } = await supabase.auth.signInWithPassword({ email: res.email, password: pw });
        if (error) {
          setBusy(false);
          setMsg("Your password is set. Please go to the sign-in page and log in.");
          try { history.replaceState(null, "", window.location.pathname); } catch (e) {}
          setTimeout(onDone, 1500);
          return;
        }
      }
      try { history.replaceState(null, "", window.location.pathname); } catch (e) {}
      setBusy(false);
      onDone();
    } catch (e) {
      setBusy(false);
      setMsg(e.message || String(e));
    }
  };

  const wrap = { minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F8FA", fontFamily: "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif", color: "#16202E", padding: 24, boxSizing: "border-box" };
  const card = { width: 360, background: "#fff", border: "1px solid #DCE1E8", borderRadius: 16, padding: 32, boxShadow: "0 10px 40px rgba(20,32,46,.08)" };
  const input = { width: "100%", border: "1px solid #DCE1E8", borderRadius: 9, padding: "11px 13px", fontSize: 14, marginTop: 6, boxSizing: "border-box", fontFamily: "inherit" };
  const label = { fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".1em", color: "#6B7785", fontWeight: 600 };
  const btn = { width: "100%", marginTop: 18, background: "#1E5FCC", color: "#fff", border: 0, borderRadius: 9, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer" };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 24 }}>
          {brand.logoUrl && <img src={brand.logoUrl} alt="" style={{ maxHeight: 64, maxWidth: 200, objectFit: "contain", marginBottom: 14 }} />}
          <div style={{ fontWeight: 700, fontSize: 21, letterSpacing: "-0.01em" }}>{brand.projectName} {brand.appName}</div>
          <div style={{ fontSize: 11, color: "#6B7785", marginTop: 5, textTransform: "uppercase", letterSpacing: ".12em" }}>{brand.tagline}</div>
        </div>
        <div style={{ fontSize: 13.5, color: "#16202E", marginBottom: 16, textAlign: "center" }}>Welcome. Choose a password to activate your account and sign in.</div>
        <div style={label}>New password</div>
        <input style={input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
        <div style={{ ...label, marginTop: 14 }}>Confirm password</div>
        <input style={input} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
        <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={save}>{busy ? "Setting up…" : "Set password and continue"}</button>
        {msg && <div style={{ marginTop: 12, fontSize: 12.5, color: "#C0392B", textAlign: "center" }}>{msg}</div>}
      </div>
    </div>
  );
}
