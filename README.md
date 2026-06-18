# Little Sprouts — Family PWA (GitHub + Supabase)

Installable phone + web app for daily checklists, protein and growth tracking — for both kids and parents. Shraddha fills the checklist, everyone syncs live, reminders nudge whoever hasn't filled it. English + ગુજરાતી toggle. Weight-trend charts. Goals for everyone.

```
little-sprouts/
  public/                       ← the app (served by GitHub Pages)
    index.html                  ← put your Supabase keys here (CONFIG block)
    manifest.webmanifest  sw.js  icons/
  supabase/
    migrations/20260617120000_init.sql   ← tables + security (auto-applied by the GitHub integration)
    functions/send-reminders/index.ts    ← push reminder function
    config.toml                 ← tells Supabase the function settings
    cron.sql                    ← schedules reminders every 15 min
  .github/workflows/deploy.yml  ← auto-deploys public/ to GitHub Pages on every push
  .gitignore
```

---

## 1) Push to GitHub
From the unzipped folder:
```bash
git init -b main
git add .
git commit -m "Little Sprouts family PWA"
# create an empty repo on github.com first (e.g. little-sprouts), then:
git remote add origin https://github.com/<YOUR-USERNAME>/little-sprouts.git
git push -u origin main
```
(Or use GitHub Desktop: “Add Local Repository” → Publish.)

Because your Supabase is already connected to GitHub, pushing this repo makes Supabase pick up `supabase/migrations` and `supabase/functions` and deploy them automatically. (I can also apply them directly here once you approve Supabase access — same result.)

## 2) Turn on GitHub Pages
Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The included workflow publishes `public/` and gives you a URL like `https://<username>.github.io/little-sprouts/`.

## 3) Add your Supabase keys to the app
Supabase → **Settings → API**, copy **Project URL** and **anon public** key. In `public/index.html`, edit the CONFIG block near the top of the `<script>`:
```js
const SUPABASE_URL      = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
const VAPID_PUBLIC_KEY  = "YOUR-VAPID-PUBLIC-KEY"; // optional, step 5
```
Commit + push. (The anon key is safe to ship publicly — Row-Level Security protects the data.)

Also in Supabase → **Authentication → Providers → Email**, turn **off** “Confirm email” for the easiest first sign-in (optional).

## 4) First run
Open the Pages URL on your phone → browser menu → **Add to Home Screen**.
1. Create account → **Create a new family** (seeds Pranisha, a 2nd child, Nikunj, Shraddha — edit in ⚙️).
2. Set each person’s name, age, weight, reminder time.
3. **Add Shraddha:** ⚙️ → Copy family code → send it to her. She signs up, taps **Join family**, pastes it → you both share the same data live.

## 5) Closed-app push reminders (optional)
1. Generate keys: `npx web-push generate-vapid-keys`. Put the **public** key in `VAPID_PUBLIC_KEY` (step 3), push.
2. In Supabase → **Edge Functions → Secrets**, set: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:you@email.com`.
3. Run `supabase/cron.sql` in the SQL Editor (replace `<PROJECT_REF>` and a key) to fire the function every 15 min.
4. On each phone, open the app → ⚙️ → **Enable reminders on this device**.

In-app reminders work without any of this; step 5 is only for nudges when the app is fully closed.

---

### Notes
- **Security:** never put the *service role* key in `index.html`. Only the anon key.
- **Protein targets** use a general ~1 g/kg guideline — confirm each child’s target with your pediatrician.
- Everything (people, checklist items per child/adult, schedule, goals, language) is editable in ⚙️.
