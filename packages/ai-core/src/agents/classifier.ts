import { z } from 'zod';

import type { AgentDefinition, PromptBlock } from '#types';

export type ClassifierCategory = {
  id: string;
  name: string;
  group?: string;
};

export type ClassifierHistoryEntry = {
  payeeName: string;
  categoryName: string;
};

export type ClassifierCandidate = {
  id: string;
  payeeName: string;
  amountCents: number;
  date: string;
  notes?: string;
};

export type ClassifierInput = {
  categories: ClassifierCategory[];
  /** Recent user corrections, used as few-shot examples. */
  history: ClassifierHistoryEntry[];
  /** The batch to classify (~50 max — see ARCHITECTURE.md on batching for cache/cost). */
  transactions: ClassifierCandidate[];
};

export const classifierOutputSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      categoryId: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      rationale: z.string(),
    }),
  ),
});

export type ClassifierOutput = z.infer<typeof classifierOutputSchema>;

function formatCategories(categories: ClassifierCategory[]): string {
  return categories
    .map(c =>
      c.group ? `${c.group} > ${c.name} (${c.id})` : `${c.name} (${c.id})`,
    )
    .join('\n');
}

function formatHistory(history: ClassifierHistoryEntry[]): string {
  if (history.length === 0) return '(no prior corrections yet)';
  return history.map(h => `"${h.payeeName}" -> ${h.categoryName}`).join('\n');
}

function formatTransactions(transactions: ClassifierCandidate[]): string {
  return transactions
    .map(
      t =>
        `id=${t.id} payee="${t.payeeName}" amount=${t.amountCents} date=${t.date}` +
        (t.notes ? ` notes="${t.notes}"` : ''),
    )
    .join('\n');
}

export function buildClassifierPrompt(input: ClassifierInput): PromptBlock[] {
  return [
    {
      role: 'system',
      cacheable: true,
      text:
        'You are a transaction categorizer for a personal finance app. ' +
        'For each transaction, pick the single best category id from the ' +
        'list, or null if none fits confidently. Set confidence between 0 ' +
        'and 1, and give a short rationale a future auditor can use to ' +
        'judge whether this was a correct call. Never invent a category id.',
    },
    {
      role: 'system',
      cacheable: true,
      text: `Categories:\n${formatCategories(input.categories)}`,
    },
    {
      role: 'system',
      cacheable: true,
      text: `Recent user corrections (few-shot examples):\n${formatHistory(input.history)}`,
    },
    {
      role: 'user',
      text: `Classify these transactions:\n${formatTransactions(input.transactions)}`,
    },
  ];
}

export const classifierAgent: AgentDefinition<
  ClassifierInput,
  ClassifierOutput
> = {
  name: 'classifier',
  tier: 'standard',
  buildPrompt: buildClassifierPrompt,
  outputSchema: classifierOutputSchema,
};
