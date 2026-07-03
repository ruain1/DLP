import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./supabaseClient";
import App from "./App.jsx";
import Login from "./Login.jsx";
import SetPassword from "./SetPassword.jsx";
import SetupAccount from "./SetupAccount.jsx";

// The inline script in index.html captured the URL hash before supabase-js
// stripped it. Invite and recovery links arrive as #...type=invite / type=recovery.
const initialHash = (typeof window !== "undefined" && window.__INITIAL_HASH__) || "";
const cameFromAuthLink = /type=(invite|recovery)/.test(initialHash);
// Our own invite links carry ?token=... and go to the setup page.
const inviteToken = (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("token")) || "";

function Root() {
  const [session, setSession] = useState(undefined);
  const [setPw, setSetPw] = useState(cameFromAuthLink);
  const [setup, setSetup] = useState(!!inviteToken);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setSetPw(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Invite link: set your own password and get signed straight in. No session needed yet.
  if (setup) return <SetupAccount token={inviteToken} onDone={() => setSetup(false)} />;
  if (session === undefined) return null;
  // Recovery / invite (Supabase native links, kept as a fallback): choose a password first.
  if (setPw && session) return <SetPassword onDone={() => setSetPw(false)} />;
  if (!session) return <Login />;
  return <App session={session} />;
}
// REV90: MSAL auth landing guard (Microsoft's documented pattern for SPAs whose redirectUri is
// the app root). When this page loads as the redirect target inside the sign-in popup or inside
// MSAL's hidden token-renewal iframe, booting the app would strip the auth response from the URL
// (enterProject replaceStates "?p=..."), starving the opener or parent frame of the result. So:
// auth response present AND we are a child window or frame -> render a static line, leave the URL
// untouched, and let the opener read the hash and close this window. A top-level redirect return
// (no opener, not framed) boots normally and is absorbed by the captured-hash path in App.jsx.
const msalHash = initialHash || (typeof window !== "undefined" ? window.location.hash : "") || "";
const isMsalReturn = /[#&](code|error|error_description)=/.test(msalHash) && !cameFromAuthLink;
const isAuthChild = typeof window !== "undefined" && (((window.opener && window.opener !== window)) || window !== window.parent);
if (isMsalReturn && isAuthChild) {
  document.getElementById("root").innerHTML = '<div style="font-family:Segoe UI,Arial,sans-serif;padding:48px 20px;text-align:center;color:#475569;font-size:14px">Completing sign-in&hellip; this window will close itself.</div>';
} else {
  createRoot(document.getElementById("root")).render(<Root />);
}
