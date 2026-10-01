# Control Vault reliability correction

Authority: the user's 2026-10-01 technical review and implementation request.
Supersedes the foundation's empty-database-only hydration rule and the visual spec's silent sync and state-only navigation contracts.

## Persistence

Supabase is the confirmed cross-device record. IndexedDB remains the durable offline working copy; a local commit is not remote confirmation. Push pending stable IDs, then fetch all owned remote rows on every synchronization. Merge atomically, retaining pending local records (including writes made during a network request). Remote values replace confirmed local values with the same ID. Records are append-only in the current UI; no new edit/delete or finance screens.

Acknowledge only the exact payload sent, never a newer concurrent write. Bind the existing personal local database to its first authenticated sync owner and reject another owner without deleting data. Initial setup is insert-once remotely: another device cannot reset an existing vehicle configuration. Remote reads are ordered and paginated. A failed remote read commits no partial snapshot.

## Feedback and lifecycle

ON means the most recent remote refresh completed and no local writes remain pending. OFF means no network; pending counts remain explicit. SYNC means pending writes, an active run, remote failure, missing/expired auth, or an unverified remote snapshot. Show textual indicators and an actionable retry/error message. Log only operation/table and safe error codes; never record payloads or credentials.

Trigger on authentication/startup, online, focus, visible resume and local commits. Coalesce lifecycle events; serialize runs and repeat when a new local write arrives. No recurring data polling. Refresh mounted views after remote merge. Saving returns immediately after local durability and explicitly says local/pending until server confirmation.

## Navigation and reference

Use native History API with /, /abastecer, /hodometro and /historico. Listen to popstate, respect real back history, and replace a directly entered internal path with / when there is no app predecessor. Keep a shared bottom navigation outside animated screens, fixed with opaque background, safe-area padding and reserved content space. Hide it while a form field is focused so the keyboard does not cover form actions. Use dynamic viewport units and one document scroll.

Display the existing ANP municipal mean price as `Preço de referência: R$ X,XX/L`, the source week and estimated liters. Label the operational cap separately; preserve the existing 4 L × municipal maximum rule, cents storage and calculation snapshots.

## PWA

Keep supplied brand assets. Offer installation only for an available beforeinstallprompt or iOS home-screen instructions outside standalone. Register the worker through the plugin virtual module; check updates on resume/online. Prompt before activating a new version, so unsaved form values are not discarded. Cache static shell/assets only, never Supabase or fuel-price responses. Keep offline navigation fallback and versioned assets; revalidate HTML and worker through hosting headers.

## Verification

RED/GREEN tests for cross-device pull with nonempty local data, pending preservation, concurrent acknowledgment, failed reads/writes, retry/idempotency, owner mismatch, focus/resume, history/back, reference copy, install and update lifecycle. Full suite/build per task; production-bundle browser checks for mobile widths, scrolling, keyboard layout, offline persistence and worker lifecycle. Inspect live schema/RLS/advisors without modifying user records. A real authenticated device-to-device write needs a usable personal session; report any unavailable physical-device or live end-to-end checks honestly.
