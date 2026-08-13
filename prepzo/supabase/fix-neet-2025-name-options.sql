-- Fix rows where Excel/Sheets imported option text as #NAME?.
-- Run in Supabase SQL Editor after NEET 2025 PYQs have been imported/promoted.

UPDATE public.pyq_import_staging
SET
  option_a_text = 'g m^-2 yr^-1',
  option_b_text = 'g m^-2',
  option_c_text = 'kcal m^-3',
  option_d_text = 'kcal m^-2 yr^-1',
  difficulty = 'Easy'
WHERE import_key = 'NEET-2025-Q150';

UPDATE public.questions
SET
  option_a = 'g m^-2 yr^-1',
  option_b = 'g m^-2',
  option_c = 'kcal m^-3',
  option_d = 'kcal m^-2 yr^-1',
  difficulty = 'Easy'
WHERE pyq_source_key = 'NEET-2025-Q150';

UPDATE public.pyq_import_staging
SET
  option_a_text = 'Alpha factor',
  option_b_text = 'Sigma factor',
  option_c_text = 'Rho factor',
  option_d_text = 'Gamma factor',
  difficulty = 'Easy'
WHERE import_key = 'NEET-2025-Q174';

UPDATE public.questions
SET
  option_a = 'Alpha factor',
  option_b = 'Sigma factor',
  option_c = 'Rho factor',
  option_d = 'Gamma factor',
  difficulty = 'Easy'
WHERE pyq_source_key = 'NEET-2025-Q174';

SELECT
  pyq_source_key,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_option
FROM public.questions
WHERE pyq_source_key IN ('NEET-2025-Q150', 'NEET-2025-Q174')
ORDER BY pyq_source_key;
