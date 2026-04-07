alter table contacts
add column if not exists type text not null default 'brand';
