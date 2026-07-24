import { z } from 'zod';

import type { AgentDefinition, PromptBlock } from '#types';

export type AuditorInput = {
  payeeName: string;
  amountCents: number;
  notes?: string;
  appliedCategoryName: string;
  /** The rule-miner's own rationale for why this rule was created, if the
   * hit came from a mined rule rather than a hand-written one. */
  ruleRationale?: string;
};

export const auditorOutputSchema = z.object({
  verdict: z.enum(['correct', 'incorrect', 'uncertain']),
  rationale: z.string(),
});

export type AuditorOutput = z.infer<typeof auditorOutputSchema>;

export function buildAuditorPrompt(input: AuditorInput): PromptBlock[] {
  return [
    {
      role: 'system',
      cacheable: true,
      text:
        'You audit a single transaction-categorization rule hit for a ' +
        'personal finance app. Judge only whether the applied category is ' +
        'plausible for this transaction given the payee, amount and any ' +
        'notes — you do not have the full account history. Say ' +
        '"uncertain" rather than guessing when the payee is genuinely ' +
        'ambiguous (e.g. a marketplace or a payment processor that could ' +
        'cover many purchase types).',
    },
    {
      role: 'user',
      text:
        `Payee: ${input.payeeName}\n` +
        `Amount (cents): ${input.amountCents}\n` +
        (input.notes ? `Notes: ${input.notes}\n` : '') +
        `Applied category: ${input.appliedCategoryName}\n` +
        (input.ruleRationale ? `Rule rationale: ${input.ruleRationale}\n` : ''),
    },
  ];
}

export const auditorAgent: AgentDefinition<AuditorInput, AuditorOutput> = {
  name: 'auditor',
  tier: 'fast',
  buildPrompt: buildAuditorPrompt,
  outputSchema: auditorOutputSchema,
};
