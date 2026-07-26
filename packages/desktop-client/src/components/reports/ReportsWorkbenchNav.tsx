import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';

import { useNavigate } from '#hooks/useNavigate';

import {
  reportsNavigatorClass,
  reportsNavigatorItemClass,
} from './reportsStyles';

type ReportsWorkbenchNavProps = {
  dashboardId: string;
  hasBudgetAnalysis: boolean;
  hasBalanceForecast: boolean;
  hasSankey: boolean;
  onNavigate?: () => void;
};

type AnalysisDestination = {
  label: string;
  path: string;
};

export function ReportsWorkbenchNav({
  dashboardId,
  hasBudgetAnalysis,
  hasBalanceForecast,
  hasSankey,
  onNavigate,
}: ReportsWorkbenchNavProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const destinations: AnalysisDestination[] = [
    { label: t('Overview'), path: `/reports/${dashboardId}` },
    { label: t('Net worth'), path: '/reports/net-worth' },
    { label: t('Cash flow'), path: '/reports/cash-flow' },
    { label: t('Compare spending'), path: '/reports/spending' },
    ...(hasBudgetAnalysis
      ? [{ label: t('Budget analysis'), path: '/reports/budget-analysis' }]
      : []),
    ...(hasBalanceForecast
      ? [{ label: t('Balance forecast'), path: '/reports/forecast' }]
      : []),
    ...(hasSankey
      ? [{ label: t('Financial flow'), path: '/reports/sankey' }]
      : []),
    { label: t('Calendar'), path: '/reports/calendar' },
    { label: t('Saved reports'), path: '/reports/custom' },
  ];

  return (
    <nav className={reportsNavigatorClass} aria-label={t('Analyses library')}>
      <h2>
        <Trans>Analyses library</Trans>
      </h2>
      {destinations.map((destination, index) => (
        <Button
          key={destination.path}
          variant="bare"
          className={reportsNavigatorItemClass}
          data-current={index === 0}
          aria-current={index === 0 ? 'page' : undefined}
          onPress={() => {
            void navigate(destination.path);
            onNavigate?.();
          }}
        >
          <span>{destination.label}</span>
          <span aria-hidden>→</span>
        </Button>
      ))}
    </nav>
  );
}
