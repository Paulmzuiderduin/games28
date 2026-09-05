# Games28

Games28 is a standalone React + Vite app for `games28.paulzuiderduin.com`.

## MVP

- Full LA 2028 schedule explorer
- Country dashboards with saved countries, qualification-ready cards, derived country schedules, and change feed
- Daily data refresh workflow
- GitHub Pages deploy with custom domain
- No login and no Supabase for MVP

## Local development

```bash
npm install
npm run data:update
npm run dev
```

## Data model

The runtime dataset is generated into `src/data/runtime.json` and copied into `public/runtime.json`.

- Official source metadata: LA28 schedule page + by-event PDF URL
- Practical parser input: public planning sheet export
- Qualification source inputs, structured confirmations, and review candidates: `src/data/qualification-sources.source.json`
- Qualification-system registry: `scripts/qualification-systems.mjs` (derived against all schedule sport labels during refresh)
- Country selection-source overrides: `src/data/country-selection-source-overrides.json`

## Qualification policy

Games28 publishes confirmation-only qualification records. Every schedule sport maps to an International Federation qualification system and every IOC NOC has an explicit country-selection source slot. A source being watched is not a qualification record.

A published record must have an IOC, International Federation, NOC, or national federation source URL that matches its trusted source definition, plus source and verification dates. Rankings, projections, and media reports never create a published qualification card.

The record source distinguishes NOC quota allocation from a named athlete or team selection. A final entry is the strongest status and can replace an earlier allocation or selection record.

Add machine-readable official allocations to `structuredRecords`; valid records auto-publish on refresh. Put official prose announcements and source conflicts in `reviewQueue`. A review candidate needs evidence, detected date, source URL, a reason, and a resolution. Only an `approved` candidate with a valid nested record can enter the public dataset; pending and rejected candidates remain auditable but private.

The daily refresh also scans every configured official qualification source. It automatically recognizes JSON, CSV, and HTML allocation tables only when a row contains a known IOC NOC (or exact country name), an explicit confirmation state, and an official publication date. Unsupported PDFs, JavaScript-only trackers, or prose never auto-publish; designated official prose sources create stable review candidates in `src/data/qualification-ingestion.json` instead. This means source-specific adapters can be added as federations release more usable allocation feeds without weakening the confirmation rule.

### Optional daily web discovery

The refresh can also search trusted International Federation domains for official qualification announcements. It is deliberately discovery-only: results create private Admin review candidates and never publish a qualification by themselves. Candidate IDs are stable per official qualification scope (`source + event + NOC + allocation/selection`), so a changed source updates the existing pending/review-later item instead of creating another row. Once an active quota exists for that NOC and event, further allocation search results are suppressed; named-athlete/team selection remains a separate later state.

To enable it, create a Brave Search API key and save it as the GitHub Actions secret `BRAVE_SEARCH_API_KEY`. The workflow starts with 24 rotating sport/event searches daily (about 720 per 30-day month). Adjust `BRAVE_SEARCH_MAX_QUERIES` in `.github/workflows/update-data.yml` only after checking your Brave usage limit.

Records carry a lifecycle state: `allocated`, `earned`, `selected`, `entered`, `withdrawn`, or `replaced`. Final entries override earlier selections and quotas. Withdrawn or replaced history is retained but never shown as an active card.

## Commands

```bash
npm run data:update
npm run build
npm run test:unit
```

## Private Review Console

`/admin` is an owner-only qualification-review console. It uses Supabase email magic-link authentication and an RLS-protected audit trail. The public app stays static and does not expose the Supabase server key.

1. The Games28 Supabase project is `gavpllldsyepqhldczud`; apply both migration files in `supabase/migrations/` if setting up another environment.
2. Configure `https://games28.paulzuiderduin.com` as the hosted Auth site URL and `https://games28.paulzuiderduin.com/admin` as an allowed Auth redirect URL.
3. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as GitHub Actions secrets. The daily workflow then syncs detected review candidates to the private queue. The public project URL and publishable key are intentionally already bundled in the static app; do not add a service-role key to Vite variables.
4. After your first magic-link sign-in, insert your `auth.users` UUID into `public.games28_admins` using the documented line at the end of the migration. This is intentionally a one-time, explicit owner grant.

## Deployment target

- Domain: `games28.paulzuiderduin.com`
- Host: GitHub Pages

## SEO and analytics

- Search Console property: `https://games28.paulzuiderduin.com/`
- Submit sitemap: `https://games28.paulzuiderduin.com/sitemap.xml`
- Recommended verification: DNS TXT record at the domain provider.
- Optional fallback: add a Games28-specific `google-site-verification` meta tag to `index.html` if Google provides one.
- Analytics: Umami Cloud with website ID `fa9fc201-00fd-427f-883e-a51dd6c45e09`.
- Support link: `https://ko-fi.com/paulzuiderduin`.

The build generates static SEO HTML for core routes after Vite finishes. Run `npm run build` to refresh route metadata, structured data, and sitemap output.

## Manual follow-up

1. Create a public GitHub repository named `games28`.
2. Push this folder as its own repository.
3. Enable GitHub Pages via GitHub Actions.
4. Add the DNS record for `games28.paulzuiderduin.com` in `mijn.host`.
5. Set the custom domain in GitHub Pages and enforce HTTPS.
6. Link the app from `paulzuiderduin.com` later, after the MVP is validated.
