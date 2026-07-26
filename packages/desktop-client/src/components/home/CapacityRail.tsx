import { Trans, useTranslation } from 'react-i18next';

import { css } from '@emotion/css';

import { FinancialText } from '#components/FinancialText';
import { useFormat } from '#hooks/useFormat';
import { useSheetValue } from '#hooks/useSheetValue';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';
import { nossoCaderninho } from '#style/nossoCaderninho';

type CapacityRailProps = {
  budgetType: 'envelope' | 'tracking';
};

type CapacityValues = {
  committed: number;
  planned: number;
  available: number;
};

export function CapacityRail({ budgetType }: CapacityRailProps) {
  return budgetType === 'tracking' ? (
    <TrackingCapacityRail />
  ) : (
    <EnvelopeCapacityRail />
  );
}

function EnvelopeCapacityRail() {
  const totalBudgeted =
    useSheetValue<'envelope-budget', 'total-budgeted'>(
      envelopeBudget.totalBudgeted,
    ) ?? 0;
  const totalSpent =
    useSheetValue<'envelope-budget', 'total-spent'>(
      envelopeBudget.totalSpent,
    ) ?? 0;
  const toBudget =
    useSheetValue<'envelope-budget', 'to-budget'>(envelopeBudget.toBudget) ?? 0;

  return (
    <CapacityRailView
      values={deriveCapacityValues(totalBudgeted, totalSpent, toBudget)}
    />
  );
}

function TrackingCapacityRail() {
  const totalBudgeted =
    useSheetValue<'tracking-budget', 'total-budgeted'>(
      trackingBudget.totalBudgetedExpense,
    ) ?? 0;
  const totalSpent =
    useSheetValue<'tracking-budget', 'total-spent'>(
      trackingBudget.totalSpent,
    ) ?? 0;
  const totalLeftover =
    useSheetValue<'tracking-budget', 'total-leftover'>(
      trackingBudget.totalLeftover,
    ) ?? 0;

  return (
    <CapacityRailView
      values={deriveCapacityValues(totalBudgeted, totalSpent, totalLeftover)}
    />
  );
}

