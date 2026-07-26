import { useState } from 'react';
import type { CSSProperties } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Trans } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { SvgHome } from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import * as Platform from '@actual-app/core/shared/platform';
import { css } from '@emotion/css';
import { Resizable } from 're-resizable';

import { FeatureErrorFallback } from '#components/FeatureErrorFallback';
import { useGlobalPref } from '#hooks/useGlobalPref';
import { useLocalPref } from '#hooks/useLocalPref';
import { useResizeObserver } from '#hooks/useResizeObserver';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { BudgetName } from './BudgetName';
import { PrimaryButtons } from './PrimaryButtons';
import { useSidebar } from './SidebarProvider';
import { ToggleButton } from './ToggleButton';

const DEFAULT_SIDEBAR_WIDTH = 252;
const MIN_SIDEBAR_WIDTH = 220;

export function Sidebar() {
  const hasWindowButtons = !Platform.isBrowser && Platform.OS === 'mac';
  const sidebar = useSidebar();
  const { width } = useResponsive();
  const [isFloating = false, setFloatingSidebarPref] =
    useGlobalPref('floatingSidebar');
  const [sidebarWidthLocalPref, setSidebarWidthLocalPref] =
    useLocalPref('sidebarWidth');
  const maximumSidebarWidth = width / 3;
  const [sidebarWidth, setSidebarWidth] = useState(
    Math.min(
      maximumSidebarWidth,
      Math.max(
        MIN_SIDEBAR_WIDTH,
        sidebarWidthLocalPref || DEFAULT_SIDEBAR_WIDTH,
      ),
    ),
  );
  const containerRef = useResizeObserver<HTMLDivElement>(rect => {
    setSidebarWidth(rect.width);
  });

  return (
    <ErrorBoundary FallbackComponent={FeatureErrorFallback}>
      <Resizable
        defaultSize={{ width: sidebarWidth, height: '100%' }}
        onResizeStop={() => setSidebarWidthLocalPref(sidebarWidth)}
        maxWidth={maximumSidebarWidth}
        minWidth={MIN_SIDEBAR_WIDTH}
        enable={{
          top: false,
          right: true,
          bottom: false,
          left: false,
          topRight: false,
          bottomRight: false,
          bottomLeft: false,
          topLeft: false,
        }}
      >
        <View
          innerRef={containerRef}
          className={sidebarClass}
          style={
            {
              '--floating-opacity': isFloating ? 1 : 0,
              '--floating-width':
                hasWindowButtons || isFloating ? undefined : 0,
            } as CSSProperties
          }
        >
          <div className={brandClass}>
            <span className={brandMarkClass} aria-hidden>
              <SvgHome width={17} height={17} />
            </span>
            <span>
              <Text className={brandNameClass}>
                <Trans>Nosso Caderninho</Trans>
              </Text>
              <Text className={brandTaglineClass}>
                <Trans>The home decides together</Trans>
              </Text>
            </span>
          </div>

          <View className={navigationClass}>
            <PrimaryButtons />
          </View>

          <BudgetName>
            {!sidebar.alwaysFloats && (
              <ToggleButton
                isFloating={isFloating}
                onFloat={() => setFloatingSidebarPref(!isFloating)}
              />
            )}
          </BudgetName>
        </View>
      </Resizable>
    </ErrorBoundary>
  );
}

const sidebarClass = css({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  color: nossoCaderninho.color.navText,
  backgroundColor: nossoCaderninho.color.nav,
  borderRight: `1px solid ${nossoCaderninho.color.navHover}`,
  overflow: 'hidden',
  '& .float': {
    opacity: 'var(--floating-opacity)',
    transition: `opacity ${nossoCaderninho.motion.duration} ${nossoCaderninho.motion.easing}`,
    width: 'var(--floating-width)',
  },
  '&:hover .float': {
    opacity: 1,
    width: 'auto',
  },
  '@media (prefers-reduced-motion: reduce)': {
    '& .float': {
      transition: 'none',
    },
  },
});

const brandClass = css({
  minHeight: 104,
  padding: '44px 18px 18px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  borderBottom: `1px solid ${nossoCaderninho.color.navHover}`,
  userSelect: 'none',
});

const brandMarkClass = css({
  width: 32,
  height: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: nossoCaderninho.color.nav,
  backgroundColor: nossoCaderninho.color.navText,
  borderRadius: nossoCaderninho.radius.control,
});

const brandNameClass = css({
  display: 'block',
  color: nossoCaderninho.color.navText,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 14,
  fontWeight: 720,
  lineHeight: 1.1,
});

const brandTaglineClass = css({
  display: 'block',
  marginTop: 4,
  color: nossoCaderninho.color.navTextSubdued,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 10,
  lineHeight: 1.1,
});

const navigationClass = css({
  flex: 1,
  minHeight: 0,
  padding: '12px 0',
  overflowY: 'auto',
  scrollbarColor: `${nossoCaderninho.color.navTextSubdued} transparent`,
});
