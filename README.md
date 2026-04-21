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
- Qualification cards: `src/data/qualification-cards.source.json`

## Commands

```bash
npm run data:update
npm run build
npm run test:unit
```

## Deployment target

- Domain: `games28.paulzuiderduin.com`
- Host: GitHub Pages

## Manual follow-up

1. Create a public GitHub repository named `games28`.
2. Push this folder as its own repository.
3. Enable GitHub Pages via GitHub Actions.
4. Add the DNS record for `games28.paulzuiderduin.com` in `mijn.host`.
5. Set the custom domain in GitHub Pages and enforce HTTPS.
6. Link the app from `paulzuiderduin.com` later, after the MVP is validated.
