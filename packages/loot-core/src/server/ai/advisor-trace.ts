import type { AiTraceDetail } from '#types/models/ai';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function safeIdentifier(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    value.length > 80 ||
    !/^[a-zA-Z][a-zA-Z0-9_ -]*$/.test(value)
  ) {
    return undefined;
  }
  return value;
}

function safeDate(value: unknown): string | undefined {
  return typeof value === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(value)
    ? value
    : undefined;
}

function safeCount(value: unknown): number | undefined {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 1_000_000_000
    ? value
    : undefined;
}

function safeIdentifiers(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const identifiers = value
    .map(safeIdentifier)
    .filter((item): item is string => item != null)
    .slice(0, 12);
  return identifiers.length > 0 ? identifiers : undefined;
}

function summarizeMetrics(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const metrics = value
    .map(metric => {
      if (!isRecord(metric)) return undefined;
      const alias = safeIdentifier(metric.alias);
      const operation = safeIdentifier(metric.operation);
      return alias && operation ? `${alias} (${operation})` : alias;
    })
    .filter((item): item is string => item != null)
    .slice(0, 12);
  return metrics.length > 0 ? metrics : undefined;
}

function summarizeFilters(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const filters = value
    .map(filter => {
      if (!isRecord(filter)) return undefined;
      const field = safeIdentifier(filter.field);
      const operator = safeIdentifier(filter.operator);
      return field && operator ? `${field} (${operator})` : undefined;
    })
    .filter((item): item is string => item != null)
    .slice(0, 12);
  return filters.length > 0 ? filters : undefined;
}

export function summarizeAdvisorToolInput(
  toolName: string,
  input: unknown,
): AiTraceDetail | undefined {
  if (!isRecord(input)) return undefined;

  const detail: AiTraceDetail = {
    periodStart: safeDate(input.startDate),
    periodEnd: safeDate(input.endDate),
  };

  if (toolName === 'run_financial_analysis') {
    detail.dataset = safeIdentifier(input.dataset);
    detail.fields = safeIdentifiers(input.fields);
    detail.dimensions = safeIdentifiers(input.dimensions);
    detail.metrics = summarizeMetrics(input.metrics);
    detail.filters = summarizeFilters(input.filters);
  } else if (toolName === 'describe_financial_data') {
    detail.dataset = safeIdentifier(input.dataset);
  } else if (toolName === 'get_budget_month') {
    detail.periodStart = safeDate(input.month);
  }

  return Object.values(detail).some(value => value != null)
    ? detail
    : undefined;
}

function arrayCount(record: UnknownRecord): number | undefined {
  for (const key of [
    'rows',
    'categories',
    'statements',
    'accounts',
    'memories',
    'goals',
    'advice',
  ]) {
    if (Array.isArray(record[key])) return record[key].length;
  }
  return undefined;
}

export function summarizeAdvisorToolResult(
  output: unknown,
): AiTraceDetail | undefined {
  if (Array.isArray(output)) {
    return { count: output.length };
  }
  if (!isRecord(output)) return undefined;

  const count = arrayCount(output);
  const dataset = safeIdentifier(output.dataset);
  const detail: AiTraceDetail = { count, dataset };
  return Object.values(detail).some(value => value != null)
    ? detail
    : undefined;
}

export function summarizeAdvisorCoverage(
  output: unknown,
): AiTraceDetail | undefined {
  if (!isRecord(output) || !isRecord(output.coverage)) return undefined;
  const coverage = output.coverage;
  const detail: AiTraceDetail = {
    sourceRows: safeCount(coverage.sourceRows),
    resultRows:
      safeCount(coverage.resultRows) ?? safeCount(coverage.totalCount),
    returnedRows:
      safeCount(coverage.returnedRows) ?? safeCount(coverage.returnedCount),
    complete:
      typeof coverage.complete === 'boolean' ? coverage.complete : undefined,
    hasMore:
      typeof coverage.hasMore === 'boolean' ? coverage.hasMore : undefined,
  };
  return Object.values(detail).some(value => value != null)
    ? detail
    : undefined;
}
