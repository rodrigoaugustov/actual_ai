import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgCheveronDown,
  SvgCheveronRight,
} from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { AiTraceDetail, AiTracePart } from '@actual-app/core/types/models';
import type { TFunction } from 'i18next';

function toolLabel(toolName: string | undefined, t: TFunction): string {
  switch (toolName) {
    case 'describe_financial_data':
      return t('Mapping available financial data');
    case 'run_financial_analysis':
      return t('Running a financial analysis');
    case 'get_financial_snapshot':
      return t('Reviewing balances and net worth');
    case 'get_cash_flow':
      return t('Calculating cash flow');
    case 'get_spending_by_category':
      return t('Analyzing spending by category');
    case 'search_transactions':
      return t('Finding relevant transactions');
    case 'get_budget_month':
      return t('Reviewing the monthly budget');
    case 'get_credit_card_statements':
      return t('Reviewing credit card statements');
    case 'search_advisor_context':
      return t('Finding relevant context');
    case 'get_advisor_profile':
      return t('Reviewing the confirmed profile');
    case 'propose_memory':
      return t('Preparing a memory for review');
    case 'propose_advice':
      return t('Preparing a recommendation for review');
    default:
      return t('Running a safe step');
  }
}

function traceLabel(trace: AiTracePart, t: TFunction): string {
  switch (trace.kind) {
    case 'understanding':
      return t('Understanding your request');
    case 'context':
      return t('Retrieving confirmed context');
    case 'planning':
      return trace.toolName
        ? t('Refining the analysis approach')
        : t('Planning the analysis');
    case 'tool':
      return toolLabel(trace.toolName, t);
    case 'validation':
      return t('Validating data coverage');
    case 'retry':
      return trace.toolName
        ? t('Correcting and retrying the query')
        : t('Preparing the final synthesis');
    case 'composing':
      return t('Composing the answer');
    default:
      return t('Running a safe step');
  }
}

function Detail({
  detail,
  startedAt,
  completedAt,
}: {
  detail: AiTraceDetail | undefined;
  startedAt: number;
  completedAt: number | undefined;
}) {
  const { t } = useTranslation();
  const rows: string[] = [];

  if (detail?.dataset) {
    rows.push(t('Dataset: {{dataset}}', { dataset: detail.dataset }));
  }
  if (detail?.periodStart && detail.periodEnd) {
    rows.push(
      t('Period: {{start}} to {{end}}', {
        start: detail.periodStart,
        end: detail.periodEnd,
      }),
    );
  } else if (detail?.periodStart) {
    rows.push(t('Period: {{period}}', { period: detail.periodStart }));
  }
  if (detail?.fields?.length) {
    rows.push(t('Fields: {{fields}}', { fields: detail.fields.join(', ') }));
  }
  if (detail?.dimensions?.length) {
    rows.push(
      t('Dimensions: {{dimensions}}', {
        dimensions: detail.dimensions.join(', '),
      }),
    );
  }
  if (detail?.metrics?.length) {
    rows.push(
      t('Metrics: {{metrics}}', { metrics: detail.metrics.join(', ') }),
    );
  }
  if (detail?.filters?.length) {
    rows.push(
      t('Filters: {{filters}}', { filters: detail.filters.join(', ') }),
    );
  }
  if (detail?.memoryCount != null) {
    rows.push(
      t(
        '{{memories}} confirmed memories · {{goals}} goals · {{sources}} relevant sources',
        {
          memories: detail.memoryCount,
          goals: detail.goalCount ?? 0,
          sources: detail.sourceCount ?? 0,
        },
      ),
    );
  }
  if (detail?.sourceRows != null) {
    rows.push(
      t('{{count}} source records examined', { count: detail.sourceRows }),
    );
  }
  if (detail?.resultRows != null || detail?.returnedRows != null) {
    rows.push(
      t('{{results}} results · {{returned}} returned', {
        results: detail.resultRows ?? 0,
        returned: detail.returnedRows ?? 0,
      }),
    );
  } else if (detail?.count != null) {
    rows.push(t('{{count}} items returned', { count: detail.count }));
  }
  if (detail?.complete != null) {
    rows.push(
      detail.complete
        ? t('Coverage complete')
        : t('Coverage refined before the answer'),
    );
  }
  if (detail?.attempt != null) {
    rows.push(t('Attempt {{attempt}}', { attempt: detail.attempt }));
  }
  if (completedAt != null && completedAt - startedAt >= 1_000) {
    rows.push(
      t('Completed in {{seconds}}s', {
        seconds: ((completedAt - startedAt) / 1_000).toFixed(1),
      }),
    );
  }

  if (rows.length === 0) return null;
  return (
    <View style={{ gap: 2, marginTop: 3 }}>
      {rows.map(row => (
        <Text key={row} style={{ color: theme.pageTextSubdued, fontSize: 11 }}>
          {row}
        </Text>
      ))}
    </View>
  );
}

