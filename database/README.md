# Click Postgres

Click uses PostgreSQL as the application database. Keep all user-facing state here:
profiles, merchants, events, RSVPs, waitlists, bookmarks, payments, anonymous Clicks,
mutual Clicks, notifications, tags, and audit logs.

## Run locally

```bash
npm run db:up
```

The first startup runs every SQL file in this directory through Docker's
`/docker-entrypoint-initdb.d` flow.

## Reset local data

```bash
npm run db:reset
```

This deletes the Docker volume, recreates the database, reapplies schema, and
re-seeds sample Click data.

## Open psql

```bash
npm run db:psql
```

## App connection

Set:

```bash
DATABASE_URL=postgres://click:click_dev_password@localhost:5432/click
```

The Next app reads events from Postgres when `DATABASE_URL` is present. If the
database is unavailable, the UI falls back to the static sample data in
`src/lib/click-data.ts`.

## Why this is Postgres

The schema uses relational constraints, ACID transactions, foreign keys,
capacity checks, and triggers for mutual Clicks. Those are primary application
database concerns and should stay in Postgres. ClickHouse can be introduced
later as an analytics warehouse fed by application events.
