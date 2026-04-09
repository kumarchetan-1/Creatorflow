-- Creatorflow: expand deal lifecycle statuses to cover full workflow

alter table public.deals drop constraint if exists deals_status_check;

alter table public.deals
add constraint deals_status_check
check (
  status in (
    'lead',
    'pitched',
    'negotiating',
    'contract_sent',
    'contract_signed',
    'invoice_sent',
    'paid',
    'won',
    'lost',
    'closed'
  )
);