export function AdvisorTrace({
  trace,
  isRunning,
}: {
  trace: AiTracePart[];
  isRunning: boolean;
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(isRunning);
  const wasRunning = useRef(isRunning);

  useEffect(() => {
    if (isRunning) {
      setIsExpanded(true);
    } else if (wasRunning.current) {
      setIsExpanded(false);
    }
    wasRunning.current = isRunning;
  }, [isRunning]);

  if (trace.length === 0) return null;

  const orderedTrace = [...trace].sort(
    (left, right) => left.startedAt - right.startedAt,
  );
  const current =
    [...orderedTrace].reverse().find(item => item.state === 'running') ??
    orderedTrace.at(-1);
  const ExpandIcon = isExpanded ? SvgCheveronDown : SvgCheveronRight;
  const traceTitle = isRunning
    ? t('Working through your request')
    : t('How this analysis was built');

  return (
    <View
      data-testid="advisor-trace"
      style={{
        marginBottom: 10,
        border: `1px solid ${theme.pillBorderDark}`,
        borderRadius: 8,
        backgroundColor: theme.pageBackground,
        overflow: 'hidden',
      }}
    >
      <Button
        variant="bare"
        aria-label={traceTitle}
        aria-expanded={isExpanded}
        onPress={() => setIsExpanded(value => !value)}
        style={{
          width: '100%',
          minHeight: 38,
          padding: '7px 9px',
          justifyContent: 'flex-start',
          gap: 7,
        }}
      >
        <ExpandIcon width={12} height={12} />
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: 600 }}>{traceTitle}</Text>
          {!isExpanded && current && (
            <Text
              style={{
                color: theme.pageTextSubdued,
                fontSize: 11,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {traceLabel(current, t)}
            </Text>
          )}
        </View>
      </Button>
      {isExpanded && (
        <View
          aria-label={t('Analysis execution details')}
          style={{ padding: '2px 12px 10px' }}
        >
          {orderedTrace.map((item, index) => (
            <View
              key={item.id}
              style={{
                position: 'relative',
                flexDirection: 'row',
                gap: 9,
                paddingBottom: index === orderedTrace.length - 1 ? 0 : 10,
              }}
            >
              {index < orderedTrace.length - 1 && (
                <View
                  style={{
                    position: 'absolute',
                    left: 4,
                    top: 10,
                    bottom: 0,
                    width: 1,
                    backgroundColor: theme.pillBorderDark,
                  }}
                />
              )}
              <View
                aria-hidden
                style={{
                  zIndex: 1,
                  width: 9,
                  height: 9,
                  flexShrink: 0,
                  marginTop: 4,
                  borderRadius: 999,
                  backgroundColor:
                    item.state === 'error'
                      ? theme.errorText
                      : item.state === 'running'
                        ? theme.buttonPrimaryBackground
                        : theme.noticeText,
                }}
              />
              <View style={{ minWidth: 0, flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: 500 }}>
                  {traceLabel(item, t)}
                </Text>
                <Text style={{ color: theme.pageTextSubdued, fontSize: 11 }}>
                  {item.state === 'running'
                    ? t('In progress…')
                    : item.state === 'error'
                      ? t('This step could not be completed')
                      : t('Completed')}
                </Text>
                <Detail
                  detail={item.detail}
                  startedAt={item.startedAt}
                  completedAt={item.completedAt}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
