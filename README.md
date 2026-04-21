# South Bend Food Bridge — beta prototype

Static web beta for a food-bank / pantry / donor communication platform. It runs as a static site and now supports shared messaging through Firebase Firestore.

## Beta improvements this week

- Replaced placeholder organizations with real South Bend-area partners (still mark hours as verify before public release).
- Added **need status levels** per organization: `Critical`, `High`, `Moderate`, `Stable`.
- Updated map markers to reflect need status colors.
- Added organization-side **need status** and **wishlist** controls in the place detail panel; with Firebase configured, both sync in realtime for all visitors (same Firestore pattern as Messages).
- Upgraded messaging from one bulletin board to role-to-role direct messages (`Donor`, `Organization`, `Neighbor in need`) with inbox/sent/all views.
- Alerts are now generated from current status + role rather than fixed text.

## Feature boundaries (for class beta)

- No login/auth yet.
- Map **need status** uses browser localStorage only when Firebase is not configured; with Firebase, status and wishlist overrides live in Firestore (`settings/locationOverrides`) and update everyone live.
- No SMS/push notifications.

## Firebase setup for shared messages (no auth)

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Add a **Web App** in Project Settings and copy the config object values.
3. In this repo, open `js/firebase-config.js` and replace all `REPLACE_ME` values.
4. In Firebase Console, create a **Cloud Firestore** database (start in production mode).
5. Add these Firestore rules for simple class demo use:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /messages/{messageId} {
      allow read, write: if true;
    }
    match /settings/locationOverrides {
      allow read, write: if true;
    }
  }
}
```

6. Deploy/push. Messages, need status, and wishlists will sync across browsers/devices in realtime.

Important: these rules are intentionally open for prototype speed. Lock them down before any public/real deployment.

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
