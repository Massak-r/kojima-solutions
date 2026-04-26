# Database migrations

Lightweight forward-only migration runner. Each `.sql` file in this directory
is applied once, in lexical order, and recorded in the `migrations` table on
prod. Replaces the previous ad-hoc `database/schema.sql` + one-off
`public/api/migrate_unified.php` pattern.

## Filename convention

```
YYYYMMDDHHMMSS_short_description.sql
```

e.g. `20260426150000_add_user_settings_table.sql`. The timestamp keeps files
in creation order across commits.

## Authoring rules

- Each statement ends with `;` on its own line. The runner splits on
  `;\n` — embedded semicolons inside strings will trip it, so keep statements
  simple.
- Line comments (`-- foo`) are stripped before splitting; block comments
  (`/* … */`) are not — avoid them or keep them on a single line.
- One concern per file. Splitting `add_table` and `seed_data` makes
  rollbacks (a second forward-only migration) easier later.
- Migrations run inside a transaction per file. If any statement fails, the
  whole file rolls back and the runner halts.

## Triggering the run

Admin-only POST to `/api/db_migrate.php`. The HttpOnly admin session cookie
authenticates; no separate auth needed. Example with curl:

```bash
# 1. Login → grab the cookie token
TOKEN=$(curl -s -i -X POST -H 'Content-Type: application/json' \
  -d '{"password":"YOUR_ADMIN_PASSWORD"}' \
  https://kojima-solutions.ch/api/admin_login.php \
  | grep -i '^set-cookie:' | sed 's/.*kojima_admin_session=\([^;]*\).*/\1/')

# 2. Run pending migrations
curl -s -X POST --cookie "kojima_admin_session=$TOKEN" \
  https://kojima-solutions.ch/api/db_migrate.php | jq
```

The response is a JSON list with `{file, status}` per migration:
`skipped` (already applied), `applied`, or `error` (with an `error` field).

## Bootstrap on the existing prod schema

The DB already has every table from the original `database/schema.sql`. On
first run, the runner creates the `migrations` tracking table empty — files
added *after* this commit run as new. The historical schema isn't replayed.

If a schema change is already deployed manually and you want to record it
without re-running, insert the marker by hand:

```sql
INSERT INTO migrations (filename) VALUES ('20260501000000_already_applied.sql');
```

## Rollback

Forward-only — there's no automatic down-migration. Write a new file that
reverses the change instead. Same pattern as Phinx's manual backouts.
