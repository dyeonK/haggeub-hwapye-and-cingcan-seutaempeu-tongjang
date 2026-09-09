---
name: Firestore classroom persistence
description: Durable storage choice for the classroom points app and its preview behavior.
---

The classroom app treats Firebase Web SDK + Firestore as the production persistence layer. It uses the public Firebase Web App configuration, never an admin/service-account key in the browser, and keeps the same four collection names as the product schema.

**Why:** The app must update on the classroom TV and teacher device without a custom auth/backend credential flow, while still being usable in preview before a Firebase project is configured.

**How to apply:** Keep the Firestore/local adapter explicit in the UI. When Firebase config is absent, use the local preview adapter for reload and same-browser multi-tab persistence; do not imply that local preview is cloud-synced.