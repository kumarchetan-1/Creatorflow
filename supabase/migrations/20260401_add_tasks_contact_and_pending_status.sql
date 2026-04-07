alter table tasks
add column if not exists contact_id uuid references contacts(id) on delete set null;

create index if not exists idx_tasks_contact_id on tasks(contact_id);

alter table tasks drop constraint if exists tasks_status_check;

alter table tasks
add constraint tasks_status_check
check (status in ('pending', 'open', 'done'));
