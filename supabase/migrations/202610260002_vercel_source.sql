-- Mercury public-frontend data reconstruction / additive source-preserving import.
-- Source asset SHA-256: 4e1ec38630b41010012b596acd088bae5645c1f6433fc6d8496641d30d0d1085
-- 69 source datasets + one calculated position valuation dataset + two control tables.
-- No financial seed values or secrets in this DDL. No drop/delete/truncate.
begin;
create table if not exists public.mercury_v1_imports (
 id text primary key, source_url text not null, asset_sha256 text not null, as_of date not null,
 data_mode text not null check(data_mode='mock'), status text not null check(status in ('importing','complete','failed')),
 expected_datasets integer not null, expected_records integer not null, verified_records integer not null default 0,
 started_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.mercury_v1_datasets (
 import_id text not null references public.mercury_v1_imports(id), name text not null, table_name text not null, origin text not null,
 expected_records integer not null, verified_records integer not null default 0, payload_sha256 text not null,
 primary key(import_id,name)
);
create table if not exists public."mercury_v1_country" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "iso_code" text not null,
  "iso3" text not null,
  "name" text not null,
  "region" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_currency" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "iso_code" text not null,
  "name" text not null,
  "symbol" text not null,
  "is_reporting_eligible" boolean not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_exchange" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "mic_code" text not null,
  "name" text not null,
  "country_id" text not null,
  "timezone" text not null,
  "settlement_cycle" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_access_route" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "code" text not null,
  "label" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_instrument_type" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "code" text not null,
  "label" text not null,
  "category" text not null,
  "has_lookthrough" boolean not null,
  "has_legs" boolean not null,
  "detail_shape" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_issuer" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "name" text not null,
  "type" text not null,
  "country_id" text not null,
  "lei" text not null,
  "credit_rating" text not null,
  "parent_issuer_id" text,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_risk_profile" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "level" numeric not null,
  "code" text not null,
  "label" text not null,
  "description" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_classification_dimension" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "code" text not null,
  "name" text not null,
  "scheme" text not null,
  "is_hierarchical" boolean not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_classification_value" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "dimension_id" text not null,
  "code" text not null,
  "label" text not null,
  "parent_value_id" text,
  "level" numeric not null,
  "sort_order" numeric not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_transaction_type" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "code" text not null,
  "label" text not null,
  "category" text not null,
  "cash_flow_sign" text not null,
  "affects_position" boolean not null,
  "affects_cash" boolean not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_fee_type" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "code" text not null,
  "label" text not null,
  "default_basis" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_benchmark" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "code" text not null,
  "name" text not null,
  "type" text not null,
  "currency_id" text not null,
  "provider" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_benchmark_component" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "benchmark_id" text not null,
  "component_index_id" text not null,
  "weight" numeric not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_role" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "code" text not null,
  "name" text not null,
  "description" text not null,
  "scope" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_fx_rate" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "base_currency_id" text not null,
  "quote_currency_id" text not null,
  "rate" numeric not null,
  "date" date not null,
  "source" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_instrument" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "type_id" text not null,
  "name" text not null,
  "short_name" text not null,
  "primary_isin" text,
  "primary_ticker" text not null,
  "exchange_id" text,
  "access_route_id" text not null,
  "currency_id" text not null,
  "issuer_id" text,
  "min_lot_size" numeric not null,
  "status" text not null,
  "product_risk_rating" numeric not null,
  "risk_rating_scale" text not null,
  "is_cies_permissible" boolean not null,
  "cies_asset_category" text not null,
  "esg_score" numeric,
  "last_price" jsonb not null,
  "last_price_amount" numeric generated always as (("last_price"->>'amount')::numeric) stored,
  "last_price_currency" text generated always as ("last_price"->>'currency') stored,
  "last_price_at" timestamptz not null,
  "factsheet_document_id" jsonb,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_instrument_identifier" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "instrument_id" text not null,
  "scheme" text not null,
  "value" text not null,
  "is_primary" boolean not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_bond_detail" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "instrument_id" text not null,
  "coupon_rate" numeric not null,
  "coupon_frequency" text not null,
  "coupon_type" text not null,
  "maturity_date" date not null,
  "face_value" jsonb not null,
  "face_value_amount" numeric generated always as (("face_value"->>'amount')::numeric) stored,
  "face_value_currency" text generated always as ("face_value"->>'currency') stored,
  "issue_date" date not null,
  "seniority" text not null,
  "credit_rating" text not null,
  "callable" boolean not null,
  "next_call_date" date,
  "is_dim_sum" boolean not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"instrument_id")
);
create table if not exists public."mercury_v1_structured_product_detail" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "instrument_id" text not null,
  "product_type" text not null,
  "underlying_ref" text not null,
  "strike_pct" numeric not null,
  "barrier_pct" numeric not null,
  "barrier_type" text not null,
  "capital_protection_pct" numeric not null,
  "coupon_condition" text not null,
  "participation_rate" numeric not null,
  "issuer_credit_id" text not null,
  "maturity_date" date not null,
  "payoff_type" text not null,
  "trade_date" date not null,
  "issue_date" date not null,
  "settlement_type" text not null,
  "coupon_kind" text,
  "coupon_per_annum_pct" numeric,
  "coupon_barrier_pct" numeric,
  "coupon_memory" boolean not null,
  "pro_rata_on_call" boolean not null,
  "autocall_style" text,
  "autocall_level_pct" numeric,
  "autocall_window_start" date,
  "autocall_window_end" date,
  "knock_in_barrier_pct" numeric,
  "knock_in_style" text,
  "accum_direction" text,
  "accum_ko_barrier_pct" numeric,
  "accum_ko_direction" text,
  "accum_shares_per_day" numeric,
  "accum_gearing" numeric,
  "accum_guaranteed_periods" numeric,
  "accum_settlement_frequency" text,
  primary key(_import_id,_record_key),
  unique(_import_id,"instrument_id")
);
create table if not exists public."mercury_v1_fund_detail" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "instrument_id" text not null,
  "fund_type" text not null,
  "strategy" text not null,
  "nav" jsonb not null,
  "nav_amount" numeric generated always as (("nav"->>'amount')::numeric) stored,
  "nav_currency" text generated always as ("nav"->>'currency') stored,
  "nav_date" date not null,
  "expense_ratio" numeric not null,
  "aum" jsonb not null,
  "aum_amount" numeric generated always as (("aum"->>'amount')::numeric) stored,
  "aum_currency" text generated always as ("aum"->>'currency') stored,
  "domicile_country_id" text not null,
  "ucits" boolean not null,
  "replication_method" text not null,
  "tracked_index_id" text not null,
  "distribution_policy" text not null,
  "sfc_authorized" boolean not null,
  "manager_issuer_id" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"instrument_id")
);
create table if not exists public."mercury_v1_equity_detail" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "instrument_id" text not null,
  "sub_type" text not null,
  "shares_outstanding" numeric not null,
  "dividend_yield" numeric not null,
  "pe_ratio" numeric not null,
  "beta" numeric not null,
  "gics_sector_ref" text not null,
  "is_stock_connect_eligible" boolean not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"instrument_id")
);
create table if not exists public."mercury_v1_reit_detail" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "instrument_id" text not null,
  "property_type" text not null,
  "occupancy_rate" numeric not null,
  "distribution_yield" numeric not null,
  "nav_premium_discount" numeric not null,
  "gearing_ratio" numeric not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"instrument_id")
);
create table if not exists public."mercury_v1_money_market_detail" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "instrument_id" text not null,
  "yield" numeric not null,
  "weighted_avg_maturity" numeric not null,
  "credit_quality" text not null,
  "min_subscription" jsonb not null,
  "min_subscription_amount" numeric generated always as (("min_subscription"->>'amount')::numeric) stored,
  "min_subscription_currency" text generated always as ("min_subscription"->>'currency') stored,
  primary key(_import_id,_record_key),
  unique(_import_id,"instrument_id")
);
create table if not exists public."mercury_v1_commodity_detail" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "instrument_id" text not null,
  "commodity_type" text not null,
  "exposure_method" text not null,
  "unit" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"instrument_id")
);
create table if not exists public."mercury_v1_cash_detail" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "instrument_id" text not null,
  "currency_id" text not null,
  "interest_rate" numeric not null,
  "is_call_deposit" boolean not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"instrument_id")
);
create table if not exists public."mercury_v1_fund_lookthrough" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "fund_instrument_id" text not null,
  "underlying_instrument_id" text not null,
  "underlying_issuer_id" text not null,
  "weight_pct" numeric not null,
  "as_of_date" date not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_structured_leg" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "structured_instrument_id" text not null,
  "leg_type" text not null,
  "description" text not null,
  "notional" jsonb not null,
  "notional_amount" numeric generated always as (("notional"->>'amount')::numeric) stored,
  "notional_currency" text generated always as ("notional"->>'currency') stored,
  "mark_value" jsonb not null,
  "mark_value_amount" numeric generated always as (("mark_value"->>'amount')::numeric) stored,
  "mark_value_currency" text generated always as ("mark_value"->>'currency') stored,
  "delta_exposure" jsonb not null,
  "delta_exposure_amount" numeric generated always as (("delta_exposure"->>'amount')::numeric) stored,
  "delta_exposure_currency" text generated always as ("delta_exposure"->>'currency') stored,
  "underlying_instrument_id" text,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_sp_underlying" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "note_instrument_id" text not null,
  "underlying_instrument_id" text not null,
  "initial_fixing" jsonb not null,
  "initial_fixing_amount" numeric generated always as (("initial_fixing"->>'amount')::numeric) stored,
  "initial_fixing_currency" text generated always as ("initial_fixing"->>'currency') stored,
  "weight" jsonb,
  "strike_pct_override" jsonb,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_sp_observation" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "note_instrument_id" text not null,
  "observation_date" date not null,
  "payment_date" date not null,
  "coupon_rate_pct" numeric,
  "autocall_level_pct" numeric,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_sp_event" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "note_instrument_id" text not null,
  "kind" text not null,
  "date" date not null,
  "underlying_instrument_id" text,
  "settlement" text,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_instrument_classification" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "instrument_id" text not null,
  "classification_value_id" text not null,
  "weight_pct" numeric not null,
  "source" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_price" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "instrument_id" text not null,
  "date" date not null,
  "open" jsonb not null,
  "open_amount" numeric generated always as (("open"->>'amount')::numeric) stored,
  "open_currency" text generated always as ("open"->>'currency') stored,
  "high" jsonb not null,
  "high_amount" numeric generated always as (("high"->>'amount')::numeric) stored,
  "high_currency" text generated always as ("high"->>'currency') stored,
  "low" jsonb not null,
  "low_amount" numeric generated always as (("low"->>'amount')::numeric) stored,
  "low_currency" text generated always as ("low"->>'currency') stored,
  "close" jsonb not null,
  "close_amount" numeric generated always as (("close"->>'amount')::numeric) stored,
  "close_currency" text generated always as ("close"->>'currency') stored,
  "volume" numeric not null,
  "currency_id" text not null,
  "source" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_firm" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "name" text not null,
  "type" text not null,
  "domicile" text not null,
  "base_currency" text not null,
  "regulatory_id" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_team" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "firm_id" text not null,
  "name" text not null,
  "lead_advisor_id" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_advisor" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "team_id" text not null,
  "user_id" text not null,
  "name" text not null,
  "title" text not null,
  "email" text not null,
  "phone" text not null,
  "license_no" text not null,
  "status" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_user" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "firm_id" text not null,
  "name" text not null,
  "email" text not null,
  "role_id" text not null,
  "advisor_id" text,
  "status" text not null,
  "last_login_at" timestamptz not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_custodian" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "name" text not null,
  "type" text not null,
  "bic" text not null,
  "country" text not null,
  "connection_status" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_household" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "advisor_id" text not null,
  "name" text not null,
  "base_currency" text not null,
  "reporting_currency" text not null,
  "segment" text not null,
  "onboarded_at" date not null,
  "status" text not null,
  "last_contact_at" date not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_client" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "household_id" text not null,
  "entity_type" text not null,
  "name" text not null,
  "date_of_birth" date not null,
  "nationality" text not null,
  "tax_residency" text not null,
  "investor_classification" text not null,
  "email" text not null,
  "phone" text not null,
  "is_primary" boolean not null,
  "cies_status" text not null,
  "cies_role" text not null,
  "cies_principal_client_id" text,
  "cies_application_date" date,
  "cies_net_asset_value" jsonb,
  "cies_net_asset_value_amount" numeric generated always as (("cies_net_asset_value"->>'amount')::numeric) stored,
  "cies_net_asset_value_currency" text generated always as ("cies_net_asset_value"->>'currency') stored,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_suitability_profile" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "client_id" text not null,
  "risk_tolerance_id" text not null,
  "risk_capacity" text not null,
  "knowledge_experience" text not null,
  "investment_objective" text not null,
  "time_horizon" text not null,
  "net_worth_band" text not null,
  "income_band" text not null,
  "source_of_wealth" text not null,
  "pi_assessment_status" text,
  "esg_preference" text,
  "assessment_date" date not null,
  "review_due_date" date not null,
  "status" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_account" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "household_id" text not null,
  "custodian_id" text not null,
  "primary_owner_client_id" text not null,
  "account_number" text not null,
  "type" text not null,
  "base_currency" text not null,
  "opened_at" date not null,
  "status" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_account_owner" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "account_id" text not null,
  "client_id" text not null,
  "ownership_type" text not null,
  "ownership_pct" jsonb,
  "is_primary" boolean not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_portfolio" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "account_id" text not null,
  "mandate_id" text not null,
  "name" text not null,
  "base_currency" text not null,
  "inception_date" date not null,
  "mandate_type" text not null,
  "benchmark_id" text,
  "last_rebalance_at" date not null,
  "cost_relief_method" text not null,
  "status" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_sleeve" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "portfolio_id" text not null,
  "name" text not null,
  "strategy_tag" text,
  "is_default" boolean not null,
  "target_weight" numeric,
  "sort_order" numeric not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_mandate" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "reference" text not null,
  "type" text not null,
  "discretion_level" text,
  "status" text not null,
  "signed_by_client_id" text not null,
  "base_currency" text not null,
  "benchmark_id" text not null,
  "management_fee_rate" numeric not null,
  "performance_fee_rate" numeric,
  "performance_fee_hurdle" numeric,
  "start_date" date not null,
  "review_date" date not null,
  "end_date" date not null,
  "document_id" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_ips" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "mandate_id" text not null,
  "version" text not null,
  "status" text not null,
  "objective" text not null,
  "risk_profile_id" text not null,
  "time_horizon" text not null,
  "liquidity_needs" text not null,
  "target_set_id" text not null,
  "rebalance_frequency" text not null,
  "effective_date" date not null,
  "review_due_date" date not null,
  "special_instructions" text,
  "created_by_advisor_id" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_target_set" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "kind" text not null,
  "name" text not null,
  "model_version" text not null,
  "firm_id" text not null,
  "risk_profile_id" text not null,
  "is_active" boolean not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_allocation_target" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "target_set_id" text not null,
  "asset_class" text not null,
  "sub_class" jsonb,
  "target_pct" numeric not null,
  "min_pct" numeric not null,
  "max_pct" numeric not null,
  "sort_order" numeric not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_constraint" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "ips_id" text not null,
  "type" text not null,
  "scope" text not null,
  "scope_ref" text,
  "operator" text not null,
  "threshold_pct" numeric,
  "threshold_value" jsonb,
  "enforcement" text not null,
  "breach_action" text not null,
  "is_active" boolean not null,
  "rationale" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_position" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "portfolio_id" text not null,
  "sleeve_id" text not null,
  "instrument_id" text not null,
  "quantity" numeric not null,
  "average_cost" jsonb not null,
  "average_cost_amount" numeric generated always as (("average_cost"->>'amount')::numeric) stored,
  "average_cost_currency" text generated always as ("average_cost"->>'currency') stored,
  "cost_currency" text not null,
  "valued_at" date not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_tax_lot" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "position_id" text not null,
  "instrument_id" text not null,
  "portfolio_id" text not null,
  "open_transaction_id" text,
  "acquisition_date" date not null,
  "original_quantity" numeric not null,
  "remaining_quantity" numeric not null,
  "cost_per_unit" jsonb not null,
  "cost_per_unit_amount" numeric generated always as (("cost_per_unit"->>'amount')::numeric) stored,
  "cost_per_unit_currency" text generated always as ("cost_per_unit"->>'currency') stored,
  "total_cost_basis" jsonb not null,
  "total_cost_basis_amount" numeric generated always as (("total_cost_basis"->>'amount')::numeric) stored,
  "total_cost_basis_currency" text generated always as ("total_cost_basis"->>'currency') stored,
  "cost_currency_id" text not null,
  "status" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_transaction" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "portfolio_id" text not null,
  "account_id" text not null,
  "instrument_id" text,
  "type_id" text not null,
  "trade_date" date not null,
  "settlement_date" date not null,
  "quantity" numeric,
  "price" jsonb,
  "price_amount" numeric generated always as (("price"->>'amount')::numeric) stored,
  "price_currency" text generated always as ("price"->>'currency') stored,
  "gross_amount" jsonb not null,
  "gross_amount_amount" numeric generated always as (("gross_amount"->>'amount')::numeric) stored,
  "gross_amount_currency" text generated always as ("gross_amount"->>'currency') stored,
  "net_amount" jsonb not null,
  "net_amount_amount" numeric generated always as (("net_amount"->>'amount')::numeric) stored,
  "net_amount_currency" text generated always as ("net_amount"->>'currency') stored,
  "fees_total" jsonb not null,
  "fees_total_amount" numeric generated always as (("fees_total"->>'amount')::numeric) stored,
  "fees_total_currency" text generated always as ("fees_total"->>'currency') stored,
  "currency_id" text not null,
  "fx_rate" numeric not null,
  "amount_base" jsonb not null,
  "amount_base_amount" numeric generated always as (("amount_base"->>'amount')::numeric) stored,
  "amount_base_currency" text generated always as ("amount_base"->>'currency') stored,
  "order_id" text,
  "corporate_action_id" text,
  "counterparty" text,
  "status" text not null,
  "narrative" text not null,
  "source" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_order" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "portfolio_id" text not null,
  "account_id" text not null,
  "instrument_id" text not null,
  "advisor_id" text not null,
  "proposal_id" text,
  "rebalance_id" text,
  "side" text not null,
  "order_type" text not null,
  "quantity" numeric not null,
  "filled_quantity" numeric not null,
  "limit_price" jsonb,
  "limit_price_amount" numeric generated always as (("limit_price"->>'amount')::numeric) stored,
  "limit_price_currency" text generated always as ("limit_price"->>'currency') stored,
  "average_fill_price" jsonb,
  "average_fill_price_amount" numeric generated always as (("average_fill_price"->>'amount')::numeric) stored,
  "average_fill_price_currency" text generated always as ("average_fill_price"->>'currency') stored,
  "time_in_force" text not null,
  "status" text not null,
  "currency_id" text not null,
  "estimated_amount" jsonb not null,
  "estimated_amount_amount" numeric generated always as (("estimated_amount"->>'amount')::numeric) stored,
  "estimated_amount_currency" text generated always as ("estimated_amount"->>'currency') stored,
  "placed_at" timestamptz not null,
  "executed_at" timestamptz,
  "venue" text not null,
  "execution_transaction_id" text,
  "status_reason" text,
  "placed_by" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_cash_flow" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "portfolio_id" text not null,
  "account_id" text not null,
  "instrument_id" text not null,
  "type" text not null,
  "status" text not null,
  "ex_date" date not null,
  "record_date" date not null,
  "pay_date" date not null,
  "per_unit_amount" jsonb not null,
  "per_unit_amount_amount" numeric generated always as (("per_unit_amount"->>'amount')::numeric) stored,
  "per_unit_amount_currency" text generated always as ("per_unit_amount"->>'currency') stored,
  "amount" jsonb not null,
  "amount_amount" numeric generated always as (("amount"->>'amount')::numeric) stored,
  "amount_currency" text generated always as ("amount"->>'currency') stored,
  "amount_base" jsonb not null,
  "amount_base_amount" numeric generated always as (("amount_base"->>'amount')::numeric) stored,
  "amount_base_currency" text generated always as ("amount_base"->>'currency') stored,
  "currency_id" text not null,
  "transaction_id" text,
  "source" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_fee" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "portfolio_id" text not null,
  "account_id" text not null,
  "type_id" text not null,
  "calculation_basis" text not null,
  "rate" numeric not null,
  "basis_amount" jsonb not null,
  "basis_amount_amount" numeric generated always as (("basis_amount"->>'amount')::numeric) stored,
  "basis_amount_currency" text generated always as ("basis_amount"->>'currency') stored,
  "amount" jsonb not null,
  "amount_amount" numeric generated always as (("amount"->>'amount')::numeric) stored,
  "amount_currency" text generated always as ("amount"->>'currency') stored,
  "amount_base" jsonb not null,
  "amount_base_amount" numeric generated always as (("amount_base"->>'amount')::numeric) stored,
  "amount_base_currency" text generated always as ("amount_base"->>'currency') stored,
  "currency_id" text not null,
  "period_start" date not null,
  "period_end" date not null,
  "accrual_date" date not null,
  "charge_date" date,
  "high_water_mark" jsonb,
  "hurdle_rate" jsonb,
  "status" text not null,
  "transaction_id" text,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_corporate_action" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "instrument_id" text not null,
  "type" text not null,
  "ex_date" date not null,
  "pay_date" date not null,
  "ratio_or_terms" text not null,
  "value" jsonb,
  "value_amount" numeric generated always as (("value"->>'amount')::numeric) stored,
  "value_currency" text generated always as ("value"->>'currency') stored,
  "currency_id" text,
  "status" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_tax_lot_closure" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "sell_transaction_id" text not null,
  "tax_lot_id" text not null,
  "quantity_closed" numeric not null,
  "proceeds" jsonb not null,
  "proceeds_amount" numeric generated always as (("proceeds"->>'amount')::numeric) stored,
  "proceeds_currency" text generated always as ("proceeds"->>'currency') stored,
  "cost_relieved" jsonb not null,
  "cost_relieved_amount" numeric generated always as (("cost_relieved"->>'amount')::numeric) stored,
  "cost_relieved_currency" text generated always as ("cost_relieved"->>'currency') stored,
  "realized_gain" jsonb not null,
  "realized_gain_amount" numeric generated always as (("realized_gain"->>'amount')::numeric) stored,
  "realized_gain_currency" text generated always as ("realized_gain"->>'currency') stored,
  "term" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_proposal" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "portfolio_id" text not null,
  "advisor_id" text not null,
  "reference" text not null,
  "title" text not null,
  "objective" text not null,
  "trigger" text not null,
  "status" text not null,
  "mandate_type" text not null,
  "current_version_id" text not null,
  "accepted_version_id" text,
  "target_set_id" text not null,
  "created_at" timestamptz not null,
  "sent_at" timestamptz,
  "decided_at" timestamptz,
  "expires_at" timestamptz,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_proposal_version" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "proposal_id" text not null,
  "version_no" numeric not null,
  "status" text not null,
  "rationale" text not null,
  "pre_allocation" jsonb not null,
  "post_allocation" jsonb not null,
  "projected_risk_score" numeric not null,
  "created_by_advisor_id" text not null,
  "created_at" timestamptz not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_proposal_line" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "proposal_version_id" text not null,
  "instrument_id" text not null,
  "action" text not null,
  "quantity" numeric not null,
  "estimated_price" jsonb not null,
  "estimated_price_amount" numeric generated always as (("estimated_price"->>'amount')::numeric) stored,
  "estimated_price_currency" text generated always as ("estimated_price"->>'currency') stored,
  "estimated_amount" jsonb not null,
  "estimated_amount_amount" numeric generated always as (("estimated_amount"->>'amount')::numeric) stored,
  "estimated_amount_currency" text generated always as ("estimated_amount"->>'currency') stored,
  "amount_base" jsonb not null,
  "amount_base_amount" numeric generated always as (("amount_base"->>'amount')::numeric) stored,
  "amount_base_currency" text generated always as ("amount_base"->>'currency') stored,
  "current_weight" numeric not null,
  "proposed_weight" numeric not null,
  "estimated_fees" jsonb not null,
  "estimated_fees_amount" numeric generated always as (("estimated_fees"->>'amount')::numeric) stored,
  "estimated_fees_currency" text generated always as ("estimated_fees"->>'currency') stored,
  "rationale" text not null,
  "constraint_breach" boolean not null,
  "breach_detail" text,
  "switch_pair_id" text,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_proposal_comment" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "proposal_id" text not null,
  "proposal_version_id" text not null,
  "author_type" text not null,
  "author_id" text not null,
  "body" text not null,
  "created_at" timestamptz not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_approval" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "proposal_id" text not null,
  "proposal_version_id" text not null,
  "decision" text not null,
  "approved_by_client_id" text not null,
  "method" text not null,
  "decision_at" timestamptz not null,
  "reference" text not null,
  "note" text,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_rebalance" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "proposal_id" text,
  "portfolio_id" text not null,
  "initiated_by_advisor_id" text not null,
  "type" text not null,
  "status" text not null,
  "executed_at" timestamptz not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_copilot_insight" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "portfolio_id" text not null,
  "proposal_id" text,
  "category" text not null,
  "title" text not null,
  "insight_text" text not null,
  "suggested_target_set_id" text,
  "confidence" text not null,
  "estimated_impact" text not null,
  "status" text not null,
  "generated_at" timestamptz not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_prospect" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "advisor_id" text not null,
  "name" text not null,
  "type" text not null,
  "source" text not null,
  "stage" text not null,
  "estimated_aum" jsonb not null,
  "estimated_aum_amount" numeric generated always as (("estimated_aum"->>'amount')::numeric) stored,
  "estimated_aum_currency" text generated always as ("estimated_aum"->>'currency') stored,
  "expected_close_date" date not null,
  "converted_household_id" jsonb,
  "lost_reason" text,
  "created_at" timestamptz not null,
  "last_activity_at" timestamptz not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_interaction" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "subject_type" text not null,
  "subject_id" text not null,
  "advisor_id" text not null,
  "type" text not null,
  "summary" text not null,
  "body" text,
  "occurred_at" timestamptz not null,
  "follow_up_task_id" text,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_task" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "advisor_id" text not null,
  "subject_type" text not null,
  "subject_id" text not null,
  "title" text not null,
  "category" text not null,
  "priority" text not null,
  "status" text not null,
  "source" text not null,
  "due_date" date not null,
  "created_at" timestamptz not null,
  "completed_at" timestamptz,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_document" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "subject_type" text not null,
  "subject_id" text not null,
  "type" text not null,
  "title" text not null,
  "period" text,
  "status" text not null,
  "format" text not null,
  "file_ref" text not null,
  "generated_at" timestamptz not null,
  "generated_by" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_audit_log" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "user_id" text not null,
  "action" text not null,
  "entity_type" text not null,
  "entity_id" text not null,
  "summary" text not null,
  "before" jsonb,
  "after" jsonb,
  "occurred_at" timestamptz not null,
  "ip_or_session" text not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
