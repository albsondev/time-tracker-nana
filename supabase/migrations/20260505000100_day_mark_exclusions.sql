alter table public.day_marks
  drop constraint if exists day_marks_type_check;

alter table public.day_marks
  add constraint day_marks_type_check check (type in ('holiday', 'excluded'));
