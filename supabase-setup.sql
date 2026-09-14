  -- Run this once in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

drop policy if exists "Public profiles are viewable" on profiles;
drop policy if exists "Users manage their own profile" on profiles;
drop policy if exists "Listings are viewable" on listings;
drop policy if exists "Users create their own listings" on listings;
drop policy if exists "Users update their own listings" on listings;
drop policy if exists "Users delete their own listings" on listings;
drop policy if exists "Listing photos are viewable" on listing_photos;
drop policy if exists "Owners manage listing photos" on listing_photos;
drop policy if exists "Users upload their own listing photos" on storage.objects;
drop policy if exists "Users read listing photos" on storage.objects;
drop policy if exists "Users delete their own listing photos" on storage.objects;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  location_name text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  price text not null,
  bedrooms text,
  address text not null,
  contact text not null,
  description text,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now()
);

create table if not exists listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table listings enable row level security;
alter table listing_photos enable row level security;

create policy "Public profiles are viewable"
on profiles for select using (true);
create policy "Users manage their own profile"
on profiles for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Listings are viewable"
on listings for select using (true);
create policy "Users create their own listings"
on listings for insert with check (auth.uid() = owner_id);
create policy "Users update their own listings"
on listings for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Users delete their own listings"
on listings for delete using (auth.uid() = owner_id);

create policy "Listing photos are viewable"
on listing_photos for select using (true);
create policy "Owners manage listing photos"
on listing_photos for all using (
  exists (select 1 from listings where listings.id = listing_photos.listing_id and listings.owner_id = auth.uid())
) with check (
  exists (select 1 from listings where listings.id = listing_photos.listing_id and listings.owner_id = auth.uid())
);

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', false)
on conflict (id) do nothing;

create policy "Users upload their own listing photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'listing-photos' and split_part(name, '/', 1) = auth.uid()::text);
create policy "Users read listing photos"
on storage.objects for select to authenticated
using (bucket_id = 'listing-photos');
create policy "Users delete their own listing photos"
on storage.objects for delete to authenticated
using (bucket_id = 'listing-photos' and split_part(name, '/', 1) = auth.uid()::text);
