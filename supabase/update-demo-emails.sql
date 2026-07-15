-- 데모 학생 이메일을 s001~s008@scjc.ac.kr 로 변경
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣기 → Run
update public.students set email = 's001@scjc.ac.kr' where student_no = '20240101';
update public.students set email = 's002@scjc.ac.kr' where student_no = '20240102';
update public.students set email = 's003@scjc.ac.kr' where student_no = '20240115';
update public.students set email = 's004@scjc.ac.kr' where student_no = '20230207';
update public.students set email = 's005@scjc.ac.kr' where student_no = '20230221';
update public.students set email = 's006@scjc.ac.kr' where student_no = '20220304';
update public.students set email = 's007@scjc.ac.kr' where student_no = '20220311';
update public.students set email = 's008@scjc.ac.kr' where student_no = '20250412';

select student_no, name, email from public.students order by student_no;
