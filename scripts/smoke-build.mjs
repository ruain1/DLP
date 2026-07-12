// Builds the boot-smoke bundle: the real app with ./data swapped for the double.
import { build } from "esbuild";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const here = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [resolve(here, "smoke-entry.jsx")],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile: resolve(here, "smoke-bundle.cjs"),
  loader: { ".jsx": "jsx" },
  jsx: "automatic",
  define: { "import.meta.env.MODE": '"smoke"', "import.meta.env.DEV": "false", "import.meta.env.PROD": "true", "import.meta.env.VITE_SUPABASE_URL": "\"https://smoke.invalid\"", "import.meta.env.VITE_SUPABASE_ANON_KEY": "\"smoke-key\"" },
  plugins: [{
    name: "data-double",
    setup(b) {
      b.onResolve({ filter: /^\.\/data(\.js)?$/ }, (args) => {
        if (args.importer.includes("/src/")) return { path: resolve(here, "smoke-data-double.js") };
        return null;
      });
    },
  }],
  logLevel: "silent",
});
console.log("smoke bundle built");
