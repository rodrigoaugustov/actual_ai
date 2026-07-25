BEGIN TRANSACTION;

CREATE TABLE ai_category_profiles
  (id TEXT PRIMARY KEY,
   category_id TEXT,
   description TEXT,
   updated_at INTEGER,
   tombstone INTEGER DEFAULT 0);

CREATE UNIQUE INDEX ai_category_profiles_category
  ON ai_category_profiles(category_id);

CREATE TABLE ai_merchant_enrichments
  (id TEXT PRIMARY KEY,
   normalized_query TEXT,
   locale TEXT,
   summary TEXT,
   sources_json TEXT,
   expires_at INTEGER,
   created_at INTEGER,
   updated_at INTEGER,
   tombstone INTEGER DEFAULT 0);

CREATE UNIQUE INDEX ai_merchant_enrichments_query
  ON ai_merchant_enrichments(normalized_query, locale);
CREATE INDEX ai_merchant_enrichments_expires
  ON ai_merchant_enrichments(expires_at);

COMMIT;
