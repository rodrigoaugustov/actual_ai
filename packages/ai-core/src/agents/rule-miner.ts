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

export type RuleMinerRejectedExample = {
  payeeName: string;
  categoryId: string;
};

export type RuleMinerInput = {
  categories: RuleMinerCategory[];
  candidates: RuleMinerCandidate[];
  /** Payee/category pairs the user has already rejected as a mined
   * proposal — never propose these exact pairs again. */
  rejectedExamples: RuleMinerRejectedExample[];
  /** Plain-language descriptions of category rules that already exist
   * (manual or previously approved), so the model doesn't propose a rule
   * that duplicates one already covering the payee under a different
   * field (e.g. payee name vs. raw imported description). */
  existingRuleDescriptions: string[];
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

function formatExistingRules(descriptions: string[]): string {
  if (descriptions.length === 0) return 'None yet.';
  return descriptions.map(d => `- ${d}`).join('\n');
}

function formatRejectedExamples(rejected: RuleMinerRejectedExample[]): string {
  if (rejected.length === 0) return 'None yet.';
  return rejected
    .map(r => `- payee "${r.payeeName}" -> category ${r.categoryId}`)
    .join('\n');
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
        'history, why the rule is safe. Before proposing anything, check ' +
        'the "Existing rules" and "Already rejected" sections below: never ' +
        'propose a rule that duplicates an existing one (even keyed off a ' +
        'different field for the same payee), and never propose an ' +
        'already-rejected payee/category pair again.',
    },
    {
      role: 'system',
      cacheable: true,
      text: `Categories:\n${formatCategories(input.categories)}`,
    },
    {
      role: 'system',
      text: `Existing rules (do not propose anything redundant with these):\n${formatExistingRules(input.existingRuleDescriptions)}`,
    },
    {
      role: 'system',
      text: `Already rejected by the user (never propose these exact pairs again):\n${formatRejectedExamples(input.rejectedExamples)}`,
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
