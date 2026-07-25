BEGIN TRANSACTION;

CREATE TABLE ai_conversations
  (id TEXT PRIMARY KEY,
   title TEXT,
   status TEXT DEFAULT 'active',
   summary TEXT,
   created_at INTEGER,
   updated_at INTEGER,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX ai_conversations_updated_at ON ai_conversations(updated_at);

CREATE TABLE ai_messages
  (id TEXT PRIMARY KEY,
   conversation_id TEXT,
   role TEXT,
   content TEXT,
   parts_json TEXT,
   run_id TEXT,
   created_at INTEGER,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX ai_messages_conversation
  ON ai_messages(conversation_id, created_at);

CREATE TABLE ai_memory_facts
  (id TEXT PRIMARY KEY,
   subject TEXT,
   kind TEXT,
   value_json TEXT,
   original_text TEXT,
   source TEXT,
   confidence REAL,
   status TEXT DEFAULT 'candidate',
   sensitivity TEXT DEFAULT 'normal',
   source_message_id TEXT,
   source_document_id TEXT,
   supersedes_id TEXT,
   valid_from INTEGER,
   valid_to INTEGER,
   last_confirmed_at INTEGER,
   created_at INTEGER,
   updated_at INTEGER,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX ai_memory_facts_status ON ai_memory_facts(status);
CREATE INDEX ai_memory_facts_kind ON ai_memory_facts(kind);

CREATE TABLE ai_goals
  (id TEXT PRIMARY KEY,
   title TEXT,
   description TEXT,
   target_amount INTEGER,
   target_date INTEGER,
   priority INTEGER,
   flexibility TEXT,
   status TEXT DEFAULT 'active',
   progress_note TEXT,
   next_review_at INTEGER,
   created_at INTEGER,
   updated_at INTEGER,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX ai_goals_status ON ai_goals(status);

CREATE TABLE ai_documents
  (id TEXT PRIMARY KEY,
   title TEXT,
   kind TEXT,
   content TEXT,
   source TEXT,
   created_at INTEGER,
   updated_at INTEGER,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX ai_documents_updated_at ON ai_documents(updated_at);

-- Derived local index. It is deliberately not part of the AQL schema and is
-- rebuilt from ai_documents, so its rows are never emitted as CRDT messages.
CREATE TABLE ai_document_chunks
  (id TEXT PRIMARY KEY,
   document_id TEXT,
   position INTEGER,
   content TEXT,
   token_count INTEGER,
   created_at INTEGER);

CREATE INDEX ai_document_chunks_document
  ON ai_document_chunks(document_id, position);

CREATE TABLE ai_advice_records
  (id TEXT PRIMARY KEY,
   conversation_id TEXT,
   title TEXT,
   recommendation TEXT,
   assumptions_json TEXT,
   evidence_json TEXT,
   alternatives_json TEXT,
   risks_json TEXT,
   status TEXT DEFAULT 'proposed',
   follow_up_at INTEGER,
   created_at INTEGER,
   updated_at INTEGER,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX ai_advice_records_status ON ai_advice_records(status);
CREATE INDEX ai_advice_records_follow_up ON ai_advice_records(follow_up_at);

COMMIT;
