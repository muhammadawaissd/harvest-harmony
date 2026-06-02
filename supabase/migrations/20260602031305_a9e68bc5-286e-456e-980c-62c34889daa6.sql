
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "auth read profiles" on public.profiles for select to authenticated using (true);
create policy "user upsert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "user update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Owners (the 2 business owners — configurable)
create table public.owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  cnic text,
  address text,
  note text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.owners to authenticated;
grant all on public.owners to service_role;
alter table public.owners enable row level security;
create policy "auth all owners" on public.owners for all to authenticated using (true) with check (true);

-- Seasons
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.seasons to authenticated;
grant all on public.seasons to service_role;
alter table public.seasons enable row level security;
create policy "auth all seasons" on public.seasons for all to authenticated using (true) with check (true);

-- Farmers
create table public.farmers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone text,
  village text,
  note text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.farmers to authenticated;
grant all on public.farmers to service_role;
alter table public.farmers enable row level security;
create policy "auth all farmers" on public.farmers for all to authenticated using (true) with check (true);

-- Expenses
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete restrict,
  entry_date date not null,
  amount_pkr numeric(14,2) not null check (amount_pkr >= 0),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
create policy "auth all expenses" on public.expenses for all to authenticated using (true) with check (true);

-- Incomes
create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  farmer_id uuid not null references public.farmers(id) on delete restrict,
  entry_date date not null,
  total_acre numeric(10,2) not null check (total_acre >= 0),
  rate_per_acre numeric(12,2) not null check (rate_per_acre >= 0),
  received_amount numeric(14,2) not null default 0 check (received_amount >= 0),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.incomes to authenticated;
grant all on public.incomes to service_role;
alter table public.incomes enable row level security;
create policy "auth all incomes" on public.incomes for all to authenticated using (true) with check (true);

-- Owner-to-owner transfers
create table public.owner_transfers (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  from_owner_id uuid not null references public.owners(id) on delete restrict,
  to_owner_id uuid not null references public.owners(id) on delete restrict,
  entry_date date not null,
  amount_pkr numeric(14,2) not null check (amount_pkr >= 0),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (from_owner_id <> to_owner_id)
);
grant select, insert, update, delete on public.owner_transfers to authenticated;
grant all on public.owner_transfers to service_role;
alter table public.owner_transfers enable row level security;
create policy "auth all transfers" on public.owner_transfers for all to authenticated using (true) with check (true);

create index on public.expenses(season_id);
create index on public.incomes(season_id);
create index on public.incomes(farmer_id);
create index on public.owner_transfers(season_id);
