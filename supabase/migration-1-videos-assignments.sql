-- =============================================================
-- 마이그레이션 1: 술기당 영상 여러 개 + 과제 기능
-- 실행: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run (재실행 가능)
-- =============================================================

-- ---------- 1) videos: 술기당 여러 영상 허용 ----------
alter table public.videos add column if not exists id uuid not null default gen_random_uuid();
alter table public.videos drop constraint if exists videos_pkey;
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'videos_pkey'
  ) then
    alter table public.videos add primary key (id);
  end if;
end $$;

-- ---------- 2) 과제 ----------
create table if not exists public.assignments (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  due_date    date,
  skill_id    int check (skill_id between 1 and 20),
  created_at  timestamptz not null default now()
);

create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  content       text not null default '',
  link_url      text not null default '',
  submitted_at  timestamptz not null default now(),
  unique (assignment_id, student_id)
);

-- ---------- 3) 행 단위 보안(RLS) ----------
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

-- assignments: 조회는 로그인 사용자, 등록/수정/삭제는 교수만
drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
  for select to authenticated using (true);
drop policy if exists assignments_write on public.assignments;
create policy assignments_write on public.assignments
  for all to authenticated using (is_professor()) with check (is_professor());

-- submissions: 학생은 본인 제출물만 생성/수정/조회, 교수는 전체
drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions
  for select to authenticated
  using (is_professor() or student_id = current_student_id());
drop policy if exists submissions_insert on public.submissions;
create policy submissions_insert on public.submissions
  for insert to authenticated
  with check (is_professor() or student_id = current_student_id());
drop policy if exists submissions_update on public.submissions;
create policy submissions_update on public.submissions
  for update to authenticated
  using (is_professor() or student_id = current_student_id())
  with check (is_professor() or student_id = current_student_id());
drop policy if exists submissions_delete on public.submissions;
create policy submissions_delete on public.submissions
  for delete to authenticated using (is_professor());

select 'migration-1 완료' as result;
