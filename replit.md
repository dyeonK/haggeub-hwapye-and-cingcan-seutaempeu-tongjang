# 우리 반 통장

초등학교 교사가 학생 포인트와 칭찬 스탬프, 보상 상점을 한 화면에서 운영하는 학급 경영 웹앱입니다.

## Run & Operate

- `pnpm --filter @workspace/class-points run dev` — run the classroom points web app
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Optional app env: `VITE_FIREBASE_CONFIG` — Firebase Web App config JSON. When set, the app uses Firestore collections `Students`, `Transactions`, `Rewards`, and `Redemptions` with realtime listeners. Without it, the same seeded data is retained in browser local storage for preview.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: Firebase Firestore in the classroom app; the shared API template still includes PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/class-points/src/App.tsx` — classroom dashboard, rewards, approvals, and history screens
- `artifacts/class-points/src/lib/classroom-data.ts` — Firestore/local persistence adapter and sample data
- `artifacts/class-points/src/index.css` — classroom color tokens and responsive touch-first UI

## Architecture decisions

- Firestore is accessed from the browser with the Firebase Web SDK so no admin key is bundled into the app.
- All mutations update the local UI immediately, then persist to Firestore; reward approvals use a Firestore transaction to prevent double spending.
- If Firebase Web config is absent, the app explicitly shows local preview mode and uses localStorage plus BroadcastChannel for reload and same-browser multi-tab persistence.

## Product

- 24 seeded students grouped into four 분단 with zero starting points.
- Large dashboard cards, group tabs, multi-select batch point changes, reason templates, and a fullscreen classroom mode.
- Four fixed reward items, student redemption requests, teacher approval/rejection, transaction history, and CSV export.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
