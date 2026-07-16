-- =============================================================
-- 마이그레이션 2: 관리자 지정 + 교수 관리 기능
-- 실행: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run (재실행 가능)
-- =============================================================

-- 1) 관리자 플래그 추가 및 관리자 지정
alter table public.professors add column if not exists is_admin boolean not null default false;
update public.professors set is_admin = true where email = 'imjp5678@scjc.ac.kr';

-- 2) 관리자 판별 함수
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from professors p where p.email = auth.jwt()->>'email' and p.is_admin) $$;

-- 3) 교수 목록 쓰기 권한: 관리자만
drop policy if exists professors_write on public.professors;
create policy professors_write on public.professors
  for all to authenticated using (is_admin()) with check (is_admin());

select email, name, is_admin from public.professors order by is_admin desc, email;
