import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { css } from '@emotion/css';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { nossoCaderninho } from '#style/nossoCaderninho';

export type CapacityMetric = {
  label: string;
  value: string;
  tone: 'partnership' | 'commitment' | 'balance' | 'limit';
};

type CapacityRailProps = {
  metrics: CapacityMetric[];
  action?: ReactNode;
  usedRatio: number;
  isOverPlan: boolean;
};

export function CapacityRail({
  metrics,
  action,
  usedRatio,
  isOverPlan,
}: CapacityRailProps) {
  const { t } = useTranslation();

  return (
    <section
      className={railClass}
      aria-label={t('Household capacity for this month')}
    >
      <div className={metricsClass}>
        {metrics.map(metric => (
          <div className={metricClass} key={metric.label}>
            <span>{metric.label}</span>
            <PrivacyFilter>
              <strong
                style={{
                  color: nossoCaderninho.color[metric.tone],
                }}
              >
                <FinancialText>{metric.value}</FinancialText>
              </strong>
            </PrivacyFilter>
          </div>
        ))}
        {action && <div className={actionClass}>{action}</div>}
      </div>

      <div className={trackClass} aria-hidden="true">
        <span
          style={{
            width: `${usedRatio}%`,
            backgroundColor: isOverPlan
              ? nossoCaderninho.color.limit
              : nossoCaderninho.color.commitment,
          }}
        />
        <span
          style={{
            flex: 1,
            backgroundColor: isOverPlan
              ? nossoCaderninho.color.limitSoft
              : nossoCaderninho.color.partnershipSoft,
          }}
        />
      </div>
    </section>
  );
}

const railClass = css({
  minWidth: 0,
  containerType: 'inline-size',
  backgroundColor: nossoCaderninho.color.plate,
  borderTop: `1px solid ${nossoCaderninho.color.railSoft}`,
});

const metricsClass = css({
  minWidth: 0,
  minHeight: 68,
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  alignItems: 'stretch',
  '& > * + *': {
    borderLeft: `1px solid ${nossoCaderninho.color.railSoft}`,
  },
  '@container (max-width: 520px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    '& > *': {
      borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
    },
    '& > :nth-child(3)': {
      borderLeft: 0,
    },
  },
});

const metricClass = css({
  minWidth: 0,
  padding: `${nossoCaderninho.space.sm}px ${nossoCaderninho.space.md}px`,
  display: 'grid',
  alignContent: 'center',
  gap: 3,
  '& > span': {
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 11,
    fontWeight: 600,
  },
  '& strong': {
    display: 'block',
    overflow: 'hidden',
    fontSize: 16,
    fontWeight: 650,
    fontVariantNumeric: 'tabular-nums',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

const actionClass = css({
  minWidth: 0,
  padding: `${nossoCaderninho.space.sm}px ${nossoCaderninho.space.md}px`,
  display: 'grid',
  alignContent: 'center',
  '& > div': {
    minWidth: 0,
  },
  '& span': {
    fontSize: 11,
  },
});

const trackClass = css({
  height: 8,
  display: 'flex',
  overflow: 'hidden',
  backgroundColor: nossoCaderninho.color.partnershipSoft,
  borderTop: `1px solid ${nossoCaderninho.color.railSoft}`,
  '& span': {
    minWidth: 0,
  },
});
