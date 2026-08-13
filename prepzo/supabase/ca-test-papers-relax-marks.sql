-- Standalone delta on top of ca-test-papers-schema.sql: a scan can obscure a
-- small printed marks value on a descriptive question just as easily as a
-- missing answer key obscures an MCQ's correct answer — relax the same way
-- (marks null is fine when test_paper_id is set; the AI evaluator in
-- lib/ca/evaluateAnswer.ts already tolerates a missing marks/model_answer).
-- Run this once in Supabase SQL Editor. Safe to re-run. Also folded into
-- ca-test-papers-schema.sql and ca-all-pending-migrations.sql.

alter table questions drop constraint if exists questions_type_shape_check;
alter table questions add constraint questions_type_shape_check check (
  (question_type = 'mcq' and option_a is not null and option_b is not null
    and option_c is not null and option_d is not null and (correct_option is not null or test_paper_id is not null))
  or
  (question_type = 'descriptive' and (marks is not null or test_paper_id is not null)
    and (model_answer is not null or test_paper_id is not null))
);