create table if not exists public."mercury_v1_position_valuation" (
  _import_id text not null references public.mercury_v1_imports(id),
  _record_key text not null,
  _source_sha256 text not null check (_source_sha256 ~ '^[a-f0-9]{64}$'),
  _source_json jsonb not null,
  "id" text not null,
  "portfolio_id" text not null,
  "sleeve_id" text not null,
  "instrument_id" text not null,
  "quantity" numeric not null,
  "average_cost" jsonb not null,
  "average_cost_amount" numeric generated always as (("average_cost"->>'amount')::numeric) stored,
  "average_cost_currency" text generated always as ("average_cost"->>'currency') stored,
  "cost_currency" text not null,
  "valued_at" date not null,
  "market_value" jsonb not null,
  "market_value_amount" numeric generated always as (("market_value"->>'amount')::numeric) stored,
  "market_value_currency" text generated always as ("market_value"->>'currency') stored,
  "market_value_base" jsonb not null,
  "market_value_base_amount" numeric generated always as (("market_value_base"->>'amount')::numeric) stored,
  "market_value_base_currency" text generated always as ("market_value_base"->>'currency') stored,
  "unrealized_pnl" jsonb not null,
  "unrealized_pnl_amount" numeric generated always as (("unrealized_pnl"->>'amount')::numeric) stored,
  "unrealized_pnl_currency" text generated always as ("unrealized_pnl"->>'currency') stored,
  "unrealized_pnl_pct" numeric not null,
  primary key(_import_id,_record_key),
  unique(_import_id,"id")
);
alter table public."mercury_v1_imports" enable row level security;
revoke all on table public."mercury_v1_imports" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_imports" to service_role;
alter table public."mercury_v1_datasets" enable row level security;
revoke all on table public."mercury_v1_datasets" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_datasets" to service_role;
alter table public."mercury_v1_country" enable row level security;
revoke all on table public."mercury_v1_country" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_country" to service_role;
alter table public."mercury_v1_currency" enable row level security;
revoke all on table public."mercury_v1_currency" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_currency" to service_role;
alter table public."mercury_v1_exchange" enable row level security;
revoke all on table public."mercury_v1_exchange" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_exchange" to service_role;
alter table public."mercury_v1_access_route" enable row level security;
revoke all on table public."mercury_v1_access_route" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_access_route" to service_role;
alter table public."mercury_v1_instrument_type" enable row level security;
revoke all on table public."mercury_v1_instrument_type" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_instrument_type" to service_role;
alter table public."mercury_v1_issuer" enable row level security;
revoke all on table public."mercury_v1_issuer" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_issuer" to service_role;
alter table public."mercury_v1_risk_profile" enable row level security;
revoke all on table public."mercury_v1_risk_profile" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_risk_profile" to service_role;
alter table public."mercury_v1_classification_dimension" enable row level security;
revoke all on table public."mercury_v1_classification_dimension" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_classification_dimension" to service_role;
alter table public."mercury_v1_classification_value" enable row level security;
revoke all on table public."mercury_v1_classification_value" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_classification_value" to service_role;
alter table public."mercury_v1_transaction_type" enable row level security;
revoke all on table public."mercury_v1_transaction_type" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_transaction_type" to service_role;
alter table public."mercury_v1_fee_type" enable row level security;
revoke all on table public."mercury_v1_fee_type" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_fee_type" to service_role;
alter table public."mercury_v1_benchmark" enable row level security;
revoke all on table public."mercury_v1_benchmark" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_benchmark" to service_role;
alter table public."mercury_v1_benchmark_component" enable row level security;
revoke all on table public."mercury_v1_benchmark_component" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_benchmark_component" to service_role;
alter table public."mercury_v1_role" enable row level security;
revoke all on table public."mercury_v1_role" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_role" to service_role;
alter table public."mercury_v1_fx_rate" enable row level security;
revoke all on table public."mercury_v1_fx_rate" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_fx_rate" to service_role;
alter table public."mercury_v1_instrument" enable row level security;
revoke all on table public."mercury_v1_instrument" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_instrument" to service_role;
alter table public."mercury_v1_instrument_identifier" enable row level security;
revoke all on table public."mercury_v1_instrument_identifier" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_instrument_identifier" to service_role;
alter table public."mercury_v1_bond_detail" enable row level security;
revoke all on table public."mercury_v1_bond_detail" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_bond_detail" to service_role;
alter table public."mercury_v1_structured_product_detail" enable row level security;
revoke all on table public."mercury_v1_structured_product_detail" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_structured_product_detail" to service_role;
alter table public."mercury_v1_fund_detail" enable row level security;
revoke all on table public."mercury_v1_fund_detail" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_fund_detail" to service_role;
alter table public."mercury_v1_equity_detail" enable row level security;
revoke all on table public."mercury_v1_equity_detail" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_equity_detail" to service_role;
alter table public."mercury_v1_reit_detail" enable row level security;
revoke all on table public."mercury_v1_reit_detail" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_reit_detail" to service_role;
alter table public."mercury_v1_money_market_detail" enable row level security;
revoke all on table public."mercury_v1_money_market_detail" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_money_market_detail" to service_role;
alter table public."mercury_v1_commodity_detail" enable row level security;
revoke all on table public."mercury_v1_commodity_detail" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_commodity_detail" to service_role;
alter table public."mercury_v1_cash_detail" enable row level security;
revoke all on table public."mercury_v1_cash_detail" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_cash_detail" to service_role;
alter table public."mercury_v1_fund_lookthrough" enable row level security;
revoke all on table public."mercury_v1_fund_lookthrough" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_fund_lookthrough" to service_role;
alter table public."mercury_v1_structured_leg" enable row level security;
revoke all on table public."mercury_v1_structured_leg" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_structured_leg" to service_role;
alter table public."mercury_v1_sp_underlying" enable row level security;
revoke all on table public."mercury_v1_sp_underlying" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_sp_underlying" to service_role;
alter table public."mercury_v1_sp_observation" enable row level security;
revoke all on table public."mercury_v1_sp_observation" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_sp_observation" to service_role;
alter table public."mercury_v1_sp_event" enable row level security;
revoke all on table public."mercury_v1_sp_event" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_sp_event" to service_role;
alter table public."mercury_v1_instrument_classification" enable row level security;
revoke all on table public."mercury_v1_instrument_classification" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_instrument_classification" to service_role;
alter table public."mercury_v1_price" enable row level security;
revoke all on table public."mercury_v1_price" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_price" to service_role;
alter table public."mercury_v1_firm" enable row level security;
revoke all on table public."mercury_v1_firm" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_firm" to service_role;
alter table public."mercury_v1_team" enable row level security;
revoke all on table public."mercury_v1_team" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_team" to service_role;
alter table public."mercury_v1_advisor" enable row level security;
revoke all on table public."mercury_v1_advisor" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_advisor" to service_role;
alter table public."mercury_v1_user" enable row level security;
revoke all on table public."mercury_v1_user" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_user" to service_role;
alter table public."mercury_v1_custodian" enable row level security;
revoke all on table public."mercury_v1_custodian" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_custodian" to service_role;
alter table public."mercury_v1_household" enable row level security;
revoke all on table public."mercury_v1_household" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_household" to service_role;
alter table public."mercury_v1_client" enable row level security;
revoke all on table public."mercury_v1_client" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_client" to service_role;
alter table public."mercury_v1_suitability_profile" enable row level security;
revoke all on table public."mercury_v1_suitability_profile" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_suitability_profile" to service_role;
alter table public."mercury_v1_account" enable row level security;
revoke all on table public."mercury_v1_account" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_account" to service_role;
alter table public."mercury_v1_account_owner" enable row level security;
revoke all on table public."mercury_v1_account_owner" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_account_owner" to service_role;
alter table public."mercury_v1_portfolio" enable row level security;
revoke all on table public."mercury_v1_portfolio" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_portfolio" to service_role;
alter table public."mercury_v1_sleeve" enable row level security;
revoke all on table public."mercury_v1_sleeve" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_sleeve" to service_role;
alter table public."mercury_v1_mandate" enable row level security;
revoke all on table public."mercury_v1_mandate" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_mandate" to service_role;
alter table public."mercury_v1_ips" enable row level security;
revoke all on table public."mercury_v1_ips" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_ips" to service_role;
alter table public."mercury_v1_target_set" enable row level security;
revoke all on table public."mercury_v1_target_set" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_target_set" to service_role;
alter table public."mercury_v1_allocation_target" enable row level security;
revoke all on table public."mercury_v1_allocation_target" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_allocation_target" to service_role;
alter table public."mercury_v1_constraint" enable row level security;
revoke all on table public."mercury_v1_constraint" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_constraint" to service_role;
alter table public."mercury_v1_position" enable row level security;
revoke all on table public."mercury_v1_position" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_position" to service_role;
alter table public."mercury_v1_tax_lot" enable row level security;
revoke all on table public."mercury_v1_tax_lot" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_tax_lot" to service_role;
alter table public."mercury_v1_transaction" enable row level security;
revoke all on table public."mercury_v1_transaction" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_transaction" to service_role;
alter table public."mercury_v1_order" enable row level security;
revoke all on table public."mercury_v1_order" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_order" to service_role;
alter table public."mercury_v1_cash_flow" enable row level security;
revoke all on table public."mercury_v1_cash_flow" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_cash_flow" to service_role;
alter table public."mercury_v1_fee" enable row level security;
revoke all on table public."mercury_v1_fee" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_fee" to service_role;
alter table public."mercury_v1_corporate_action" enable row level security;
revoke all on table public."mercury_v1_corporate_action" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_corporate_action" to service_role;
alter table public."mercury_v1_tax_lot_closure" enable row level security;
revoke all on table public."mercury_v1_tax_lot_closure" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_tax_lot_closure" to service_role;
alter table public."mercury_v1_proposal" enable row level security;
revoke all on table public."mercury_v1_proposal" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_proposal" to service_role;
alter table public."mercury_v1_proposal_version" enable row level security;
revoke all on table public."mercury_v1_proposal_version" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_proposal_version" to service_role;
alter table public."mercury_v1_proposal_line" enable row level security;
revoke all on table public."mercury_v1_proposal_line" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_proposal_line" to service_role;
alter table public."mercury_v1_proposal_comment" enable row level security;
revoke all on table public."mercury_v1_proposal_comment" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_proposal_comment" to service_role;
alter table public."mercury_v1_approval" enable row level security;
revoke all on table public."mercury_v1_approval" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_approval" to service_role;
alter table public."mercury_v1_rebalance" enable row level security;
revoke all on table public."mercury_v1_rebalance" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_rebalance" to service_role;
alter table public."mercury_v1_copilot_insight" enable row level security;
revoke all on table public."mercury_v1_copilot_insight" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_copilot_insight" to service_role;
alter table public."mercury_v1_prospect" enable row level security;
revoke all on table public."mercury_v1_prospect" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_prospect" to service_role;
alter table public."mercury_v1_interaction" enable row level security;
revoke all on table public."mercury_v1_interaction" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_interaction" to service_role;
alter table public."mercury_v1_task" enable row level security;
revoke all on table public."mercury_v1_task" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_task" to service_role;
alter table public."mercury_v1_document" enable row level security;
revoke all on table public."mercury_v1_document" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_document" to service_role;
alter table public."mercury_v1_audit_log" enable row level security;
revoke all on table public."mercury_v1_audit_log" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_audit_log" to service_role;
alter table public."mercury_v1_position_valuation" enable row level security;
revoke all on table public."mercury_v1_position_valuation" from public, anon, authenticated;
grant select, insert, update, delete on table public."mercury_v1_position_valuation" to service_role;
insert into public.mercury_schema_version(id) values ('202610260002_vercel_v1') on conflict(id) do nothing;
notify pgrst, 'reload schema';
commit;
