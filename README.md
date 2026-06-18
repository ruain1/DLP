# FIN04 Lookahead

Last Planner make-ready board, four-week day-by-day lookahead, with real login,
roles, company-scoped permissions, an audit trail, planned-versus-actual, import/export,
editable levels, milestones, Gantt/Swimlane and Day/Week. Same GUI as the approved preview.

Stack: React + Vite (front end), Supabase (Postgres + Auth + Row Level Security + realtime),
one Supabase Edge Function for admin user management. Host the built static site anywhere
(Cloudflare Pages or Vercel recommended).

I could not run Supabase or deploy from the place this was built, so the steps below are how
you stand it up. Expect to test auth, invites and RLS in your own project and report back any
errors, the same as any first deploy.

---

## 1. Create the Supabase project
- New project at supabase.com. Pick an EU region if data residency matters.
- Settings > API: note the **Project URL** and the **anon public key** (for the front end),
  and the **service_role key** (never goes in the front end; the edge function uses it).

## 2. Create the database
- SQL Editor > paste the whole of `supabase/schema.sql` > Run.
- This builds the tables, the row level security policies, the audit triggers, the
  signup trigger and seed data (levels, settings, a starter set of companies/areas/systems).

## 3. Bootstrap the first admin
- Auth > Providers: temporarily **enable email signups**.
- Run the front end (step 5) or use the Supabase dashboard to create your own account.
- Make yourself admin (SQL Editor):
  ```sql
  update profiles set role='admin'
  where id = (select id from auth.users where email='you@yourdomain.com');
  ```
- Auth > Providers: **disable public signups** again. From now on, accounts are created only
  by an admin from the in-app Users tab (which invites by email).

## 4. Deploy the edge function (admin user management)
- Install the Supabase CLI, then:
  ```bash
  supabase login
  supabase link --project-ref YOUR_PROJECT_REF
  supabase functions deploy admin-users
  ```
- The function automatically receives `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
  `SUPABASE_SERVICE_ROLE_KEY` as secrets. It verifies the caller is an admin before doing anything.

## 5. Run the front end locally
```bash
cp .env.example .env      # then fill in the two values
npm install
npm run dev
```
`.env`:
```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```

## 6. Deploy live (Cloudflare Pages or Vercel)
- Push this folder to a Git repo, import it into Cloudflare Pages or Vercel.
- Build command `npm run build`, output directory `dist`.
- Set the two `VITE_*` environment variables in the host's dashboard.
- In Supabase Auth > URL Configuration, set the **Site URL** and **Redirect URLs** to your
  deployed domain, so invite and password-reset links land on the live site.
- For real invite emails, configure SMTP in Supabase Auth (the built-in sender is rate-limited
  and meant for testing).

## 7. Run the project
- Sign in as the admin. Admin > Companies/Areas/Systems/Levels to set up, or Admin > Import/Export
  to bulk-load (JSON project file, or a CSV of activities that auto-creates companies/areas/systems).
- Admin > Users to invite contractors, set each one's role and company.
- Members see the whole calendar but can only add or edit activities for their own company.
  This is enforced by row level security in the database, not just the interface.

---

## How the security works
- **Login**: Supabase Auth. The anon key in the browser is public by design; it is not a secret.
- **Permissions**: row level security. A member can read all activities but can only insert/update/delete
  rows where `company_id` equals their own company. Admins can do everything. Enforced in Postgres.
- **Audit**: database triggers write `audit_log` on every insert/update/delete, stamped with the
  authenticated user. Clients cannot insert or edit the log, and only admins can read it.
- **User management**: the only operation needing the service role (creating/deleting login accounts)
  runs server-side in the edge function, which checks the caller is an admin first.

## Files
- `supabase/schema.sql` - database, security, audit, seed
- `supabase/functions/admin-users/index.ts` - admin user management
- `src/App.jsx` - the board (unchanged GUI), wired to Supabase
- `src/data.js` - load, diff-sync, realtime, user ops
- `src/Login.jsx`, `src/main.jsx`, `src/supabaseClient.js`
