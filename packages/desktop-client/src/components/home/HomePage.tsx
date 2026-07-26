import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgArrowLeft,
  SvgArrowRight,
  SvgHome,
} from '@actual-app/components/icons/v1';
import { listen } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { css } from '@emotion/css';

import { useLocale } from '#hooks/useLocale';
import { useMetadataPref } from '#hooks/useMetadataPref';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { AttentionPanel } from './AttentionPanel';
import { CapacityRail } from './CapacityRail';
import { CommitmentsPanel } from './CommitmentsPanel';
import { PlanningPanel } from './PlanningPanel';

/*
THESIS — A casa financeira é lida como um quadro contínuo de decisões compartilhadas.
OWN-WORLD — Esmalte frio, placas brancas e trilhos funcionais formam uma linguagem própria.
STORY — Orientar, revelar atenção, confirmar compromissos e abrir espaço para planejar.
FIRST VIEWPORT — Mês e capacidade chegam antes da densidade operacional dos três painéis.
FORM — Painel Contínuo, posição 5 da direção selecionada, capacity-first; seed b680df13.
*/
export function HomePage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const [month, setMonth] = useState(monthUtils.currentMonth());
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const isTracking = budgetType === 'tracking';
  const syncSummary = useSyncSummary();
  const monthLabel = monthUtils.format(month, 'MMMM yyyy', locale);

  return (
    <main className={pageClass}>
      <header className={headerClass}>
        <div className={identityClass}>
          <span className={markClass} aria-hidden>
            <SvgHome width={18} height={18} />
          </span>
          <span>
            <h1 className={titleClass}>
              <Trans>Our home today</Trans>
            </h1>
            <p className={subtitleClass}>
              <Trans>A shared view of the month</Trans>
            </p>
          </span>
        </div>

        <div className={connectionClass} data-tone={syncSummary.tone}>
          <span aria-hidden />
          {syncSummary.label}
        </div>
      </header>

      <div className={monthBarClass}>
        <Button
          variant="bare"
          aria-label={t('Previous month')}
          onPress={() => setMonth(current => monthUtils.prevMonth(current))}
          className={monthButtonClass}
        >
          <SvgArrowLeft width={17} height={17} />
        </Button>
        <div className={monthClass} aria-live="polite">
          <strong>{capitalize(monthLabel)}</strong>
          {month !== monthUtils.currentMonth() && (
            <Button
              variant="bare"
              onPress={() => setMonth(monthUtils.currentMonth())}
              className={todayButtonClass}
            >
              <Trans>Go to current month</Trans>
            </Button>
          )}
        </div>
        <Button
          variant="bare"
          aria-label={t('Next month')}
          onPress={() => setMonth(current => monthUtils.nextMonth(current))}
          className={monthButtonClass}
        >
          <SvgArrowRight width={17} height={17} />
        </Button>
      </div>

      <SheetNameProvider name={monthUtils.sheetForMonth(month)}>
        <CapacityRail budgetType={isTracking ? 'tracking' : 'envelope'} />
        <div className={panelsClass}>
          <AttentionPanel month={month} />
          <CommitmentsPanel month={month} />
          <PlanningPanel budgetType={isTracking ? 'tracking' : 'envelope'} />
        </div>
      </SheetNameProvider>
    </main>
  );
}

type SyncSummary = {
  tone: 'healthy' | 'neutral' | 'attention';
  label: ReactNode;
};

