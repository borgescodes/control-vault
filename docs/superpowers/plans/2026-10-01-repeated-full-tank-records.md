# Repeated full-tank records

Route: Sol / Extra high. The environment cannot switch the operator setting.
Use Superpowers systematic debugging, TDD and verification; Ponytail full.

Production contains two independently created full-tank records with different
IDs and timestamps, but identical mileage, amount, liters and ANP metadata.
Sync already upserts by stable ID. The missing protection is semantic duplicate
validation at creation, plus a synchronous form submission guard.

1. Add failing regression tests for repeated/concurrent full submissions and
   presentation/totals of existing duplicates. Preserve legitimate partial fills.
2. Add one shared canonical fuel-entry helper. Use it in history and dashboard.
3. Expose existing fuel rows to the validation callback inside the existing
   atomic fuel/reading transaction. Reject repeated full entries there.
4. Guard overlapping form submissions with a ref; no schema/sync changes or deletes.
5. Run all tests/build, review, commit, publish and verify the personal history.
