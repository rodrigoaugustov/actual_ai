import { v4 as uuidv4 } from 'uuid';

import * as db from '#server/db';
import type {
  DbAiAdviceRecord,
  DbAiConversation,
  DbAiDocument,
  DbAiDocumentChunk,
  DbAiGoal,
  DbAiMemoryFact,
  DbAiMessage,
} from '#server/db';
import type {
  AiAdviceRecordEntity,
  AiConversationEntity,
  AiDocumentEntity,
  AiGoalEntity,
  AiMemoryFactEntity,
  AiMemoryFactStatus,
  AiMessageEntity,
  AiMessagePart,
  AiMessageRole,
} from '#types/models/ai';

const DOCUMENT_CHUNK_WORDS = 140;
const DOCUMENT_CHUNK_OVERLAP = 25;

export type AdvisorContextMatch = {
  sourceType: 'memory' | 'goal' | 'document' | 'episode';
  sourceId: string;
  title: string;
  content: string;
  score: number;
};

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function conversationFromDb(row: DbAiConversation): AiConversationEntity {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tombstone: row.tombstone === 1,
  };
}

function messageFromDb(row: DbAiMessage): AiMessageEntity {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    parts: parseJson<AiMessagePart[]>(row.parts_json, []),
    runId: row.run_id,
    createdAt: row.created_at,
    tombstone: row.tombstone === 1,
  };
}

function memoryFactFromDb(row: DbAiMemoryFact): AiMemoryFactEntity {
  return {
    id: row.id,
    subject: row.subject,
    kind: row.kind,
    value: parseJson<unknown>(row.value_json, row.value_json),
    originalText: row.original_text,
    source: row.source,
    confidence: row.confidence,
    status: row.status,
    sensitivity: row.sensitivity,
    sourceMessageId: row.source_message_id,
    sourceDocumentId: row.source_document_id,
    supersedesId: row.supersedes_id,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    lastConfirmedAt: row.last_confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tombstone: row.tombstone === 1,
  };
}

function goalFromDb(row: DbAiGoal): AiGoalEntity {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    targetAmount: row.target_amount,
    targetDate: row.target_date,
    priority: row.priority,
    flexibility: row.flexibility,
    status: row.status,
    progressNote: row.progress_note,
    nextReviewAt: row.next_review_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tombstone: row.tombstone === 1,
  };
}

function documentFromDb(row: DbAiDocument): AiDocumentEntity {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    content: row.content,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tombstone: row.tombstone === 1,
  };
}

function adviceFromDb(row: DbAiAdviceRecord): AiAdviceRecordEntity {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    title: row.title,
    recommendation: row.recommendation,
    assumptions: parseJson<string[]>(row.assumptions_json, []),
    evidence: parseJson<AiMessagePart[]>(row.evidence_json, []),
    alternatives: parseJson<string[]>(row.alternatives_json, []),
    risks: parseJson<string[]>(row.risks_json, []),
    status: row.status,
    followUpAt: row.follow_up_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tombstone: row.tombstone === 1,
  };
}

