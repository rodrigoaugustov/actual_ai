import type { ClassifierOutput } from '#agents/classifier';

export type ClassifierGoldenCase = {
  id: string;
  expectedCategoryId: string | null;
  rejectedCategoryId: string | null;
};

export type ClassifierEvalResult = {
  total: number;
  passed: number;
  accuracy: number;
  coverage: number;
  failures: Array<{
    id: string;
    actualCategoryId: string | null;
    expectedCategoryId: string | null;
    rejectedCategoryId: string | null;
  }>;
};

/** Scores deterministic classifier output against decisions captured from
 * users. Corrections/acceptances require an exact category match; a bare
 * rejection passes only when the rejected category is not repeated. */
export function evaluateClassifierGoldenSet(
  goldenSet: ClassifierGoldenCase[],
  output: ClassifierOutput,
): ClassifierEvalResult {
  const predictions = new Map(
    output.items.map(item => [item.id, item.categoryId]),
  );
  const failures: ClassifierEvalResult['failures'] = [];
  let covered = 0;

  for (const goldenCase of goldenSet) {
    const hasPrediction = predictions.has(goldenCase.id);
    if (hasPrediction) covered++;
    const actualCategoryId = predictions.get(goldenCase.id) ?? null;
    const passed =
      hasPrediction &&
      (goldenCase.expectedCategoryId
        ? actualCategoryId === goldenCase.expectedCategoryId
        : actualCategoryId !== goldenCase.rejectedCategoryId);
    if (!passed) {
      failures.push({
        id: goldenCase.id,
        actualCategoryId,
        expectedCategoryId: goldenCase.expectedCategoryId,
        rejectedCategoryId: goldenCase.rejectedCategoryId,
      });
    }
  }

  const total = goldenSet.length;
  const passed = total - failures.length;
  return {
    total,
    passed,
    accuracy: total === 0 ? 1 : passed / total,
    coverage: total === 0 ? 1 : covered / total,
    failures,
  };
}
