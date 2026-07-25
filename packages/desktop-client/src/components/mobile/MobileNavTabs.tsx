import React, { useCallback, useState } from 'react';
import type { ComponentProps, ComponentType, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { animated, config, useSpring } from 'react-spring';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import {
  SvgAdd,
  SvgChatBubbleDots,
  SvgCog,
  SvgCreditCard,
  SvgInboxFull,
  SvgPiggyBank,
  SvgReports,
  SvgStoreFront,
  SvgTuning,
  SvgWallet,
} from '@actual-app/components/icons/v1';
import { SvgCalendar3 } from '@actual-app/components/icons/v2';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { useDrag } from '@use-gesture/react';

import { useIsTestEnv } from '#hooks/useIsTestEnv';
import { useScrollListener } from '#hooks/useScrollListener';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';

const COLUMN_COUNT = 3;
const PILL_HEIGHT = 28;
const ROW_HEIGHT = 70;
const OPEN_FULL_Y = 1;

export const MOBILE_NAV_HEIGHT = ROW_HEIGHT + PILL_HEIGHT;

export function MobileNavTabs() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const syncServerStatus = useSyncServerStatus();
  const isTestEnv = useIsTestEnv();
  const isUsingServer = syncServerStatus !== 'no-server' || isTestEnv;
  const [navbarState, setNavbarState] = useState<'default' | 'open' | 'hidden'>(
    'default',
  );

  const navTabStyle = {
    flex: `1 1 ${100 / COLUMN_COUNT}%`,
    height: ROW_HEIGHT,
    padding: 10,
    maxWidth: `${100 / COLUMN_COUNT}%`,
  };

  const secondaryNavTabs = [
    {
      name: t('Budget'),
      path: '/budget',
      style: navTabStyle,
      Icon: SvgWallet,
    },
    {
      name: t('Transaction'),
      path: '/transactions/new',
      style: navTabStyle,
      Icon: SvgAdd,
    },
    {
      name: t('Accounts'),
      path: '/accounts',
      style: navTabStyle,
      Icon: SvgPiggyBank,
    },
    {
      name: t('Reports'),
      path: '/reports',
      style: navTabStyle,
      Icon: SvgReports,
    },
    {
      name: t('Schedules'),
      path: '/schedules',
      style: navTabStyle,
      Icon: SvgCalendar3,
    },
    {
      name: t('Payees'),
      path: '/payees',
      style: navTabStyle,
      Icon: SvgStoreFront,
    },
    {
      name: t('Rules'),
      path: '/rules',
      style: navTabStyle,
      Icon: SvgTuning,
    },
    ...(isUsingServer
      ? [
          {
            name: t('Bank Sync'),
            path: '/bank-sync',
            style: navTabStyle,
            Icon: SvgCreditCard,
          },
        ]
      : []),
  ];
  const primaryNavTabs = [
    {
      name: t('AI operations'),
      path: '/ai-pending-categorizations',
      style: navTabStyle,
      Icon: SvgInboxFull,
    },
    {
      name: t('Financial advisor'),
      path: '/advisor',
      style: navTabStyle,
      Icon: SvgChatBubbleDots,
    },
    {
      name: t('Settings'),
      path: '/settings',
      style: navTabStyle,
      Icon: SvgCog,
    },
  ];
  const bufferTabsCount =
    (COLUMN_COUNT - (secondaryNavTabs.length % COLUMN_COUNT)) % COLUMN_COUNT;
  const rowsCount =
    (secondaryNavTabs.length + bufferTabsCount + primaryNavTabs.length) /
    COLUMN_COUNT;
  const totalHeight = ROW_HEIGHT * rowsCount;
  const openDefaultY = totalHeight - ROW_HEIGHT;
  const hiddenY = totalHeight;

  const [{ y }, api] = useSpring(
    () => ({ from: { y: openDefaultY } }),
    [openDefaultY],
  );

  const openFull = useCallback(
    ({ canceled }: { canceled?: boolean }) => {
      // when cancel is true, it means that the user passed the upwards threshold
      // so we change the spring config to create a nice wobbly effect
      setNavbarState('open');
      void api.start({
        to: { y: OPEN_FULL_Y },
        immediate: isTestEnv,
        config: canceled ? config.wobbly : config.stiff,
      });
    },
    [api, isTestEnv],
  );

  const openDefault = useCallback(
    (velocity = 0) => {
      setNavbarState('default');
      void api.start({
        to: { y: openDefaultY },
        immediate: isTestEnv,
        config: { ...config.stiff, velocity },
      });
    },
    [api, isTestEnv, openDefaultY],
  );

  const hide = useCallback(
    (velocity = 0) => {
      setNavbarState('hidden');
      void api.start({
        to: { y: hiddenY },
        immediate: isTestEnv,
        config: { ...config.stiff, velocity },
      });
    },
    [api, hiddenY, isTestEnv],
  );

  const secondaryTabs = secondaryNavTabs.map(tab => (
    <NavTab key={tab.path} onClick={() => openDefault()} {...tab} />
  ));
  const bufferTabs = Array.from({ length: bufferTabsCount }).map((_, idx) => (
    <div key={idx} style={navTabStyle} />
  ));
  const primaryTabs = primaryNavTabs.map(tab => (
    <NavTab key={tab.path} onClick={() => openDefault()} {...tab} />
  ));

  useScrollListener(
    useCallback(
      ({ isScrolling, hasScrolledToEnd }) => {
        if (isScrolling('down') && !hasScrolledToEnd('up')) {
          hide();
        } else if (isScrolling('up') && !hasScrolledToEnd('down')) {
          openDefault();
        }
      },
      [hide, openDefault],
    ),
  );

  const bind = useDrag(
    ({
      last,
      velocity: [, vy],
      direction: [, dy],
      offset: [, oy],
      cancel,
      canceled,
    }) => {
      // if the user drags up passed a threshold, then we cancel
      // the drag so that the sheet resets to its open position
      if (oy < 0) {
        cancel();
      }

      // when the user releases the sheet, we check whether it passed
      // the threshold for it to close, or if we reset it to its open position
      if (last) {
        if (oy > ROW_HEIGHT * 0.5 || (vy > 0.5 && dy > 0)) {
          openDefault(vy);
        } else {
          openFull({ canceled });
        }
      } else {
        // when the user keeps dragging, we just move the sheet according to
        // the cursor position
        void api.start({ to: { y: oy }, immediate: true });
      }
    },
    {
      from: () => [0, y.get()],
      filterTaps: true,
      bounds: { top: -totalHeight, bottom: totalHeight - ROW_HEIGHT },
      axis: 'y',
      rubberband: true,
    },
  );

  return (
    <animated.div
      role="navigation"
      {...bind()}
      style={{
        y,
        touchAction: 'pan-x',
        backgroundColor: theme.mobileNavBackground,
        borderTop: `1px solid ${theme.menuBorder}`,
        ...styles.shadow,
        height: totalHeight + PILL_HEIGHT,
        width: '100%',
        position: 'fixed',
        zIndex: 100,
        bottom: 0,
        ...(!isNarrowWidth && { display: 'none' }),
      }}
      data-navbar-state={navbarState}
    >
      <View>
        <button
          type="button"
          aria-label={
            navbarState === 'open'
              ? t('Collapse navigation menu')
              : t('Expand navigation menu')
          }
          onClick={() => {
            if (navbarState === 'open') {
              openDefault();
            } else {
              openFull({});
            }
          }}
          style={{
            appearance: 'none',
            backgroundColor: 'transparent',
            border: 0,
            width: '100%',
            height: PILL_HEIGHT,
            padding: 0,
            alignSelf: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              display: 'block',
              width: 30,
              height: 4,
              borderRadius: 10,
              backgroundColor: theme.pillBorder,
            }}
          />
        </button>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            height: totalHeight,
            width: '100%',
          }}
        >
          {[secondaryTabs, bufferTabs, primaryTabs]}
        </View>
      </View>
    </animated.div>
  );
}

type NavTabIconProps = {
  width: number;
  height: number;
  style?: CSSProperties;
};

type NavTabProps = {
  name: string;
  path: string;
  Icon: ComponentType<NavTabIconProps>;
  style?: CSSProperties;
  onClick: ComponentProps<typeof NavLink>['onClick'];
};

function NavTab({ Icon: TabIcon, name, path, style, onClick }: NavTabProps) {
  return (
    <NavLink
      to={path}
      style={({ isActive }) => ({
        ...styles.noTapHighlight,
        alignItems: 'center',
        color: isActive ? theme.mobileNavItemSelected : theme.mobileNavItem,
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        textAlign: 'center',
        textWrap: 'balance',
        userSelect: 'none',
        ...style,
      })}
      onClick={onClick}
    >
      <TabIcon width={22} height={22} style={{ minHeight: '22px' }} />
      {name}
    </NavLink>
  );
}
