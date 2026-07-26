import { useEffect, useRef, useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import {
  SvgAdd,
  SvgChatBubbleDots,
  SvgCog,
  SvgCreditCard,
  SvgHome,
  SvgInboxFull,
  SvgPiggyBank,
  SvgReports,
  SvgStoreFront,
  SvgTag,
  SvgTuning,
  SvgWallet,
} from '@actual-app/components/icons/v1';
import { SvgCalendar3 } from '@actual-app/components/icons/v2';
import { css } from '@emotion/css';

import { useIsTestEnv } from '#hooks/useIsTestEnv';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';
import { nossoCaderninho } from '#style/nossoCaderninho';

export const MOBILE_NAV_HEIGHT = 72;

const HOUSE_ROUTES = [
  '/reports',
  '/schedules',
  '/ai-pending-categorizations',
  '/payees',
  '/rules',
  '/bank-sync',
  '/tags',
  '/settings',
];

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

type NavigationItem = {
  name: string;
  path: string;
  Icon: NavIcon;
};

export function MobileNavTabs() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const location = useLocation();
  const houseButtonRef = useRef<HTMLButtonElement>(null);
  const [isHouseOpen, setHouseOpen] = useState(false);
  const syncServerStatus = useSyncServerStatus();
  const isTestEnv = useIsTestEnv();
  const isUsingServer = syncServerStatus !== 'no-server' || isTestEnv;
  const isHouseActive = HOUSE_ROUTES.some(route =>
    location.pathname.startsWith(route),
  );

  useEffect(() => {
    setHouseOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isHouseOpen) {
      return;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setHouseOpen(false);
        houseButtonRef.current?.focus();
      }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isHouseOpen]);

  if (!isNarrowWidth) {
    return null;
  }

  const primaryItems: NavigationItem[] = [
    { name: t('Today'), path: '/', Icon: SvgCalendar3 },
    { name: t('Movements'), path: '/accounts', Icon: SvgPiggyBank },
    { name: t('Plan'), path: '/budget', Icon: SvgWallet },
    { name: t('Assistant'), path: '/advisor', Icon: SvgChatBubbleDots },
  ];
  const houseItems: NavigationItem[] = [
    { name: t('Analyses'), path: '/reports', Icon: SvgReports },
    { name: t('New movement'), path: '/transactions/new', Icon: SvgAdd },
    { name: t('Commitments'), path: '/schedules', Icon: SvgCalendar3 },
    {
      name: t('AI review'),
      path: '/ai-pending-categorizations',
      Icon: SvgInboxFull,
    },
    { name: t('Payees'), path: '/payees', Icon: SvgStoreFront },
    { name: t('Rules'), path: '/rules', Icon: SvgTuning },
    ...(isUsingServer
      ? [
          {
            name: t('Bank sync'),
            path: '/bank-sync',
            Icon: SvgCreditCard,
          },
        ]
      : []),
    { name: t('Tags'), path: '/tags', Icon: SvgTag },
    { name: t('Home settings'), path: '/settings', Icon: SvgCog },
  ];

  return (
    <>
      {isHouseOpen && (
        <>
          <button
            type="button"
            className={backdropClass}
            aria-label={t('Close House menu')}
            onClick={() => setHouseOpen(false)}
          />
          <nav
            id="house-navigation"
            className={houseSheetClass}
            data-testid="house-navigation"
            aria-label={t('House navigation')}
          >
            <div className={sheetHeaderClass}>
              <strong>
                <Trans>House</Trans>
              </strong>
              <span>
                <Trans>Analyses and organization</Trans>
              </span>
            </div>
            <div className={houseGridClass}>
              {houseItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `${houseItemClass} ${isActive ? houseItemActiveClass : ''}`
                  }
                >
                  <item.Icon width={19} height={19} />
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </div>
          </nav>
        </>
      )}

      <nav className={navigationClass} aria-label={t('Main navigation')}>
        {primaryItems.map(item => (
          <PrimaryNavItem
            key={item.path}
            item={item}
            onSelect={() => setHouseOpen(false)}
          />
        ))}
        <button
          ref={houseButtonRef}
          type="button"
          className={`${primaryItemClass} ${
            isHouseActive || isHouseOpen ? primaryItemActiveClass : ''
          }`}
          aria-expanded={isHouseOpen}
          aria-controls="house-navigation"
          onClick={() => setHouseOpen(isOpen => !isOpen)}
        >
          <SvgHome width={21} height={21} />
          <span>
            <Trans>House</Trans>
          </span>
        </button>
      </nav>
    </>
  );
}

