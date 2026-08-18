-- CA Test Papers — auto-detect paper instead of asking the student to pick
-- one at upload. A single uploaded document can genuinely span more than
-- one CA paper, so ca_test_papers.paper is no longer set at upload time —
-- lib/ca/extractTestPaper.ts now classifies each question's paper from
-- content itself, and lib/ca/processTestPaper.ts sets this column
-- afterward to whichever paper the most extracted questions actually
-- belong to. Run after ca-test-papers-schema.sql. Safe to re-run.

alter table ca_test_papers alter column paper drop not null;
