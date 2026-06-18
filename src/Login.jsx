import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setMsg(error.message);
    setBusy(false);
  };
  const reset = async () => {
    if (!email) { setMsg("Enter your email first."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setMsg(error ? error.message : "Password reset email sent.");
  };

  const wrap = { minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F8FA", fontFamily: "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif", color: "#16202E" };
  const card = { width: 340, background: "#fff", border: "1px solid #DCE1E8", borderRadius: 14, padding: 26, boxShadow: "0 8px 30px rgba(20,32,46,.07)" };
  const input = { width: "100%", border: "1px solid #DCE1E8", borderRadius: 8, padding: "10px 12px", fontSize: 14, marginTop: 6, boxSizing: "border-box", fontFamily: "inherit" };
  const label = { fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".1em", color: "#6B7785", fontWeight: 600 };
  const btn = { width: "100%", marginTop: 16, background: "#1E5FCC", color: "#fff", border: 0, borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 600, cursor: "pointer" };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em" }}>FIN04 Lookahead</div>
        <div style={{ fontSize: 11, color: "#6B7785", textTransform: "uppercase", letterSpacing: ".12em", marginTop: 3, marginBottom: 20 }}>4-week make-ready</div>
        <div style={label}>Email</div>
        <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && signIn()} />
        <div style={{ ...label, marginTop: 14 }}>Password</div>
        <input style={input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && signIn()} />
        <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={signIn}>{busy ? "Signing in…" : "Sign in"}</button>
        <button style={{ background: "none", border: 0, color: "#6B7785", fontSize: 12, marginTop: 12, cursor: "pointer", width: "100%" }} onClick={reset}>Forgot password</button>
        {msg && <div style={{ marginTop: 12, fontSize: 12.5, color: msg.includes("sent") ? "#0E9384" : "#C0392B" }}>{msg}</div>}
        <div style={{ marginTop: 18, fontSize: 11, color: "#6B7785", lineHeight: 1.5 }}>Accounts are created by an administrator. If you were invited, check your email for the link to set a password.</div>
      </div>
    </div>
  );
}
