# Production release gate

Before changing Android production:

1. Confirm the Vercel project is `signal-x-ppjg`.
2. Confirm the Preview deployment corresponds to the intended Git commit.
3. Verify the changed route in Preview logs.
4. Verify Android navigation on the Preview/candidate build where applicable.
5. Merge only after checks pass.
6. Confirm the new Production deployment in `signal-x-ppjg` and keep the last known-good deployment available for rollback.

Do not use the separate `signal-x` project as proof that Android production is healthy.
