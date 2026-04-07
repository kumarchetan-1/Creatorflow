alter table deals drop constraint if exists deals_status_check;

alter table deals
add constraint deals_status_check
check (status in ('lead', 'pitched', 'negotiating', 'won', 'lost', 'closed'));
