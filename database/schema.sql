create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  title text not null default 'Untitled meeting',
  source text not null check (source in ('upload', 'live')),
  status text not null check (status in ('processing', 'live', 'completed', 'failed')),
  storage_path text,
  duration_seconds numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  provider text not null,
  text text not null,
  segments jsonb not null default '[]'::jsonb,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.summaries (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  content jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  task text not null,
  owner text not null default 'Unassigned',
  deadline text not null default 'Not mentioned',
  priority text not null default 'Medium' check (priority in ('High', 'Medium', 'Low')),
  status text not null default 'Pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  speaking_time_by_speaker jsonb not null default '{}'::jsonb,
  recurring_topics text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.transcript_chunks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create index if not exists transcript_chunks_embedding_idx
on public.transcript_chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create index if not exists transcript_chunks_meeting_id_idx on public.transcript_chunks(meeting_id);
create index if not exists meetings_created_at_idx on public.meetings(created_at desc);
create index if not exists action_items_meeting_id_idx on public.action_items(meeting_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists meetings_set_updated_at on public.meetings;
create trigger meetings_set_updated_at
before update on public.meetings
for each row execute function public.set_updated_at();

drop trigger if exists action_items_set_updated_at on public.action_items;
create trigger action_items_set_updated_at
before update on public.action_items
for each row execute function public.set_updated_at();

create or replace function public.match_transcript_chunks(
  query_embedding vector(1536),
  match_count int default 6,
  filter_meeting_id uuid default null
)
returns table (
  id uuid,
  meeting_id uuid,
  chunk_index integer,
  content text,
  similarity float
)
language sql stable
as $$
  select
    transcript_chunks.id,
    transcript_chunks.meeting_id,
    transcript_chunks.chunk_index,
    transcript_chunks.content,
    1 - (transcript_chunks.embedding <=> query_embedding) as similarity
  from public.transcript_chunks
  where filter_meeting_id is null or transcript_chunks.meeting_id = filter_meeting_id
  order by transcript_chunks.embedding <=> query_embedding
  limit match_count;
$$;
