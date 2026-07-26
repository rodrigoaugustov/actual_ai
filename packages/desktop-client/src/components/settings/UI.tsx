import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { Trans } from 'react-i18next';
import { useLocation } from 'react-router';

import type { CSSProperties } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import { css } from '@emotion/css';

import { Link } from '#components/common/Link';
import { nossoCaderninho } from '#style/nossoCaderninho';

type SettingProps = {
  primaryAction?: ReactNode;
  style?: CSSProperties;
  children: ReactNode;
};

export const Setting = ({ primaryAction, style, children }: SettingProps) => {
  return (
    <View className={settingClass} style={style}>
      <View
        style={{
          marginBottom: primaryAction ? nossoCaderninho.space.md : 0,
          lineHeight: 1.5,
          gap: nossoCaderninho.space.sm,
          width: '100%',
        }}
      >
        {children}
      </View>
      {primaryAction || null}
    </View>
  );
};

type AdvancedToggleProps = {
  children: ReactNode;
};

export const AdvancedToggle = ({ children }: AdvancedToggleProps) => {
  const location = useLocation();
  const [expanded, setExpanded] = useState(location.hash === '#advanced');

  return expanded ? (
    <View
      id="advanced"
      style={{
        gap: nossoCaderninho.space.md,
        alignItems: 'flex-start',
        width: '100%',
        padding: nossoCaderninho.space.lg,
        borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
      }}
      innerRef={el => {
        if (el && location.hash === '#advanced') {
          el.scrollIntoView(true);
          el.querySelector<HTMLHeadingElement>('h3')?.focus({
            preventScroll: true,
          });
        }
      }}
    >
      <h3
        tabIndex={-1}
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        <Trans>Advanced Settings</Trans>
      </h3>
      {children}
    </View>
  ) : (
    <Link
      variant="text"
      onClick={() => setExpanded(true)}
      data-testid="advanced-settings"
      style={{
        flexShrink: 0,
        alignSelf: 'flex-start',
        color: nossoCaderninho.color.partnership,
        margin: nossoCaderninho.space.lg,
      }}
    >
      <Trans>Show advanced settings</Trans>
    </Link>
  );
};

export function Column({
  title,
  children,
  style,
}: {
  title: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <View
      style={{
        alignItems: 'flex-start',
        flexGrow: 1,
        gap: '0.5em',
        width: '100%',
        ...style,
      }}
    >
      <Text style={{ fontWeight: 500 }}>{title}</Text>
      <View style={{ alignItems: 'flex-start', gap: '1em', width: '100%' }}>
        {children}
      </View>
    </View>
  );
}

const settingClass = css({
  width: '100%',
  minWidth: 0,
  alignSelf: 'stretch',
  alignItems: 'flex-start',
  padding: nossoCaderninho.space.lg,
  color: nossoCaderninho.color.graphite,
  backgroundColor: nossoCaderninho.color.plate,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  borderRadius: 0,
});