function CapacityRailView({ values }: { values: CapacityValues }) {
  const { t } = useTranslation();
  const format = useFormat();
  const total =
    values.committed + values.planned + Math.max(values.available, 0);
  const hasCapacity = total > 0;
  const segments = [
    {
      key: 'committed',
      label: t('Committed'),
      value: values.committed,
      color: nossoCaderninho.color.commitment,
    },
    {
      key: 'planned',
      label: t('Planned'),
      value: values.planned,
      color: nossoCaderninho.color.partnership,
    },
    {
      key: 'available',
      label: t('Available'),
      value: Math.max(values.available, 0),
      color:
        values.available < 0
          ? nossoCaderninho.color.limit
          : nossoCaderninho.color.balance,
    },
  ];

  return (
    <section className={containerClass} aria-labelledby="capacity-title">
      <header className={capacityHeaderClass}>
        <h2 id="capacity-title" className={capacityTitleClass}>
          <Trans>Capacity for the month</Trans>
        </h2>
        <FinancialText
          as="span"
          style={{
            color:
              values.available < 0
                ? nossoCaderninho.color.limit
                : nossoCaderninho.color.balance,
            fontFamily: nossoCaderninho.font.family,
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          {format(values.available, 'financial')}{' '}
          <span className={availableLabelClass}>
            <Trans>available</Trans>
          </span>
        </FinancialText>
      </header>

      {hasCapacity ? (
        <>
          <figure
            className={railClass}
            aria-label={t(
              'Month capacity: {{committed}} committed, {{planned}} planned, {{available}} available',
              {
                committed: format(values.committed, 'financial'),
                planned: format(values.planned, 'financial'),
                available: format(values.available, 'financial'),
              },
            )}
          >
            {segments.map(segment => (
              <div
                key={segment.key}
                className={segmentClass}
                style={{
                  flexGrow: segment.value,
                  backgroundColor: segment.color,
                }}
              />
            ))}
          </figure>
          <div className={legendClass}>
            {segments.map(segment => (
              <div key={segment.key} className={legendItemClass}>
                <span
                  className={markerClass}
                  style={{ backgroundColor: segment.color }}
                />
                <span>{segment.label}</span>
                <FinancialText as="strong">
                  {format(
                    segment.key === 'available'
                      ? values.available
                      : segment.value,
                    'financial',
                  )}
                </FinancialText>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className={emptyRailClass}>
          <Trans>
            Add income and planning values to see the capacity for this month.
          </Trans>
        </div>
      )}
    </section>
  );
}

function deriveCapacityValues(
  totalBudgeted: number,
  totalSpent: number,
  available: number,
): CapacityValues {
  const budgeted = Math.abs(totalBudgeted);
  const committed = Math.abs(totalSpent);

  return {
    committed,
    planned: Math.max(budgeted - committed, 0),
    available,
  };
}

const containerClass = css({
  maxWidth: 1480,
  margin: '0 auto',
  backgroundColor: nossoCaderninho.color.plate,
  border: `1px solid ${nossoCaderninho.color.rail}`,
  borderRadius: nossoCaderninho.radius.panel,
  padding: nossoCaderninho.space.lg,
  fontFamily: nossoCaderninho.font.family,
  '@media (max-width: 729px)': {
    borderRight: 0,
    borderLeft: 0,
    borderRadius: 0,
  },
});

const capacityHeaderClass = css({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: nossoCaderninho.space.lg,
  marginBottom: nossoCaderninho.space.md,
  '@media (max-width: 511px)': {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: nossoCaderninho.space.xs,
  },
});

const capacityTitleClass = css({
  margin: 0,
  color: nossoCaderninho.color.graphite,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 17,
  fontWeight: 650,
  lineHeight: 1.25,
});

const availableLabelClass = css({
  color: 'inherit',
  fontFamily: nossoCaderninho.font.family,
  fontSize: 13,
  fontWeight: 500,
});

const railClass = css({
  display: 'flex',
  height: 46,
  margin: 0,
  overflow: 'hidden',
  borderRadius: nossoCaderninho.radius.control,
  backgroundColor: nossoCaderninho.color.signalSoft,
  border: `1px solid ${nossoCaderninho.color.railSoft}`,
  '& > div + div': {
    borderLeft: `1px solid ${nossoCaderninho.color.plate}`,
  },
});

const segmentClass = css({
  minWidth: 4,
  transition: `flex-grow ${nossoCaderninho.motion.duration} ${nossoCaderninho.motion.easing}`,
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
});

const legendClass = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: nossoCaderninho.space.md,
  marginTop: nossoCaderninho.space.md,
  '@media (max-width: 511px)': {
    gap: nossoCaderninho.space.sm,
  },
});

const legendItemClass = css({
  minWidth: 0,
  display: 'grid',
  gridTemplateColumns: '8px minmax(0, 1fr)',
  alignItems: 'center',
  columnGap: nossoCaderninho.space.sm,
  color: nossoCaderninho.color.graphiteSubdued,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 12,
  lineHeight: 1.3,
  '& strong': {
    gridColumn: '2',
    color: nossoCaderninho.color.graphite,
    fontSize: 13,
  },
  '@media (max-width: 511px)': {
    gridTemplateColumns: '8px minmax(0, 1fr)',
    fontSize: 10,
    '& strong': {
      fontSize: 11,
    },
  },
});

const markerClass = css({
  width: 8,
  height: 8,
  borderRadius: nossoCaderninho.radius.status,
});

const emptyRailClass = css({
  minHeight: 68,
  display: 'flex',
  alignItems: 'center',
  color: nossoCaderninho.color.graphiteSubdued,
  backgroundColor: nossoCaderninho.color.signalSoft,
  borderRadius: nossoCaderninho.radius.control,
  padding: nossoCaderninho.space.lg,
  fontSize: 14,
});
