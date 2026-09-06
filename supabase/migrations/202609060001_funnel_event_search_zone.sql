-- Mantém a zona escolhida na busca distinta da região de interesse declarada
-- no mapa. Ambas são sinais anônimos de demanda.
alter table public.funnel_events
  add column if not exists search_zone text
  check (search_zone in ('Centro', 'Norte', 'Sul', 'Leste', 'Oeste'));

create index if not exists funnel_events_search_zone_idx
  on public.funnel_events (search_zone, occurred_at desc)
  where search_zone is not null;
