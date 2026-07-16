-- =============================================================
-- 청암대학교 간호학과 핵심기본간호술 교육 플랫폼 — Supabase 스키마
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여넣기 → Run
-- =============================================================

-- ---------- 테이블 ----------

-- 교수 허용 목록 (이 이메일로 로그인하면 교수 권한, is_admin이면 교수 관리 가능)
create table if not exists public.professors (
  email    text primary key,
  name     text not null default '간호학과 교수',
  is_admin boolean not null default false
);

create table if not exists public.students (
  id         uuid primary key default gen_random_uuid(),
  grade      int  not null check (grade between 1 and 4),
  class_no   text not null check (class_no in ('A','B','C','D','E','F')),
  student_no text not null unique,
  name       text not null,
  email      text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id         uuid primary key default gen_random_uuid(),
  skill_id   int not null check (skill_id between 1 and 20),
  url        text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text not null default '',
  due_date       date,
  skill_id       int check (skill_id between 1 and 20),
  target_grade   int check (target_grade between 1 and 4),  -- null = 전체 학년
  target_classes text[],                                    -- null/빈 배열 = 전체 반
  created_at     timestamptz not null default now()
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

create table if not exists public.progress (
  student_id    uuid not null references public.students(id) on delete cascade,
  skill_id      int  not null check (skill_id between 1 and 20),
  video_watched boolean not null default false,
  best_score    int not null default 0 check (best_score between 0 and 100),
  passed        boolean not null default false,
  updated_at    timestamptz not null default now(),
  primary key (student_id, skill_id)
);

create table if not exists public.quiz_results (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id   int  not null check (skill_id between 1 and 20),
  score      int  not null,
  total      int  not null,
  created_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id           uuid primary key default gen_random_uuid(),
  cert_no      text not null unique,
  student_id   uuid not null unique references public.students(id) on delete cascade,
  issued_by    text not null,
  passed_count int  not null default 20,
  issued_at    timestamptz not null default now()
);

-- ---------- 권한 판별 함수 ----------

create or replace function public.is_professor()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from professors p where p.email = auth.jwt()->>'email') $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from professors p where p.email = auth.jwt()->>'email' and p.is_admin) $$;

create or replace function public.current_student_id()
returns uuid language sql stable security definer set search_path = public as
$$ select s.id from students s where s.email = auth.jwt()->>'email' $$;

-- ---------- 행 단위 보안(RLS) ----------

alter table public.professors    enable row level security;
alter table public.students      enable row level security;
alter table public.videos        enable row level security;
alter table public.progress      enable row level security;
alter table public.quiz_results  enable row level security;
alter table public.certificates  enable row level security;

-- professors: 조회는 로그인 사용자(권한 판별용), 등록/수정/삭제는 관리자만
drop policy if exists professors_select on public.professors;
create policy professors_select on public.professors
  for select to authenticated using (true);
drop policy if exists professors_write on public.professors;
create policy professors_write on public.professors
  for all to authenticated using (is_admin()) with check (is_admin());

-- students: 조회는 로그인 사용자 전체, 등록/수정/삭제는 교수만
drop policy if exists students_select on public.students;
create policy students_select on public.students
  for select to authenticated using (true);
drop policy if exists students_write on public.students;
create policy students_write on public.students
  for all to authenticated using (is_professor()) with check (is_professor());

-- videos: 조회는 로그인 사용자, 등록/삭제는 교수만
drop policy if exists videos_select on public.videos;
create policy videos_select on public.videos
  for select to authenticated using (true);
drop policy if exists videos_write on public.videos;
create policy videos_write on public.videos
  for all to authenticated using (is_professor()) with check (is_professor());

-- progress: 학생은 본인 것만 읽고 쓰기, 교수는 전체
drop policy if exists progress_select on public.progress;
create policy progress_select on public.progress
  for select to authenticated
  using (is_professor() or student_id = current_student_id());
