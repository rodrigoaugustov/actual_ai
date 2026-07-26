import { Trans, useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

import { SvgChatBubbleDots, SvgWallet } from '@actual-app/components/icons/v1';
import type { CategoryEntity } from '@actual-app/core/types/models';
import { css } from '@emotion/css';

import { FinancialText } from '#components/FinancialText';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useSheetValue } from '#hooks/useSheetValue';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { HousePanel } from './HousePanel';

type PlanningPanelProps = {
  budgetType: 'envelope' | 'tracking';
};

export function PlanningPanel({ budgetType }: PlanningPanelProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useCategories();
  const categories = (data?.list ?? [])
    .filter(category => !category.is_income && !category.hidden)
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))
    .slice(0, 5);

  return (
    <HousePanel
      title={<Trans>Planning</Trans>}
      description={<Trans>Where the family can still decide</Trans>}
    >
      {isLoading ? (
        <PlanningSkeleton label={t('Loading planning')} />
      ) : isError ? (
        <p className={errorClass}>
          <Trans>Planning could not be loaded.</Trans>
        </p>
      ) : categories.length === 0 ? (
        <p className={messageClass}>
          <Trans>Create expense categories to start planning.</Trans>
        </p>
      ) : (
        <div className={listClass}>
          <div className={tableHeaderClass} aria-hidden>
            <span>
              <Trans>Category</Trans>
            </span>
            <span>
              <Trans>Planned</Trans>
            </span>
            <span>
              <Trans>Available</Trans>
            </span>
          </div>
          {categories.map(category =>
            budgetType === 'envelope' ? (
              <EnvelopePlanningRow key={category.id} category={category} />
            ) : (
              <TrackingPlanningRow key={category.id} category={category} />
            ),
          )}
        </div>
      )}

      <NavLink to="/budget" className={footerActionClass}>
        <SvgWallet width={16} height={16} />
        <span>
          <Trans>Open full planning</Trans>
        </span>
        <span aria-hidden>→</span>
      </NavLink>

      <NavLink to="/advisor" className={assistantClass}>
        <SvgChatBubbleDots width={18} height={18} />
        <span>
          <strong>
            <Trans>Plan with the Assistant</Trans>
          </strong>
          <small>
            <Trans>Explore choices without changing your budget.</Trans>
          </small>
        </span>
        <span aria-hidden>→</span>
      </NavLink>
    </HousePanel>
  );
}

function EnvelopePlanningRow({ category }: { category: CategoryEntity }) {
  const budgeted =
    useSheetValue<'envelope-budget', 'budget'>(
      envelopeBudget.catBudgeted(category.id),
    ) ?? 0;
  const balance =
    useSheetValue<'envelope-budget', 'leftover'>(
      envelopeBudget.catBalance(category.id),
    ) ?? 0;
  return (
    <PlanningRow category={category} budgeted={budgeted} balance={balance} />
  );
}

function TrackingPlanningRow({ category }: { category: CategoryEntity }) {
  const budgeted =
    useSheetValue<'tracking-budget', 'budget'>(
      trackingBudget.catBudgeted(category.id),
    ) ?? 0;
  const balance =
    useSheetValue<'tracking-budget', 'leftover'>(
      trackingBudget.catBalance(category.id),
    ) ?? 0;
  return (
    <PlanningRow category={category} budgeted={budgeted} balance={balance} />
  );
}

function PlanningRow({
  category,
  budgeted,
  balance,
}: {
  category: CategoryEntity;
  budgeted: number;
  balance: number;
}) {
  const format = useFormat();
  return (
    <NavLink to={`/categories/${category.id}`} className={rowClass}>
      <span className={categoryClass}>{category.name}</span>
      <FinancialText as="span">
        {format(Math.abs(budgeted), 'financial')}
      </FinancialText>
      <FinancialText
        as="span"
        className={balance < 0 ? negativeAmountClass : undefined}
      >
        {format(balance, 'financial')}
      </FinancialText>
    </NavLink>
  );
}

