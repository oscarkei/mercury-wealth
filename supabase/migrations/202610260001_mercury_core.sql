-- Mercury V2 / phase 1: 13 core entities + 1 schema-version table.
-- Run in the SQL Editor of project ljrnllkklsumizsxhpwu.
-- Additive, transactional and repeatable. Does not import or delete client data.
-- All tables are private to the backend: no anon/authenticated grants or policies.
begin;

create table if not exists public.mercury_firm (
  id text primary key, name text not null,
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  data_mode text not null default 'mock' check (data_mode in ('mock','live')),
  created_at timestamptz not null default now()
);
create table if not exists public.mercury_household (
  id text primary key, firm_id text not null references public.mercury_firm(id),
  name text not null, created_at timestamptz not null default now(), unique(firm_id,id)
);
create table if not exists public.mercury_client (
  id text primary key, firm_id text not null references public.mercury_firm(id),
  household_id text not null, name text not null,
  client_type text not null check (client_type in ('individual','legal_entity')),
  created_at timestamptz not null default now(), unique(firm_id,id),
  foreign key(firm_id,household_id) references public.mercury_household(firm_id,id)
);
create table if not exists public.mercury_custodian (
  id text primary key, name text not null, created_at timestamptz not null default now()
);
create table if not exists public.mercury_account (
  id text primary key, firm_id text not null references public.mercury_firm(id),
  household_id text not null, custodian_id text not null references public.mercury_custodian(id),
  name text not null, base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(), unique(firm_id,id),
  foreign key(firm_id,household_id) references public.mercury_household(firm_id,id)
);
create table if not exists public.mercury_account_owner (
  id text primary key, firm_id text not null references public.mercury_firm(id),
  account_id text not null, client_id text not null, ownership_pct numeric(9,6),
  check (ownership_pct between 0 and 100), unique(account_id,client_id),
  foreign key(firm_id,account_id) references public.mercury_account(firm_id,id),
  foreign key(firm_id,client_id) references public.mercury_client(firm_id,id)
);
create table if not exists public.mercury_portfolio (
  id text primary key, firm_id text not null references public.mercury_firm(id),
  account_id text not null, name text not null,
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(), unique(firm_id,id),
  foreign key(firm_id,account_id) references public.mercury_account(firm_id,id)
);
create table if not exists public.mercury_instrument (
  id text primary key, name text not null,
  instrument_type text not null check (instrument_type in ('equity','bond','fund','cash','structured_product','aggregate','other')),
  currency text not null check (currency ~ '^[A-Z]{3}$'), ticker text,
  data_mode text not null default 'mock' check (data_mode in ('mock','live')),
  created_at timestamptz not null default now()
);
create table if not exists public.mercury_position (
  id text primary key, firm_id text not null references public.mercury_firm(id),
  portfolio_id text not null, instrument_id text not null references public.mercury_instrument(id),
  quantity numeric(28,10), market_value numeric(28,8),
  market_value_currency text check (market_value_currency ~ '^[A-Z]{3}$'),
  market_value_base numeric(28,8) not null,
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  valued_at date not null, source_snapshot text not null,
  data_mode text not null default 'mock' check (data_mode in ('mock','live')),
  foreign key(firm_id,portfolio_id) references public.mercury_portfolio(firm_id,id),
  check ((market_value is null) = (market_value_currency is null)),
  unique(portfolio_id,instrument_id,valued_at,source_snapshot)
);
create table if not exists public.mercury_structured_product_detail (
  instrument_id text primary key references public.mercury_instrument(id),
  product_type text not null, underlying_ref text,
  strike_pct numeric(16,8), barrier_pct numeric(16,8), barrier_type text,
  capital_protection_pct numeric(16,8), autocall_schedule jsonb, coupon_condition text,
  participation_rate numeric(16,8), issuer_credit_id text, maturity_date date, payoff_type text,
  trade_date date, issue_date date, settlement_type text,
  coupon_kind text, coupon_per_annum_pct numeric(16,8), coupon_barrier_pct numeric(16,8),
  coupon_memory boolean, pro_rata_on_call boolean, autocall_style text,
  autocall_level_pct numeric(16,8), autocall_window_start date, autocall_window_end date,
  knock_in_barrier_pct numeric(16,8), knock_in_style text,
  accum_direction text, accum_ko_barrier_pct numeric(16,8), accum_ko_direction text,
  accum_shares_per_day numeric(28,10), accum_gearing numeric(16,8),
  accum_guaranteed_periods integer, accum_settlement_frequency text,
  terms_status text not null default 'unverified' check (terms_status in ('unverified','demo_only')),
  check (strike_pct is null or strike_pct > 0),
  check (capital_protection_pct is null or capital_protection_pct between 0 and 100),
  check (accum_guaranteed_periods is null or accum_guaranteed_periods >= 0),
  check (accum_gearing is null or accum_gearing > 0),
  check (accum_shares_per_day is null or accum_shares_per_day > 0),
  check (maturity_date is null or issue_date is null or maturity_date >= issue_date),
  check (autocall_window_start is null or autocall_window_end is null or autocall_window_end >= autocall_window_start)
);
create table if not exists public.mercury_sp_underlying (
  id text primary key,
  note_instrument_id text not null references public.mercury_structured_product_detail(instrument_id),
  underlying_instrument_id text not null references public.mercury_instrument(id),
  initial_fixing_amount numeric(28,10) not null check (initial_fixing_amount > 0),
  initial_fixing_currency text not null check (initial_fixing_currency ~ '^[A-Z]{3}$'),
  weight numeric(16,8), weight_basis text check (weight_basis in ('ratio','percent')),
  strike_pct_override numeric(16,8) check (strike_pct_override > 0), fixing_date date,
  check ((weight is null) = (weight_basis is null)),
  check (weight is null or (weight_basis='ratio' and weight between 0 and 1) or (weight_basis='percent' and weight between 0 and 100)),
  unique(note_instrument_id,underlying_instrument_id)
);
create table if not exists public.mercury_sp_observation (
  id text primary key,
  note_instrument_id text not null references public.mercury_structured_product_detail(instrument_id),
  observation_date date not null, payment_date date,
  coupon_rate_pct numeric(16,8), autocall_level_pct numeric(16,8),
  observation_kind text not null check (observation_kind in ('coupon','autocall','knock_in','accumulation','maturity','combined')),
  sequence_no integer not null check (sequence_no >= 0),
  unique(note_instrument_id,id), unique(note_instrument_id,observation_kind,sequence_no),
  check (payment_date is null or payment_date >= observation_date)
);
create table if not exists public.mercury_sp_event (
  id text primary key,
  note_instrument_id text not null references public.mercury_structured_product_detail(instrument_id),
  kind text not null, date date not null,
  underlying_instrument_id text references public.mercury_instrument(id),
  settlement text, observation_id text,
  status text not null default 'observed' check (status in ('observed','confirmed','corrected','cancelled')),
  recorded_at timestamptz not null default now(),
  data_mode text not null default 'mock' check (data_mode in ('mock','live','simulated','unknown')),
  foreign key(note_instrument_id,observation_id) references public.mercury_sp_observation(note_instrument_id,id)
);

create index if not exists mercury_position_portfolio_idx on public.mercury_position(firm_id,portfolio_id,valued_at);
create index if not exists mercury_sp_observation_date_idx on public.mercury_sp_observation(note_instrument_id,observation_date);
create index if not exists mercury_sp_event_date_idx on public.mercury_sp_event(note_instrument_id,date);

create table if not exists public.mercury_schema_version (
  id text primary key, installed_at timestamptz not null default now()
);

-- Deliberately no browser policies until real user authorization is implemented.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'mercury_firm','mercury_household','mercury_client','mercury_custodian',
    'mercury_account','mercury_account_owner','mercury_portfolio','mercury_instrument',
    'mercury_position','mercury_structured_product_detail','mercury_sp_underlying',
    'mercury_sp_observation','mercury_sp_event','mercury_schema_version'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end $$;

insert into public.mercury_schema_version(id) values ('202610260001_core_v2') on conflict(id) do nothing;
notify pgrst, 'reload schema';
commit;
