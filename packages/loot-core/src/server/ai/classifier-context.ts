import { normalizePayee } from '@actual-app/ai';
import type { ClassifierEvidenceEntry } from '@actual-app/ai';

import * as db from '#server/db';

export type ClassifierContextTransaction = {
  id: string;
  payeeName: string | null;
  importedPayee: string | null;
  notes: string | null;
};

type EvidenceRow = {
  payeeName: string;
  importedPayee: string | null;
  notes: string | null;
  categoryName: string;
  source: string;
  confidence: number | null;
};

const GENERIC_MERCHANTS = new Set([
  '',
  'compra',
  'debito',
  'credito',
  'pagamento',
  'pix',
  'transferencia',
]);
const MAX_EVIDENCE_PER_CLUSTER = 6;

function normalizeDescription(value: string | null | undefined): string {
  return normalizePayee(value ?? '')
    .split(' ')
    .filter(token => token.length > 1 && !/^\d+$/.test(token))
    .join(' ');
}

function compactMerchantName(value: string): string {
  return value.replace(/\s+/g, '');
}

function tokenSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftTokens = new Set(left.split(' '));
  const rightTokens = new Set(right.split(' '));
  const intersection = [...leftTokens].filter(token =>
    rightTokens.has(token),
  ).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

export function buildMerchantClusterId(
  transaction: ClassifierContextTransaction,
): string {
  const payee = normalizeDescription(transaction.payeeName);
  const importedPayee = normalizeDescription(transaction.importedPayee);
  if (payee && !GENERIC_MERCHANTS.has(payee)) {
    const compactPayee = compactMerchantName(payee);
    const compactImportedPayee = compactMerchantName(importedPayee);
    if (importedPayee && compactImportedPayee !== compactPayee) {
      return `payee:${compactPayee}|imported:${compactImportedPayee}`;
    }
    return `payee:${compactPayee}`;
  }
  if (importedPayee) return `imported:${importedPayee}`;
  const notes = normalizeDescription(transaction.notes);
  if (notes) return `notes:${notes}`;
  return `transaction:${transaction.id}`;
}

function evidenceSimilarity(
  transaction: ClassifierContextTransaction,
  evidence: EvidenceRow,
): number {
  const transactionPayee = normalizeDescription(transaction.payeeName);
  const evidencePayee = normalizeDescription(evidence.payeeName);
  const payeeScore =
    transactionPayee &&
    evidencePayee &&
    compactMerchantName(transactionPayee) ===
      compactMerchantName(evidencePayee) &&
    !GENERIC_MERCHANTS.has(transactionPayee)
      ? 1
      : tokenSimilarity(transactionPayee, evidencePayee);
  const importedScore = tokenSimilarity(
    normalizeDescription(transaction.importedPayee),
    normalizeDescription(evidence.importedPayee),
  );
  const notesScore = tokenSimilarity(
    normalizeDescription(transaction.notes),
    normalizeDescription(evidence.notes),
  );
  return payeeScore * 0.7 + importedScore * 0.2 + notesScore * 0.1;
}

function outcomeForEvidence(
  source: string,
): ClassifierEvidenceEntry['outcome'] {
  if (source === 'rejected') return 'rejected';
  if (source === 'accepted') return 'accepted';
  if (source === 'ai_high_confidence') return 'ai_high_confidence';
  return 'confirmed';
}

async function loadEvidenceRows(
  confidenceThreshold: number,
): Promise<EvidenceRow[]> {
  const feedback = await db.all<EvidenceRow>(
    `SELECT f.payee_name AS payeeName,
            t.imported_description AS importedPayee,
            t.notes,
            c.name AS categoryName,
            f.source,
            s.confidence
       FROM ai_feedback f
       JOIN transactions t ON t.id = f.transaction_id
       LEFT JOIN ai_suggestions s ON s.id = f.suggestion_id
       JOIN categories c
         ON c.id = CASE
              WHEN f.source = 'rejected' THEN f.suggested_category_id
              ELSE f.final_category_id
            END
      WHERE f.tombstone = 0
        AND t.tombstone = 0
        AND c.tombstone = 0
      ORDER BY f.created_at DESC
      LIMIT 1000`,
  );
  const autoApplied = await db.all<EvidenceRow>(
    `SELECT COALESCE(p.name, '') AS payeeName,
            t.imported_description AS importedPayee,
            t.notes,
            c.name AS categoryName,
            'ai_high_confidence' AS source,
            s.confidence
       FROM ai_suggestions s
       JOIN transactions t ON t.id = s.transaction_id
       LEFT JOIN payees p ON p.id = t.description
       JOIN categories c ON c.id = s.category_id
      WHERE s.tombstone = 0
        AND s.status = 'auto_applied'
        AND s.confidence >= ?
        AND t.tombstone = 0
        AND c.tombstone = 0
        AND NOT EXISTS (
          SELECT 1
            FROM ai_feedback f
           WHERE f.suggestion_id = s.id AND f.tombstone = 0
        )
      ORDER BY s.created_at DESC
      LIMIT 500`,
    [confidenceThreshold],
  );
  return feedback.concat(autoApplied);
}

export async function getRelevantClassifierEvidence(
  transactions: ClassifierContextTransaction[],
  confidenceThreshold: number,
): Promise<ClassifierEvidenceEntry[]> {
  if (transactions.length === 0) return [];
  const rows = await loadEvidenceRows(confidenceThreshold);
  const transactionsByCluster = new Map<
    string,
    ClassifierContextTransaction[]
  >();
  for (const transaction of transactions) {
    const clusterId = buildMerchantClusterId(transaction);
    const cluster = transactionsByCluster.get(clusterId) ?? [];
    cluster.push(transaction);
    transactionsByCluster.set(clusterId, cluster);
  }

  const result: ClassifierEvidenceEntry[] = [];
  for (const [clusterId, cluster] of transactionsByCluster) {
    const ranked = rows
      .map(row => ({
        row,
        similarity: Math.max(
          ...cluster.map(transaction => evidenceSimilarity(transaction, row)),
        ),
      }))
      .filter(item => item.similarity >= 0.35)
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, MAX_EVIDENCE_PER_CLUSTER);
    for (const { row, similarity } of ranked) {
      result.push({
        merchantClusterId: clusterId,
        payeeName: row.payeeName,
        importedPayee: row.importedPayee ?? undefined,
        categoryName: row.categoryName,
        outcome: outcomeForEvidence(row.source),
        similarity,
        confidence: row.confidence ?? undefined,
      });
    }
  }
  return result;
}
