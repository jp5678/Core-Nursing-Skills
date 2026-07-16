-- =============================================================
-- 마이그레이션 3: 과제 대상 학년·반 지정
-- 실행: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run (재실행 가능)
-- target_grade / target_classes 가 비어 있으면(전체) 모든 학생에게 표시됩니다.
-- =============================================================

alter table public.assignments
  add column if not exists target_grade int check (target_grade between 1 and 4);

alter table public.assignments
  add column if not exists target_classes text[];

select 'migration-3 완료' as result;
