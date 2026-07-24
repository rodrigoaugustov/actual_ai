import { z } from 'zod';

import type { AgentDefinition, PromptBlock } from '#types';

export type RuleMinerCategory = {
  id: string;
  name: string;
};

export type RuleMinerCandidate = {
  payeeName: string;
  /** Raw description/imported_payee variants seen for this payee, so the
   * model can judge whether a single regex safely covers all of them. */
  sampleDescriptions: string[];
  /** How many times this payee was manually put in each category — a
   * candidate is only worth proposing a rule for when one category
   * dominates the history. */
  categoryCounts: Record<string, number>;
};

export type RuleMinerInput = {
  categories: RuleMinerCategory[];
  candidates: RuleMinerCandidate[];
};

export const ruleProposalSchema = z.object({
  payeeName: z.string(),
  op: z.enum(['contains', 'matches', 'oneOf']),
  value: z.string(),
  categoryId: z.string(),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
});

export const ruleMinerOutputSchema = z.object({
  proposals: z.array(ruleProposalSchema),
});

export type RuleProposal = z.infer<typeof ruleProposalSchema>;
export type RuleMinerOutput = z.infer<typeof ruleMinerOutputSchema>;

function formatCategories(categories: RuleMinerCategory[]): string {
  return categories.map(c => `${c.name} (${c.id})`).join('\n');
}

function formatCandidates(candidates: RuleMinerCandidate[]): string {
  return candidates
    .map(c => {
      const counts = Object.entries(c.categoryCounts)
        .map(([categoryId, count]) => `${categoryId}=${count}`)
        .join(', ');
      const samples = c.sampleDescriptions.map(s => `  - "${s}"`).join('\n');
      return `Payee "${c.payeeName}"\n  category history: ${counts}\n  sample descriptions:\n${samples}`;
    })
    .join('\n\n');
}

export function buildRuleMinerPrompt(input: RuleMinerInput): PromptBlock[] {
  return [
    {
      role: 'system',
      cacheable: true,
      text:
        "You mine safe transaction-categorization rules from a user's " +
        'history for a personal finance app. Only propose a rule when the ' +
        'sample descriptions are consistent enough that a single ' +
        '"contains", "matches" (regex) or "oneOf" condition on the payee ' +
        'description would not misfire on an unrelated payee, and when one ' +
        "category clearly dominates that payee's history. Skip a payee " +
        'entirely rather than propose a low-confidence rule for it. The ' +
        'rationale must explain, for a future auditor who did not see this ' +
        'history, why the rule is safe.',
    },
    {
      role: 'system',
      cacheable: true,
      text: `Categories:\n${formatCategories(input.categories)}`,
    },
    {
      role: 'user',
      text: `Candidates:\n${formatCandidates(input.candidates)}`,
    },
  ];
}

export const ruleMinerAgent: AgentDefinition<RuleMinerInput, RuleMinerOutput> =
  {
    name: 'rule-miner',
    tier: 'standard',
    buildPrompt: buildRuleMinerPrompt,
    outputSchema: ruleMinerOutputSchema,
  };