drop policy if exists progress_upsert on public.progress;
create policy progress_upsert on public.progress
  for insert to authenticated
  with check (is_professor() or student_id = current_student_id());
drop policy if exists progress_update on public.progress;
create policy progress_update on public.progress
  for update to authenticated
  using (is_professor() or student_id = current_student_id())
  with check (is_professor() or student_id = current_student_id());
drop policy if exists progress_delete on public.progress;
create policy progress_delete on public.progress
  for delete to authenticated using (is_professor());

-- quiz_results: 학생은 본인 기록 생성/조회, 교수는 전체 조회
drop policy if exists quiz_select on public.quiz_results;
create policy quiz_select on public.quiz_results
  for select to authenticated
  using (is_professor() or student_id = current_student_id());
drop policy if exists quiz_insert on public.quiz_results;
create policy quiz_insert on public.quiz_results
  for insert to authenticated
  with check (is_professor() or student_id = current_student_id());

-- assignments: 조회는 로그인 사용자, 등록/수정/삭제는 교수만
alter table public.assignments enable row level security;
drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
  for select to authenticated using (true);
drop policy if exists assignments_write on public.assignments;
create policy assignments_write on public.assignments
  for all to authenticated using (is_professor()) with check (is_professor());

-- submissions: 학생은 본인 제출물만 생성/수정/조회, 교수는 전체
alter table public.submissions enable row level security;
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

-- certificates: 학생은 본인 것 조회, 발급/취소는 교수만
drop policy if exists cert_select on public.certificates;
create policy cert_select on public.certificates
  for select to authenticated
  using (is_professor() or student_id = current_student_id());
drop policy if exists cert_write on public.certificates;
create policy cert_write on public.certificates
  for all to authenticated using (is_professor()) with check (is_professor());

-- ---------- 초기 데이터 ----------

-- 교수 허용 목록 (관리자는 앱의 '교수 관리' 메뉴에서 추가/삭제 가능)
insert into public.professors (email, name, is_admin) values
  ('imjp5678@scjc.ac.kr', '정종필 교수', true),
  ('jp5678@gmail.com',    '정종필 교수', false)
on conflict (email) do nothing;

-- 데모 학생 (원치 않으면 이 블록을 지우고 실행하세요)
insert into public.students (id, grade, class_no, student_no, name, email) values
  ('00000000-0000-4000-8000-000000000001', 2, 'A', '20240101', '김하은', 's001@scjc.ac.kr'),
  ('00000000-0000-4000-8000-000000000002', 2, 'A', '20240102', '이서준', 's002@scjc.ac.kr'),
  ('00000000-0000-4000-8000-000000000003', 2, 'B', '20240115', '박지우', 's003@scjc.ac.kr'),
  ('00000000-0000-4000-8000-000000000004', 3, 'A', '20230207', '최민서', 's004@scjc.ac.kr'),
  ('00000000-0000-4000-8000-000000000005', 3, 'B', '20230221', '정도윤', 's005@scjc.ac.kr'),
  ('00000000-0000-4000-8000-000000000006', 4, 'A', '20220304', '강수아', 's006@scjc.ac.kr'),
  ('00000000-0000-4000-8000-000000000007', 4, 'A', '20220311', '윤시우', 's007@scjc.ac.kr'),
  ('00000000-0000-4000-8000-000000000008', 1, 'C', '20250412', '임예린', 's008@scjc.ac.kr')
on conflict (student_no) do nothing;

-- 김하은: 20개 전 항목 이수 + 수료증
insert into public.progress (student_id, skill_id, video_watched, best_score, passed)
select '00000000-0000-4000-8000-000000000001', s.skill_id, true, 80 + (s.skill_id % 3) * 10, true
from generate_series(1, 20) as s(skill_id)
on conflict (student_id, skill_id) do nothing;

insert into public.certificates (cert_no, student_id, issued_by, passed_count)
values ('청암간호 핵심기본간호술-2026-0001', '00000000-0000-4000-8000-000000000001', '간호학과 교수', 20)
on conflict (student_id) do nothing;
