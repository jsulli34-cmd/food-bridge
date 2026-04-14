# South Bend Food Bridge — beta prototype

Static web beta for a food-bank / pantry / donor communication platform. It runs without a backend so you can deploy quickly to GitHub + Vercel for class review.

## Beta improvements this week

- Replaced placeholder organizations with real South Bend-area partners (still mark hours as verify before public release).
- Added **need status levels** per organization: `Critical`, `High`, `Moderate`, `Stable`.
- Updated map markers to reflect need status colors.
- Added organization-side status controls in the place detail panel (local demo state).
- Upgraded messaging from one bulletin board to role-to-role direct messages (`Donor`, `Organization`, `Neighbor in need`) with inbox/sent/all views.
- Alerts are now generated from current status + role rather than fixed text.

## Feature boundaries (for class beta)

- No login or backend yet.
- Status and messages are saved in browser localStorage only.
- No SMS/push notifications.

## Run locally

- VS Code/Cursor Live Preview or Live Server, or
- `python -m http.server 8080` then open `http://localhost:8080`.

## Deploy to GitHub + Vercel

1. Commit and push to your GitHub repo.
2. In Vercel, import repo `jsulli34-cmd/food-bridge`.
3. Root directory: repo root. Build command: none. Framework: Other/static.
4. Deploy.

## Suggested testing scenarios

- Switch each role and confirm alerts/messages change.
- As Organization, update a location status and confirm map/list colors update.
- Send a message from Donor to Organization, switch roles, and confirm it appears in inbox.
- Filter locations by type and confirm map/list sync.
