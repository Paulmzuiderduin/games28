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
