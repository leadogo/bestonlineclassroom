-- Market answers on the desk (William, Oct 8 2026): the BMS Client Directory's client count per market, pushed every
-- 30 minutes alongside the client wall by bms-dashboard's classroom-client-wall cron. `clients` is the directory's own
-- number (every client ever linked to the market, churned included; what Kevin quotes in chat); `live` counts the
-- active, onboarding, renewal and paused ones. Additive: nothing in the room reads this.
create table if not exists market_counts (
  name text primary key,
  clients integer not null default 0,
  live integer not null default 0,
  synced_at timestamptz not null default now()
);
