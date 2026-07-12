// Smoke entry: boots the real App with a fake session against the data double.
import React from "react";
import { createRoot } from "react-dom/client";
import App from "../src/App.jsx";
const session = { user: { id: "smoke-user", email: "smoke@test" } };
window.__SMOKE_ERRORS = [];
window.addEventListener("error", (e) => window.__SMOKE_ERRORS.push(String(e.error || e.message)));
createRoot(document.getElementById("root")).render(<App session={session} />);
