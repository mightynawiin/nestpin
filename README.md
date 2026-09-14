# Nestpin — rent-house map PWA

## What's inside
- `index.html` — the whole app (map, search, add/view/delete listings). Self-contained, uses Leaflet from a CDN.
- `manifest.json` + `sw.js` — makes it installable and gives it an offline app shell once it's hosted on a real domain.
- `icon-192.png` / `icon-512.png` — app icons referenced by the manifest.

## Supabase setup
The app is connected to the supplied Supabase project using its public `anon` key. The key is designed for browser use; never add a `service_role` key to this project.

Before running the app, open the Supabase Dashboard SQL Editor and run [`supabase-setup.sql`](supabase-setup.sql). It creates the tables, Row Level Security policies, and private `listing-photos` bucket used by the app.

The app uses Supabase Auth for account ownership, the database for listing details, and private Storage for photos. Photos are uploaded under each user's ID and displayed through temporary signed URLs. In the SQL policy, the user folder must match the first path segment of the object name, e.g. user-id/listing-id/0.jpg.

## Making it a real, publicly-hosted PWA
To get a version anyone in the world can install, you need to swap the storage layer for a real backend:
1. Run `supabase-setup.sql` in the Supabase SQL Editor.
2. Configure your Auth provider and redirect URL in Supabase Dashboard > Authentication > URL Configuration.
3. Host the static files (Netlify, Vercel, GitHub Pages, Cloudflare Pages all work) over HTTPS — required for the service worker, geolocation, and "Add to Home Screen" to function.
4. Before opening this to the public, add rate limiting, moderation/reporting, and a production geocoder.

## Known limitations of the current build
- New users must sign in and select a profile area by searching or tapping the map before listings are shown.
- Photos are compressed in the browser and stored in private Supabase Storage, capped at 4 per listing.
- Region search uses OpenStreetMap's free Nominatim geocoder — it can be slow or rate-limited under heavy use; a paid geocoder is worth it at scale.