function useSyncSummary(): SyncSummary {
  const [cloudFileId] = useMetadataPref('cloudFileId');
  const [syncState, setSyncState] = useState<
    'ready' | 'syncing' | 'synced' | 'offline' | 'error'
  >(() => (navigator.onLine ? 'ready' : 'offline'));

  useEffect(() => {
    function updateStatus() {
      setSyncState(current =>
        navigator.onLine
          ? current === 'offline'
            ? 'ready'
            : current
          : 'offline',
      );
    }
    const unlisten = listen('sync-event', event => {
      if (event.type === 'start') {
        setSyncState('syncing');
      } else if (event.type === 'success') {
        setSyncState('synced');
      } else if (event.type === 'error') {
        setSyncState(event.subtype === 'network' ? 'offline' : 'error');
      }
    });
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      unlisten();
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  if (!cloudFileId) {
    return {
      tone: 'neutral',
      label: <Trans>Local file · works offline</Trans>,
    };
  }
  if (syncState === 'offline') {
    return {
      tone: 'neutral',
      label: <Trans>Offline · changes stay on this device</Trans>,
    };
  }
  if (syncState === 'syncing') {
    return { tone: 'healthy', label: <Trans>Syncing</Trans> };
  }
  if (syncState === 'synced') {
    return { tone: 'healthy', label: <Trans>Synced</Trans> };
  }
  if (syncState === 'error') {
    return {
      tone: 'attention',
      label: <Trans>Sync needs attention</Trans>,
    };
  }
  return {
    tone: 'neutral',
    label: <Trans>Online · sync available</Trans>,
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

const pageClass = css({
  minHeight: '100%',
  padding: `58px ${nossoCaderninho.space.xl}px ${nossoCaderninho.space.xxl}px`,
  color: nossoCaderninho.color.graphite,
  backgroundColor: nossoCaderninho.color.enamel,
  fontFamily: nossoCaderninho.font.family,
  '@media (max-width: 729px)': {
    padding: `18px 0 128px`,
  },
});

const headerClass = css({
  maxWidth: 1480,
  minHeight: 58,
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: nossoCaderninho.space.lg,
  '@media (max-width: 729px)': {
    minHeight: 54,
    padding: `0 ${nossoCaderninho.space.lg}px`,
  },
});

const identityClass = css({
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: nossoCaderninho.space.md,
});

const markClass = css({
  width: 36,
  height: 36,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: nossoCaderninho.color.plate,
  backgroundColor: nossoCaderninho.color.partnership,
  borderRadius: nossoCaderninho.radius.control,
});

const titleClass = css({
  margin: 0,
  color: nossoCaderninho.color.graphite,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 20,
  fontWeight: 720,
  letterSpacing: '-0.02em',
  lineHeight: 1.1,
});

const subtitleClass = css({
  margin: '3px 0 0',
  color: nossoCaderninho.color.graphiteSubdued,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 12,
});

const connectionClass = css({
  display: 'flex',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
  color: nossoCaderninho.color.graphiteSubdued,
  fontSize: 11,
  '& > span': {
    width: 7,
    height: 7,
    borderRadius: nossoCaderninho.radius.status,
    backgroundColor: nossoCaderninho.color.limit,
  },
  '&[data-tone="healthy"] > span': {
    backgroundColor: nossoCaderninho.color.balance,
  },
  '&[data-tone="neutral"] > span': {
    backgroundColor: nossoCaderninho.color.graphiteSubdued,
  },
  '@media (max-width: 520px)': {
    maxWidth: 112,
    textAlign: 'right',
    lineHeight: 1.25,
  },
});

const monthBarClass = css({
  maxWidth: 1480,
  minHeight: 54,
  margin: `${nossoCaderninho.space.md}px auto 0`,
  padding: `0 ${nossoCaderninho.space.sm}px`,
  display: 'grid',
  gridTemplateColumns: '40px minmax(0, 1fr) 40px',
  alignItems: 'center',
  backgroundColor: nossoCaderninho.color.plate,
  border: `1px solid ${nossoCaderninho.color.railSoft}`,
  borderRadius: `${nossoCaderninho.radius.panel}px ${nossoCaderninho.radius.panel}px 0 0`,
  '@media (max-width: 729px)': {
    marginTop: nossoCaderninho.space.md,
    borderLeft: 0,
    borderRight: 0,
    borderRadius: 0,
  },
});

const monthButtonClass = css({
  width: 36,
  height: 36,
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: nossoCaderninho.color.partnership,
  borderRadius: nossoCaderninho.radius.control,
  '&[data-hovered]': {
    backgroundColor: nossoCaderninho.color.partnershipSoft,
  },
  '&[data-focus-visible]': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: 1,
  },
});

const monthClass = css({
  minWidth: 0,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'center',
  gap: nossoCaderninho.space.sm,
  '& strong': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: nossoCaderninho.color.graphite,
    fontSize: 16,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
});

const todayButtonClass = css({
  padding: '2px 6px',
  color: nossoCaderninho.color.partnership,
  fontSize: 11,
  borderRadius: nossoCaderninho.radius.control,
  '&[data-hovered]': {
    backgroundColor: nossoCaderninho.color.partnershipSoft,
  },
});

const panelsClass = css({
  maxWidth: 1480,
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 1fr)',
  alignItems: 'start',
  '@media (max-width: 1279px)': {
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    '& > :last-child': {
      gridColumn: '1 / -1',
      borderLeft: `1px solid ${nossoCaderninho.color.railSoft}`,
    },
  },
  '@media (max-width: 899px)': {
    gridTemplateColumns: 'minmax(0, 1fr)',
    '& > *': {
      borderLeft: 0,
    },
    '& > :last-child': {
      gridColumn: 'auto',
      borderLeft: 0,
    },
  },
  '@media (max-width: 729px)': {
    display: 'block',
    '& > *': {
      borderLeft: 0,
      borderRight: 0,
    },
  },
});
