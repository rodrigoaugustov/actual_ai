BEGIN TRANSACTION;

UPDATE notes
   SET note = (
     SELECT TRIM(ai_category_profiles.description)
       FROM ai_category_profiles
      WHERE ai_category_profiles.category_id = notes.id
        AND ai_category_profiles.tombstone = 0
        AND TRIM(ai_category_profiles.description) <> ''
   )
 WHERE (notes.note IS NULL OR TRIM(notes.note) = '')
   AND EXISTS (
     SELECT 1
       FROM ai_category_profiles
      WHERE ai_category_profiles.category_id = notes.id
        AND ai_category_profiles.tombstone = 0
        AND TRIM(ai_category_profiles.description) <> ''
   );

INSERT INTO notes (id, note)
SELECT ai_category_profiles.category_id,
       TRIM(ai_category_profiles.description)
  FROM ai_category_profiles
 WHERE ai_category_profiles.tombstone = 0
   AND TRIM(ai_category_profiles.description) <> ''
   AND NOT EXISTS (
     SELECT 1
       FROM notes
      WHERE notes.id = ai_category_profiles.category_id
   );

COMMIT;