function PrimaryNavItem({
  item,
  onSelect,
}: {
  item: NavigationItem;
  onSelect: () => void;
}) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onSelect}
      className={({ isActive }) =>
        `${primaryItemClass} ${isActive ? primaryItemActiveClass : ''}`
      }
    >
      <item.Icon width={21} height={21} />
      <span>{item.name}</span>
    </NavLink>
  );
}

const navigationClass = css({
  position: 'fixed',
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: 101,
  height: MOBILE_NAV_HEIGHT,
  padding:
    '7px max(6px, env(safe-area-inset-right)) max(7px, env(safe-area-inset-bottom)) max(6px, env(safe-area-inset-left))',
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  color: nossoCaderninho.color.navTextSubdued,
  backgroundColor: nossoCaderninho.color.nav,
  borderTop: `1px solid ${nossoCaderninho.color.navHover}`,
});

const primaryItemClass = css({
  minWidth: 0,
  padding: '5px 2px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  color: nossoCaderninho.color.navTextSubdued,
  background: 'transparent',
  border: 0,
  borderRadius: nossoCaderninho.radius.control,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1,
  textAlign: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
  userSelect: 'none',
  '& span': {
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '&:focus-visible': {
    outline: `2px solid ${nossoCaderninho.color.focusOnDark}`,
    outlineOffset: -2,
  },
});

const primaryItemActiveClass = css({
  color: nossoCaderninho.color.navText,
  backgroundColor: nossoCaderninho.color.navHover,
});

const houseSheetClass = css({
  position: 'fixed',
  right: 0,
  bottom: MOBILE_NAV_HEIGHT,
  left: 0,
  zIndex: 100,
  maxHeight: 'min(62vh, 460px)',
  paddingBottom: 'env(safe-area-inset-bottom)',
  color: nossoCaderninho.color.graphite,
  backgroundColor: nossoCaderninho.color.plate,
  borderTop: `1px solid ${nossoCaderninho.color.railSoft}`,
  overflowY: 'auto',
});

const backdropClass = css({
  position: 'fixed',
  inset: `0 0 ${MOBILE_NAV_HEIGHT}px`,
  zIndex: 99,
  padding: 0,
  backgroundColor: 'rgba(16, 41, 47, 0.16)',
  border: 0,
});

const sheetHeaderClass = css({
  minHeight: 62,
  padding: `${nossoCaderninho.space.md}px ${nossoCaderninho.space.lg}px`,
  display: 'grid',
  alignContent: 'center',
  gap: 3,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  fontFamily: nossoCaderninho.font.family,
  '& strong': {
    fontSize: 15,
  },
  '& span': {
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 11,
  },
});

const houseGridClass = css({
  padding: nossoCaderninho.space.sm,
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 4,
});

const houseItemClass = css({
  minHeight: 64,
  minWidth: 0,
  padding: nossoCaderninho.space.sm,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  color: nossoCaderninho.color.graphiteSubdued,
  borderRadius: nossoCaderninho.radius.control,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 11,
  textAlign: 'center',
  textDecoration: 'none',
  '&:hover': {
    backgroundColor: nossoCaderninho.color.signalSoft,
  },
  '&:focus-visible': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: -2,
  },
});

const houseItemActiveClass = css({
  color: nossoCaderninho.color.partnership,
  backgroundColor: nossoCaderninho.color.partnershipSoft,
  fontWeight: 650,
});
