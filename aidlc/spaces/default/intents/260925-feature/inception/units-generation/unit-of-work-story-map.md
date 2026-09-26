# Unit of Work — Story Map

> Maps each unit to its user stories and the user journey step it delivers.

## Story Map

| Journey Step | Unit | User Story | Priority |
|---|---|---|---|
| Start (walking skeleton) | u0-frontend | US-1 (partial), US-11 (partial) | Must Have |
| Register / Login | u8-authentication | US-8 | Must Have |
| First launch → onboarding | u11-onboarding | US-11 | Must Have |
| Upload drawing | u1-image-upload | US-1 | Must Have |
| Receive AI critique | u2-ai-critique | US-2 | Must Have |
| Handle AI failure | u3-low-confidence | US-3 | Must Have |
| Store critique privately | u4-critique-storage | US-4 | Must Have |
| View past uploads | u5-history-storage | US-5 | Must Have |
| See improvement trend | u6-trend-calculation | US-6 | Must Have |
| Freemium tier gate | u7-tier-api | US-7 | Must Have |
| Track / enforce upload limit | u9-upload-limits | US-9 | Must Have |
| Upgrade to paid | u10-mock-payment | US-10 | Must Have |
| Read data policy | u12-data-policy | US-12 | Must Have |
| Delete history | u13-history-deletion | US-13 | Must Have |

## MVP Boundary

All 14 units (including u0 walking skeleton) are Must Have. No Should Have units are in scope (U14 teaser and U15 upload context deferred from Scope Definition).

## Vertical Slice Coverage

Each unit delivers a complete vertical slice (user-facing capability through all layers). The walking skeleton (u0) is the exception — it is the infrastructure slice that enables all subsequent vertical slices.
