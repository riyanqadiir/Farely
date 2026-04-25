# Google AI Studio Prompt (Admin Frontend)

Copy and paste the full prompt below into Google AI Studio to generate the
admin dashboard frontend only.

```text
You are a senior frontend engineer. Build a production-ready Admin Dashboard frontend for Farely using:
- React + Vite
- TypeScript
- Tailwind CSS

Project name: farely-admin
Purpose: Secure admin dashboard for customer support + ride analytics.

Product constraints:
1) Green-first theme (modern, clean, consistent; avoid random blue accents).
2) Responsive layout for desktop/tablet.
3) Reusable components, no duplicated logic.
4) Keep all server calls in a centralized API layer with typed DTOs.
5) Use TanStack Query for server state and caching.
6) Use React Router for authenticated routes.

Required pages/routes:
- /login
- /dashboard
- /rides/logs
- /rides/hotspots
- /support/inbox
- /settings/profile

Required features:
1) Login screen
   - email/password/remember me
   - validation + loading states
2) Dashboard summary cards
   - total ride searches
   - handoff attempts
   - handoff success
   - confirmed rides
   - open/in-progress/resolved support threads
3) Traffic charts
   - line chart and bar chart
   - filters: date range, provider, city, ride type
4) Hotspots module
   - map panel + table panel
   - table columns: area/tile, demand, confirmed rides, avg eta, success rate
5) Ride logs module
   - from/to location, provider, ride type, fare estimate, status, timestamp
   - cursor pagination + search + provider/status filters
6) Support inbox module
   - thread list sidebar
   - message timeline view
   - reply composer
   - status/priority/assignment actions
7) Notification toasts (success/error/info)
8) Loading skeletons + empty states
9) Error boundaries and friendly error messages

Chart/map libraries:
- Charts: Recharts
- Map: Leaflet (or abstracted map adapter interface so map provider can be swapped)

Use these API contracts (mock these now):
- POST /admin/auth/login
- POST /admin/auth/refresh
- POST /admin/auth/logout
- GET /admin/metrics/traffic
- GET /admin/metrics/hotspots
- GET /admin/rides/logs
- GET /admin/support/threads
- GET /admin/support/threads/:id/messages
- POST /admin/support/threads/:id/reply
- PATCH /admin/support/threads/:id

Expected response envelope:
{
  "success": true,
  "data": {}
}

Expected error envelope:
{
  "success": false,
  "error": { "code": "STRING_CODE", "message": "Message" }
}

Generate these deliverables:
1) Complete project structure
2) Route layout and auth guard
3) Shared UI components (cards, table, filters, modal, toast, loader)
4) Typed API client + DTO interfaces
5) Mock API adapters with realistic sample payloads
6) At least one fully working chart page and one fully working support inbox page
7) README.md with:
   - setup commands
   - environment variables
   - build/run commands
   - where to replace mock API with real backend

Non-functional requirements:
- Strict TypeScript (no implicit any)
- ESLint + Prettier config
- Accessibility: keyboard focus states, aria labels for interactive controls
- Keep code modular and readable for backend integration in Cursor later

When outputting the project, include all files needed to run:
- package.json
- vite.config.ts
- src/main.tsx
- src/App.tsx
- src/routes/*
- src/pages/*
- src/components/*
- src/api/*
- src/types/*
- src/styles/*
- README.md
```

## Usage notes

- After generation, download and open that admin project in Cursor.
- Then we can implement backend integration against your real APIs.
