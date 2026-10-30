# Supabase foundation — phase 1

Project: `ljrnllkklsumizsxhpwu`. The project reference and HTTPS URL are public identifiers.

## User setup

1. Open `outputs/Mercury Supabase Setup.html`, copy the SQL, and run it in this project's Supabase SQL Editor.
2. In Settings > API Keys, obtain a server secret key (`sb_secret_...`).
3. Open `outputs/Configure Mercury Database.command` and paste it into the hidden local dialog.

The command saves `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the existing `.env.local` with file permissions 0600, preserving all Gemini/Laya settings. The key is never placed in CLI arguments, logs, the HTML, or a `NEXT_PUBLIC_` variable. New Supabase secret keys go in the `apikey` header, not a bearer JWT. Credentials are sent only to the exact configured Mercury HTTPS project host and redirects are refused.

Verification is read-only. It checks the migration marker and access to 14 table key columns without fetching client rows. Results appear in `outputs/Mercury Supabase Connection Status.json`. A missing schema and a rejected key have distinct statuses. To recheck without entering a key, run `python3 scripts/configure-supabase.py --check` from the project directory.

## What this phase implements

The canonical migration is `supabase/migrations/202610260001_mercury_core.sql`. `outputs/Mercury Supabase Setup.sql` is an identical delivery copy.

There are 13 logical core entities: FIRM, HOUSEHOLD, CLIENT, CUSTODIAN, ACCOUNT, ACCOUNT_OWNER, PORTFOLIO, INSTRUMENT, POSITION, STRUCTURED_PRODUCT_DETAIL, SP_UNDERLYING, SP_OBSERVATION and SP_EVENT. Physical names use the `public.mercury_` prefix. A fourteenth technical table records the installation version. This is a deliberately smaller physical subset of the 94-entity logical V2 design, not a complete translation.

Phase-1 mappings:

- Tenant-scoped objects carry explicit `firm_id` and composite foreign keys to reject cross-firm links.
- Money maps to NUMERIC amount plus three-letter currency. Underlying `initialFixing` maps to `initial_fixing_amount` and `initial_fixing_currency`.
- Position quantities/local currency values may be unknown for aggregated demo holdings; base values are separate and must not be mislabelled as local-currency values.
- Instrument types, currencies and issuer references are temporary scalar references; full reference catalogues and term versions remain a later migration. SP terms are unverified/demo-only and must not drive actual settlement.
- All V1 SP detail fields and the 21 recovered flat fields are represented. `current_term_version_id` is deferred until SP_TERM_VERSION exists.
- Observation schedule and lifecycle event rows are not proof of coupon payment.

## Access and limits

Every table has RLS enabled. PUBLIC, anon and authenticated privileges are revoked on these tables only; there are no permissive policies. The backend service role can access the tables and therefore requires application authorization before any user-facing database endpoint is added.

The migration creates no clients, instruments or financial transactions. It inserts only its version marker. The localhost portal now loads the approved demo snapshot through a session-checked, same-origin backend endpoint. It displays a Supabase source badge and explicitly labels its built-in fallback on database failure. This phase does not add real-user login, market-history ingestion, AI persistence or database reset. Reset remains browser-local and preserves cloud holdings.

## Validation

- Executed the SQL twice in isolated PGlite 0.5.3 (PostgreSQL WASM); 14 tables, one marker, RLS enabled.
- Verified anonymous/authenticated reads are denied and backend reads/writes work.
- Verified cross-tenant links, zero initial fixings and backwards payment dates are rejected; exact decimal values round-trip.
- Node connection tests use mocked responses and synthetic credentials; Python tests confirm private storage and preservation of existing AI settings.
- Supabase's gateway, hosted PostgreSQL version and actual credentials still require a live check after user setup. No cloud migration was executed by this preparation work.

References: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Connected portfolio milestone — 26 October 2026

The user installed the SQL and saved the secret locally. A fresh hosted check confirmed all 14 core tables. `scripts/seed-supabase.ts --apply` inserted 32 fictional records in nine tables, then joined eight holdings totalling USD 8,420,000. There are no inserted SP terms, observations or events in this milestone.

The seed uses fixed `mw_demo_` identifiers, preflights all existing rows, inserts missing rows only and refuses conflicting values. A partial insertion is safe to retry; no deletes or updates are issued. This immutable 24 October snapshot intentionally matches the existing static historical chart, cashflow examples and AI narrative facts. Modified or incomplete database rows fail closed to an explicitly labelled built-in sample; arbitrary edited portfolios are not supported yet. Instrument asset-class classification remains the approved snapshot mapping until the full catalogue is added.

The secret remains server-only. `/api/portfolio` accepts only a signed localhost session and same-origin application request, ignores user-selected tenant IDs, and exposes only this fictional snapshot. This is not production client authentication.

Validated: 70 unit tests; hosted portfolio read; filters and ownership joins; reporting-currency conversion; unsigned/cross-origin rejection; outage fallback/recovery; browser reset preserving cloud data; phone layout and existing live-AI controls. See `outputs/Mercury Supabase Portal Verification.json`.
