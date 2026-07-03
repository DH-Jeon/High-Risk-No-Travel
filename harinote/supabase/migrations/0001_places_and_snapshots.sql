-- 하리노트 0001: places(관광지) + safety_snapshots(일별 안전 점수 스냅샷)
-- RLS: 공개 읽기만 허용, 쓰기 정책 없음 → service role(시드 스크립트)만 쓰기 가능.

-- ============ places: TourAPI 정규화 관광지 ============
create table if not exists public.places (
  content_id      bigint primary key,           -- TourAPI contentid
  content_type_id integer not null,             -- 12 관광지, 14 문화시설, 39 음식점 ...
  title           text not null,
  addr1           text,
  addr2           text,
  area_code       integer,                      -- 강원 = 32
  sigungu_code    integer,
  cat1            text,                         -- TourAPI 구분류
  cat2            text,
  cat3            text,
  lcls_systm1     text,                         -- KorService2 신분류체계
  lcls_systm2     text,
  lcls_systm3     text,
  lng             double precision not null,    -- mapx (경도)
  lat             double precision not null,    -- mapy (위도)
  first_image     text,
  tel             text,
  env_type        text not null check (
    env_type in ('indoor', 'outdoor_water', 'outdoor_mountain', 'outdoor_coast', 'outdoor_general')
  ),
  modified_time   text,                         -- TourAPI modifiedtime 원문 (YYYYMMDDHHMMSS)
  raw             jsonb,                        -- TourAPI 원본 item
  seeded_at       timestamptz not null default now()
);

create index if not exists idx_places_content_type on public.places (content_type_id);
create index if not exists idx_places_env_type on public.places (env_type);
create index if not exists idx_places_sigungu on public.places (area_code, sigungu_code);

-- ============ safety_snapshots: 일별·프로필별 안전 점수 ============
create table if not exists public.safety_snapshots (
  id             bigint generated always as identity primary key,
  content_id     bigint not null references public.places (content_id) on delete cascade,
  snapshot_date  date not null,
  profile        text not null check (
    profile in ('default', 'with_kids', 'with_seniors', 'own_car')
  ),
  score          integer not null check (score >= 0 and score <= 100),
  weather_risk   integer not null default 0,
  disaster_risk  integer not null default 0,
  medical_risk   integer not null default 0,
  mobility_risk  integer not null default 0,
  factors        jsonb not null default '[]'::jsonb,  -- RiskFactor[] (src/lib/safety/types.ts)
  computed_at    timestamptz not null default now(),
  unique (content_id, snapshot_date, profile)
);

create index if not exists idx_snapshots_date on public.safety_snapshots (snapshot_date);
create index if not exists idx_snapshots_content on public.safety_snapshots (content_id, snapshot_date);

-- ============ RLS ============
alter table public.places enable row level security;
alter table public.safety_snapshots enable row level security;

-- 공개 읽기 (anon 포함). 쓰기 정책은 만들지 않는다 → service role만 insert/update 가능.
create policy "places_public_read"
  on public.places for select
  using (true);

create policy "safety_snapshots_public_read"
  on public.safety_snapshots for select
  using (true);
