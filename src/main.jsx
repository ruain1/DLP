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
createRoot(document.getElementById("root")).render(<Root />);