export async function createConversation(
  title = 'Nova conversa',
): Promise<AiConversationEntity> {
  const now = Date.now();
  const id = await db.insertWithUUID('ai_conversations', {
    title,
    status: 'active',
    summary: null,
    created_at: now,
    updated_at: now,
    tombstone: 0,
  });
  return {
    id,
    title,
    status: 'active',
    summary: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listConversations(): Promise<AiConversationEntity[]> {
  const rows = await db.all<DbAiConversation>(
    `SELECT *
       FROM ai_conversations
      WHERE tombstone = 0
      ORDER BY updated_at DESC`,
  );
  return rows.map(conversationFromDb);
}

export async function getConversation(
  id: string,
): Promise<AiConversationEntity | null> {
  const row = await db.first<DbAiConversation>(
    `SELECT *
       FROM ai_conversations
      WHERE id = ? AND tombstone = 0`,
    [id],
  );
  return row ? conversationFromDb(row) : null;
}

export async function updateConversation(params: {
  id: string;
  title?: string;
  summary?: string | null;
  status?: 'active' | 'archived';
}): Promise<void> {
  await db.update('ai_conversations', {
    id: params.id,
    ...(params.title != null ? { title: params.title } : {}),
    ...(params.summary !== undefined ? { summary: params.summary } : {}),
    ...(params.status != null ? { status: params.status } : {}),
    updated_at: Date.now(),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  const messages = await db.all<{ id: string }>(
    `SELECT id
       FROM ai_messages
      WHERE conversation_id = ? AND tombstone = 0`,
    [id],
  );
  for (const message of messages) {
    await db.delete_('ai_messages', message.id);
  }
  await db.delete_('ai_conversations', id);
}

export async function appendConversationMessage(params: {
  conversationId: string;
  role: AiMessageRole;
  content: string;
  parts?: AiMessagePart[];
  runId?: string | null;
}): Promise<AiMessageEntity> {
  const now = Date.now();
  const id = await db.insertWithUUID('ai_messages', {
    conversation_id: params.conversationId,
    role: params.role,
    content: params.content,
    parts_json: JSON.stringify(params.parts ?? []),
    run_id: params.runId ?? null,
    created_at: now,
    tombstone: 0,
  });
  await db.update('ai_conversations', {
    id: params.conversationId,
    updated_at: now,
  });
  return {
    id,
    conversationId: params.conversationId,
    role: params.role,
    content: params.content,
    parts: params.parts ?? [],
    runId: params.runId ?? null,
    createdAt: now,
  };
}

export async function listConversationMessages(
  conversationId: string,
): Promise<AiMessageEntity[]> {
  const rows = await db.all<DbAiMessage>(
    `SELECT *
       FROM ai_messages
      WHERE conversation_id = ? AND tombstone = 0
      ORDER BY created_at ASC, id ASC`,
    [conversationId],
  );
  return rows.map(messageFromDb);
}

export async function createMemoryCandidate(params: {
  subject?: string;
  kind: string;
  value: unknown;
  originalText?: string | null;
  source?: DbAiMemoryFact['source'];
  confidence?: number;
  sensitivity?: DbAiMemoryFact['sensitivity'];
  sourceMessageId?: string | null;
  sourceDocumentId?: string | null;
  validFrom?: number | null;
  validTo?: number | null;
}): Promise<AiMemoryFactEntity> {
  const now = Date.now();
  const row = {
    subject: params.subject ?? 'household',
    kind: params.kind,
    value_json: JSON.stringify(params.value),
    original_text: params.originalText ?? null,
    source: params.source ?? 'conversation',
    confidence: Math.min(1, Math.max(0, params.confidence ?? 1)),
    status: 'candidate' as const,
    sensitivity: params.sensitivity ?? 'normal',
    source_message_id: params.sourceMessageId ?? null,
    source_document_id: params.sourceDocumentId ?? null,
    supersedes_id: null,
    valid_from: params.validFrom ?? null,
    valid_to: params.validTo ?? null,
    last_confirmed_at: null,
    created_at: now,
    updated_at: now,
    tombstone: 0 as const,
  };
  const id = await db.insertWithUUID('ai_memory_facts', row);
  return memoryFactFromDb({ id, ...row });
}

export async function listMemoryFacts(
  status?: AiMemoryFactStatus,
): Promise<AiMemoryFactEntity[]> {
  const rows = await db.all<DbAiMemoryFact>(
    `SELECT *
       FROM ai_memory_facts
      WHERE tombstone = 0
        ${status ? 'AND status = ?' : ''}
      ORDER BY updated_at DESC`,
    status ? [status] : [],
  );
  return rows.map(memoryFactFromDb);
}

export async function resolveMemoryFact(params: {
  id: string;
  action: 'confirm' | 'reject';
  kind?: string;
  value?: unknown;
  originalText?: string | null;
  sensitivity?: DbAiMemoryFact['sensitivity'];
}): Promise<void> {
  const candidate = await db.first<DbAiMemoryFact>(
    `SELECT *
       FROM ai_memory_facts
      WHERE id = ? AND tombstone = 0`,
    [params.id],
  );
  if (!candidate || candidate.status !== 'candidate') return;

  const now = Date.now();
  if (params.action === 'reject') {
    await db.update('ai_memory_facts', {
      id: params.id,
      status: 'rejected',
      updated_at: now,
    });
    return;
  }

  const kind = params.kind ?? candidate.kind;
  const previous = await db.first<DbAiMemoryFact>(
    `SELECT *
       FROM ai_memory_facts
      WHERE subject = ?
        AND kind = ?
        AND status = 'confirmed'
        AND id <> ?
        AND tombstone = 0
      ORDER BY updated_at DESC
      LIMIT 1`,
    [candidate.subject, kind, candidate.id],
  );
  if (previous) {
    await db.update('ai_memory_facts', {
      id: previous.id,
      status: 'superseded',
      valid_to: now,
      updated_at: now,
    });
  }

  await db.update('ai_memory_facts', {
    id: params.id,
    kind,
    ...(params.value !== undefined
      ? { value_json: JSON.stringify(params.value) }
      : {}),
    ...(params.originalText !== undefined
      ? { original_text: params.originalText }
      : {}),
    ...(params.sensitivity != null ? { sensitivity: params.sensitivity } : {}),
    status: 'confirmed',
    supersedes_id: previous?.id ?? null,
    last_confirmed_at: now,
    updated_at: now,
  });
}

export async function deleteMemoryFact(id: string): Promise<void> {
  await db.delete_('ai_memory_facts', id);
}

export async function createGoal(params: {
  title: string;
  description: string;
  targetAmount?: number | null;
  targetDate?: number | null;
  priority?: number;
  flexibility?: DbAiGoal['flexibility'];
  progressNote?: string | null;
  nextReviewAt?: number | null;
}): Promise<AiGoalEntity> {
  const now = Date.now();
  const row = {
    title: params.title,
    description: params.description,
    target_amount: params.targetAmount ?? null,
    target_date: params.targetDate ?? null,
    priority: Math.min(5, Math.max(1, params.priority ?? 3)),
    flexibility: params.flexibility ?? ('flexible' as const),
    status: 'active' as const,
    progress_note: params.progressNote ?? null,
    next_review_at: params.nextReviewAt ?? null,
    created_at: now,
    updated_at: now,
    tombstone: 0 as const,
  };
  const id = await db.insertWithUUID('ai_goals', row);
  return goalFromDb({ id, ...row });
}

export async function listGoals(): Promise<AiGoalEntity[]> {
  const rows = await db.all<DbAiGoal>(
    `SELECT *
       FROM ai_goals
      WHERE tombstone = 0
      ORDER BY priority ASC, updated_at DESC`,
  );
  return rows.map(goalFromDb);
}

export async function updateGoal(
  params: Pick<AiGoalEntity, 'id'> &
    Partial<
      Pick<
        AiGoalEntity,
        | 'title'
        | 'description'
        | 'targetAmount'
        | 'targetDate'
        | 'priority'
        | 'flexibility'
        | 'status'
        | 'progressNote'
        | 'nextReviewAt'
      >
    >,
): Promise<void> {
  await db.update('ai_goals', {
    id: params.id,
    ...(params.title != null ? { title: params.title } : {}),
    ...(params.description != null ? { description: params.description } : {}),
    ...(params.targetAmount !== undefined
      ? { target_amount: params.targetAmount }
      : {}),
    ...(params.targetDate !== undefined
      ? { target_date: params.targetDate }
      : {}),
    ...(params.priority != null ? { priority: params.priority } : {}),
    ...(params.flexibility != null ? { flexibility: params.flexibility } : {}),
    ...(params.status != null ? { status: params.status } : {}),
    ...(params.progressNote !== undefined
      ? { progress_note: params.progressNote }
      : {}),
    ...(params.nextReviewAt !== undefined
      ? { next_review_at: params.nextReviewAt }
      : {}),
    updated_at: Date.now(),
  });
}

export async function deleteGoal(id: string): Promise<void> {
  await db.delete_('ai_goals', id);
}

function chunkDocument(content: string): string[] {
  const words = content.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const chunks: string[] = [];
  const step = DOCUMENT_CHUNK_WORDS - DOCUMENT_CHUNK_OVERLAP;
  for (let start = 0; start < words.length; start += step) {
    chunks.push(words.slice(start, start + DOCUMENT_CHUNK_WORDS).join(' '));
    if (start + DOCUMENT_CHUNK_WORDS >= words.length) break;
  }
  return chunks;
}

async function rebuildDocumentChunks(
  documentId: string,
  content: string,
): Promise<void> {
  await db.run('DELETE FROM ai_document_chunks WHERE document_id = ?', [
    documentId,
  ]);
  const chunks = chunkDocument(content);
  for (const [position, chunk] of chunks.entries()) {
    await db.run(
      `INSERT INTO ai_document_chunks
         (id, document_id, position, content, token_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        documentId,
        position,
        chunk,
        chunk.split(/\s+/).length,
        Date.now(),
      ],
    );
  }
}

export async function createDocument(params: {
  title: string;
  kind: string;
  content: string;
  source?: DbAiDocument['source'];
}): Promise<AiDocumentEntity> {
  const now = Date.now();
  const row = {
    title: params.title,
    kind: params.kind,
    content: params.content,
    source: params.source ?? ('user' as const),
    created_at: now,
    updated_at: now,
    tombstone: 0 as const,
  };
  const id = await db.insertWithUUID('ai_documents', row);
  await rebuildDocumentChunks(id, params.content);
  return documentFromDb({ id, ...row });
}

export async function listDocuments(): Promise<AiDocumentEntity[]> {
  const rows = await db.all<DbAiDocument>(
    `SELECT *
       FROM ai_documents
      WHERE tombstone = 0
      ORDER BY updated_at DESC`,
  );
  return rows.map(documentFromDb);
}

export async function updateDocument(params: {
  id: string;
  title?: string;
  kind?: string;
  content?: string;
}): Promise<void> {
  await db.update('ai_documents', {
    id: params.id,
    ...(params.title != null ? { title: params.title } : {}),
    ...(params.kind != null ? { kind: params.kind } : {}),
    ...(params.content != null ? { content: params.content } : {}),
    updated_at: Date.now(),
  });
  if (params.content != null) {
    await rebuildDocumentChunks(params.id, params.content);
  }
}

export async function deleteDocument(id: string): Promise<void> {
  await db.run('DELETE FROM ai_document_chunks WHERE document_id = ?', [id]);
  await db.delete_('ai_documents', id);
}

export async function createAdviceRecord(params: {
  conversationId?: string | null;
  title: string;
  recommendation: string;
  assumptions?: string[];
  evidence?: AiMessagePart[];
  alternatives?: string[];
  risks?: string[];
  followUpAt?: number | null;
}): Promise<AiAdviceRecordEntity> {
  const now = Date.now();
  const row = {
    conversation_id: params.conversationId ?? null,
    title: params.title,
    recommendation: params.recommendation,
    assumptions_json: JSON.stringify(params.assumptions ?? []),
    evidence_json: JSON.stringify(params.evidence ?? []),
    alternatives_json: JSON.stringify(params.alternatives ?? []),
    risks_json: JSON.stringify(params.risks ?? []),
    status: 'proposed' as const,
    follow_up_at: params.followUpAt ?? null,
    created_at: now,
    updated_at: now,
    tombstone: 0 as const,
  };
  const id = await db.insertWithUUID('ai_advice_records', row);
  return adviceFromDb({ id, ...row });
}

export async function listAdviceRecords(): Promise<AiAdviceRecordEntity[]> {
  const rows = await db.all<DbAiAdviceRecord>(
    `SELECT *
       FROM ai_advice_records
      WHERE tombstone = 0
      ORDER BY updated_at DESC`,
  );
  return rows.map(adviceFromDb);
}

export async function updateAdviceRecord(params: {
  id: string;
  status?: DbAiAdviceRecord['status'];
  followUpAt?: number | null;
}): Promise<void> {
  await db.update('ai_advice_records', {
    id: params.id,
    ...(params.status != null ? { status: params.status } : {}),
    ...(params.followUpAt !== undefined
      ? { follow_up_at: params.followUpAt }
      : {}),
    updated_at: Date.now(),
  });
}

export async function deleteAdviceRecord(id: string): Promise<void> {
  await db.delete_('ai_advice_records', id);
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function searchTerms(query: string): string[] {
  return [
    ...new Set(
      normalizeSearchText(query)
        .split(/[^\p{Letter}\p{Number}]+/u)
        .filter(term => term.length >= 3),
    ),
  ];
}

function lexicalScore(content: string, terms: string[]): number {
  if (terms.length === 0) return 0;
  const normalized = normalizeSearchText(content);
  let score = 0;
  for (const term of terms) {
    const occurrences = normalized.split(term).length - 1;
    score += Math.min(occurrences, 4);
  }
  return score / terms.length;
}

export async function searchAdvisorContext(
  query: string,
  limit = 8,
  includeSensitive = false,
): Promise<AdvisorContextMatch[]> {
  const terms = searchTerms(query);
  const [facts, goals, documents, initialChunks, episodes] = await Promise.all([
    db.all<DbAiMemoryFact>(
      `SELECT *
         FROM ai_memory_facts
        WHERE status = 'confirmed'
          AND tombstone = 0
          AND (valid_from IS NULL OR valid_from <= ${Date.now()})
          AND (valid_to IS NULL OR valid_to > ${Date.now()})
          ${includeSensitive ? '' : "AND sensitivity = 'normal'"}`,
    ),
    db.all<DbAiGoal>(
      `SELECT *
         FROM ai_goals
        WHERE status IN ('active', 'paused') AND tombstone = 0`,
    ),
    db.all<DbAiDocument>(
      `SELECT *
         FROM ai_documents
        WHERE tombstone = 0`,
    ),
    db.all<DbAiDocumentChunk>('SELECT * FROM ai_document_chunks'),
    db.all<Pick<DbAiConversation, 'id' | 'title' | 'summary' | 'updated_at'>>(
      `SELECT id, title, summary, updated_at
         FROM ai_conversations
        WHERE summary IS NOT NULL AND tombstone = 0`,
    ),
  ]);
  let chunks = initialChunks;
  let rebuiltChunks = false;
  for (const document of documents) {
    const documentChunks = chunks.filter(
      chunk => chunk.document_id === document.id,
    );
    const latestChunk = Math.max(
      0,
      ...documentChunks.map(chunk => chunk.created_at),
    );
    if (documentChunks.length === 0 || latestChunk < document.updated_at) {
      await rebuildDocumentChunks(document.id, document.content);
      rebuiltChunks = true;
    }
  }
  if (rebuiltChunks) {
    chunks = await db.all<DbAiDocumentChunk>(
      'SELECT * FROM ai_document_chunks',
    );
  }
  const documentsById = new Map(
    documents.map(document => [document.id, document]),
  );
  const matches: AdvisorContextMatch[] = [];

  for (const fact of facts) {
    const content = [fact.kind, fact.original_text, fact.value_json]
      .filter(Boolean)
      .join(' — ');
    matches.push({
      sourceType: 'memory',
      sourceId: fact.id,
      title: fact.kind,
      content,
      score: lexicalScore(content, terms) + 0.25,
    });
  }

  for (const goal of goals) {
    const content = [goal.title, goal.description, goal.progress_note]
      .filter(Boolean)
      .join(' — ');
    matches.push({
      sourceType: 'goal',
      sourceId: goal.id,
      title: goal.title,
      content,
      score: lexicalScore(content, terms) + 0.2,
    });
  }

  for (const chunk of chunks) {
    const document = documentsById.get(chunk.document_id);
    if (!document) continue;
    matches.push({
      sourceType: 'document',
      sourceId: document.id,
      title: document.title,
      content: chunk.content,
      score: lexicalScore(
        `${document.title} ${document.kind} ${chunk.content}`,
        terms,
      ),
    });
  }

  for (const episode of episodes) {
    if (!episode.summary) continue;
    const content = `${episode.title} — ${episode.summary}`;
    matches.push({
      sourceType: 'episode',
      sourceId: episode.id,
      title: episode.title,
      content,
      score: lexicalScore(content, terms) + 0.1,
    });
  }

  return matches
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, Math.min(Math.max(limit, 1), 20));
}
