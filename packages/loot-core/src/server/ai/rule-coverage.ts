import type { RuleMinerCategory } from '@actual-app/ai';

import type { Rule } from '#server/rules';
// Detects when a candidate payee is already covered by an existing
// category-setting rule — manual or previously mined — so the miner never
// proposes a redundant rule for it (e.g. a manual rule keyed off the
// beneficiary/payee name when the miner would otherwise propose a second
// rule keyed off the raw imported description for the same payee).
//
// Deliberately deterministic: this reuses the exact `Condition`/`Rule`
// engine the app runs at sync time (see #server/rules) instead of an LLM
// semantic comparison, so "covered" means the rule would actually fire.
import { getRules } from '#server/transactions/transaction-rules';

export type CoverageCandidate = {
  payeeId: string | null;
  payeeName: string;
  /** Raw imported_payee variants seen for this payee (see rule-miner.ts). */
  sampleDescriptions: string[];
};

// `getRules()` itself resolves to `any[]` (its module-level cache is
// untyped in a `@ts-strict-ignore` file), so this file — which must be
// fully strict — annotates the real `Rule` class explicitly instead of
// inferring through `ReturnType<typeof getRules>`.
function getTypedRules(): Rule[] {
  return getRules();
}

function isCategorySettingRule(rule: Rule): boolean {
  return rule.actions.some(
    action => action.op === 'set' && action.field === 'category',
  );
}

function getCategoryRules(): Rule[] {
  return getTypedRules().filter(isCategorySettingRule);
}

/** Every field a manual or mined rule might realistically target for a
 * payee: the resolved payee id, its canonical display name ("beneficiário"
 * in the UI), and one raw imported_payee variant. Only one needs to match
 * for the rule to actually fire on a real transaction from this payee. */
function buildEvalObjects(candidate: CoverageCandidate): Array<{
  payee: string | null;
  payee_name: string;
  imported_payee: string;
}> {
  const variants =
    candidate.sampleDescriptions.length > 0
      ? candidate.sampleDescriptions
      : [candidate.payeeName];
  return variants.map(variant => ({
    payee: candidate.payeeId,
    payee_name: candidate.payeeName,
    imported_payee: variant,
  }));
}

/** Splits candidates into those an existing category rule would already
 * catch, and those that are genuinely uncovered. */
export function partitionByExistingRuleCoverage<T extends CoverageCandidate>(
  candidates: T[],
): { covered: T[]; uncovered: T[] } {
  const categoryRules = getCategoryRules();
  if (categoryRules.length === 0) {
    return { covered: [], uncovered: candidates };
  }

  const covered: T[] = [];
  const uncovered: T[] = [];
  for (const candidate of candidates) {
    const evalObjects = buildEvalObjects(candidate);
    const isCovered = categoryRules.some(rule =>
      evalObjects.some(object => rule.evalConditions(object)),
    );
    (isCovered ? covered : uncovered).push(candidate);
  }
  return { covered, uncovered };
}

/** Plain-language summaries of existing category rules, for the miner
 * prompt's "don't propose anything redundant with these" section. */
export function describeExistingCategoryRules(
  categories: RuleMinerCategory[],
): string[] {
  const categoryNameById = new Map(categories.map(c => [c.id, c.name]));
  return getCategoryRules().map(rule => {
    const categoryAction = rule.actions.find(
      action => action.op === 'set' && action.field === 'category',
    );
    const categoryName = categoryAction
      ? (categoryNameById.get(String(categoryAction.value)) ??
        String(categoryAction.value))
      : 'desconhecida';
    const joiner = rule.conditionsOp === 'or' ? ' OU ' : ' E ';
    const conditionsDesc = rule.conditions
      .map(
        condition =>
          `${condition.field} ${condition.op} ${JSON.stringify(condition.getValue())}`,
      )
      .join(joiner);
    return `Se ${conditionsDesc} então categoria = ${categoryName}`;
  });
}
