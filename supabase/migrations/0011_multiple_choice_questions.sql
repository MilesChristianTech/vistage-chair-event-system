-- A real custom question type: the Host defines their own answer choices
-- (e.g. "Which session will you attend?" with their own list), using the
-- options jsonb column that already existed for exactly this but was never
-- wired up to a question_type.
alter table form_questions drop constraint form_questions_question_type_check;
alter table form_questions add constraint form_questions_question_type_check
  check (question_type in (
    'attendance', 'guest_count', 'guest_names', 'dietary_accessibility',
    'open_text', 'short_text', 'yes_no', 'multiple_choice'
  ));
