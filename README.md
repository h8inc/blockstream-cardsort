# First-screen card sort — React app with built-in collection

React (Vite) version of the card sort study, with the collection endpoint built in
as a Netlify Function + Netlify Blobs. Deploy once and data collection just works —
no Google setup, no third-party research tool.

## Deploy (one time, ~3 minutes)

Option A — Netlify CLI (fastest):
    npm install
    npx netlify-cli login          # opens browser once
    npx netlify-cli init           # create the site (or `link` to an existing one)
    npx netlify-cli deploy --prod  # builds + deploys app AND the /api/entry function

Option B — GitHub: push this folder to a repo, "Add new site → Import from Git"
on app.netlify.com. netlify.toml configures everything.

Then set the read token (Site settings → Environment variables):
    COLLECT_TOKEN = <pick a secret>
Until you set it, the default is `blockstream-test` — fine for test data.

## How collection works

- The app POSTs each response to `/api/entry` (same site, no CORS, retries x3).
- Responses land in Netlify Blobs (store `cardsort-responses`), de-duped by id.
- Read them back: `https://YOUR-SITE.netlify.app/api/entry?token=<COLLECT_TOKEN>`
- `analyze.html` (served at /analyze.html) — paste that URL into its Fetch box.
  Keep the token private; consider removing analyze.html from public/ for the
  real study and running it locally instead.
- Free-tier limits are far beyond 100 responses; each response is ~5-10 KB.

## Local development

    npm install
    npx netlify-cli dev   # runs Vite + the function + local blobs at localhost:8888
    # `npm run dev` also works, but /api/entry then 404s → app shows preview mode

## Structure

    src/App.jsx        — flow: intro → screener → sort → squeeze → closers → submit
    src/board.js       — imperative sort-board engine (drag/tap, packing, 393x852
                         fixed phone, fold math in layout px) — framework-free core
    src/data.js        — CONFIG, CARDS (locked wording!), component FACES (design tokens)
    src/styles.css     — app + face styles (surface #181818, brand #00bcff, radius 4)
    netlify/functions/collect.mjs — the endpoint (POST store / GET with ?token=)
    public/analyze.html — results dashboard (self-contained)

## Rules that protect the data

- Card wording is LOCKED once the first real participant runs; change it in
  src/data.js AND public/analyze.html AND the FigJam board together, or datasets fork.
- The phone is fixed 393x852 with the fold at 798 content px — identical for every
  participant. Don't make it responsive-fluid; comparability depends on it.