function PlanningSkeleton({ label }: { label: string }) {
  return (
    <output className={skeletonClass} aria-label={label}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} />
      ))}
    </output>
  );
}

const listClass = css({
  minHeight: 214,
});

const tableHeaderClass = css({
  minHeight: 34,
  padding: `0 ${nossoCaderninho.space.lg}px`,
  display: 'grid',
  gridTemplateColumns: 'minmax(100px, 1fr) 92px 92px',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
  color: nossoCaderninho.color.graphiteSubdued,
  backgroundColor: nossoCaderninho.color.signalSoft,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 11,
  '& > :not(:first-child)': {
    textAlign: 'right',
  },
  '@container (max-width: 359px)': {
    gridTemplateColumns: 'minmax(90px, 1fr) 82px',
    '& > :nth-child(2)': {
      display: 'none',
    },
  },
});

const rowClass = css({
  minHeight: 45,
  padding: `0 ${nossoCaderninho.space.lg}px`,
  display: 'grid',
  gridTemplateColumns: 'minmax(100px, 1fr) 92px 92px',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
  color: nossoCaderninho.color.graphite,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 12,
  textDecoration: 'none',
  transition: `background-color ${nossoCaderninho.motion.duration} ${nossoCaderninho.motion.easing}`,
  '&:hover': {
    backgroundColor: nossoCaderninho.color.signalSoft,
  },
  '&:focus-visible': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: -2,
  },
  '& > :not(:first-child)': {
    justifySelf: 'end',
    whiteSpace: 'nowrap',
  },
  '@container (max-width: 359px)': {
    gridTemplateColumns: 'minmax(90px, 1fr) 82px',
    '& > :nth-child(2)': {
      display: 'none',
    },
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
});

const categoryClass = css({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontWeight: 600,
});

const negativeAmountClass = css({
  color: nossoCaderninho.color.limit,
});

const footerActionClass = css({
  minHeight: 48,
  padding: `0 ${nossoCaderninho.space.lg}px`,
  display: 'grid',
  gridTemplateColumns: '20px minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
  color: nossoCaderninho.color.partnership,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 13,
  fontWeight: 650,
  textDecoration: 'none',
  '&:hover': {
    backgroundColor: nossoCaderninho.color.partnershipSoft,
  },
  '&:focus-visible': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: -2,
  },
});

const assistantClass = css({
  minHeight: 68,
  padding: `${nossoCaderninho.space.md}px ${nossoCaderninho.space.lg}px`,
  display: 'grid',
  gridTemplateColumns: '22px minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
  color: nossoCaderninho.color.graphite,
  backgroundColor: nossoCaderninho.color.partnershipSoft,
  borderTop: `1px solid ${nossoCaderninho.color.railSoft}`,
  fontFamily: nossoCaderninho.font.family,
  textDecoration: 'none',
  '& > span:nth-child(2)': {
    minWidth: 0,
    display: 'grid',
    gap: 2,
  },
  '& strong': {
    color: nossoCaderninho.color.partnership,
    fontSize: 13,
  },
  '& small': {
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 11,
    lineHeight: 1.35,
  },
  '&:hover': {
    backgroundColor: nossoCaderninho.color.signalSoft,
  },
  '&:focus-visible': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: -2,
  },
});

const messageClass = css({
  minHeight: 214,
  margin: 0,
  padding: nossoCaderninho.space.xl,
  display: 'flex',
  alignItems: 'center',
  color: nossoCaderninho.color.graphiteSubdued,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 13,
  lineHeight: 1.45,
});

const errorClass = css(messageClass, {
  color: nossoCaderninho.color.limit,
  backgroundColor: nossoCaderninho.color.limitSoft,
});

const skeletonClass = css({
  minHeight: 214,
  padding: nossoCaderninho.space.lg,
  display: 'grid',
  alignContent: 'start',
  gap: nossoCaderninho.space.md,
  '& span': {
    height: 22,
    borderRadius: nossoCaderninho.radius.control,
    backgroundColor: nossoCaderninho.color.signalSoft,
  },
});
