# Current setup estimates and favicon

The production history contains oversized legacy fuel readings from 29 September,
before the current setup on 30 September at 12,483 km. The dashboard incorrectly
includes those records in its operational calculations. Keep the saved history,
spending, formulas, persistence and synchronization unchanged.

Route: Sol / Extra high for the calculation selector; Sol / Medium for favicon.
The current environment cannot switch the operator's model/effort setting.

1. Reproduce the production data with a failing dashboard regression test.
2. Filter the operational fuel input at the current setup timestamp, once in
   the dashboard selector. Keep spending input unfiltered.
3. Reference the existing `public/favicon-main.ico` in HTML and PWA precache.
4. Run all tests and the production build; review, commit and publish.
5. Verify production shows approximately 36.7 km/L, 76 km range, and the requested
   favicon without modifying the user's records.
