# South Bend Food Bridge — class prototype

Static web prototype for a food-bank / pantry / donor coordination app. No build step, no paid APIs: map tiles from [OpenStreetMap](https://www.openstreetmap.org/), markers and data from local JSON.

## What’s included

- **Roles:** Donor, Organization, Neighbor in need (changes hint text and sample **Alerts**).
- **Map:** South Bend area with filterable location types (pantry, food hub, meals, redistribution).
- **Place details:** Address, hours, website link, phone, wishlist, notes (all demo copy — replace with real partners later).
- **Alerts:** Mock lines only (not real-time; swap for a backend or SMS later if the course allows).
- **Messages:** Simple bulletin stored in `localStorage` in this browser (for demo coordination; not shared between users).

## Run locally

Browsers often block `fetch()` to `data/locations.json` when you open `index.html` as a file. Use any static server from the **repo root** (this folder), for example:

- **VS Code / Cursor:** “Live Preview” or “Live Server” on `index.html`.
- **Python:** `python -m http.server 8080` then open `http://localhost:8080`.

## Deploy on Vercel + GitHub

Treat **this folder as the whole repository** (do not nest it inside a parent repo unless you change Vercel’s root).

1. Create a new GitHub repository and push **only the contents of this project** (the files next to this README).
2. In [Vercel](https://vercel.com), **Add New Project** → import that repo.
3. Leave **Root Directory** empty (repo root). Framework: **Other** (static). No build command.
4. Deploy. The app should load with the map and data.

## Next steps for your team

- Replace demo locations in `data/locations.json` with verified South Bend organizations and accurate coordinates.
- Add a real auth + database for shared alerts and messages when you’re ready.
- Optional later: Next.js or another framework if you want components, APIs, and easier team workflows.
