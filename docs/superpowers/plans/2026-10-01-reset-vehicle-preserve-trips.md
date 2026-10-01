# Reset vehicle records, preserve trips

User explicitly requested removal of all current vehicle setup, odometer and
fuel data, keeping saved trips, followed by merge/publication on main.
Route: Sol / Extra high; operator routing cannot be changed by this environment.

Reset cutoff: 2026-10-01T21:25:39.000Z. Records created after this instant must
survive a delayed local database upgrade.

1. Keep an ignored local recovery copy of the remote records.
2. Test a one-time IndexedDB version upgrade that deletes pre-cutoff vehicle,
   fuel and odometer data but preserves saved trips, owner and post-cutoff data.
3. Implement the migration, run all tests/build and review.
4. Stop the active old browser client; remove pre-cutoff remote vehicle records
   in one transaction, retaining saved_trips unchanged; verify counts.
5. Commit/publish on main, update the PWA and verify the initial setup screen and
   all three saved trips in local/remote storage.
