-- SPEC-friday-unattended.md, D: the address behind a link open, so one address opening many different personal links in
-- minutes (the Oct 22 Windows-agent scanner wave: 60 addresses, 112 rows, three addresses alone 32) reads as a scanner.
alter table link_clicks add column if not exists ip inet;
create index if not exists link_clicks_ip_at on link_clicks (ip, at desc) where ip is not null;
