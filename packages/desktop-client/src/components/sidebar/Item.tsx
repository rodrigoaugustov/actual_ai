// @ts-strict-ignore
import React from 'react';
import type {
  ComponentProps,
  ComponentType,
  CSSProperties,
  ReactNode,
  SVGProps,
} from 'react';

import { Block } from '@actual-app/components/block';
import { styles } from '@actual-app/components/styles';
import { View } from '@actual-app/components/view';

import { nossoCaderninho } from '#style/nossoCaderninho';

import { ItemContent } from './ItemContent';

type ItemProps = {
  title: string;
  Icon:
    | ComponentType<SVGProps<SVGElement>>
    | ComponentType<SVGProps<SVGSVGElement>>;
  to?: string;
  children?: ReactNode;
  style?: CSSProperties;
  indent?: number;
  onClick?: ComponentProps<typeof ItemContent>['onClick'];
  forceHover?: boolean;
  forceActive?: boolean;
};

export function Item({
  children,
  Icon,
  title,
  style,
  to,
  onClick,
  indent = 0,
  forceHover = false,
  forceActive = false,
}: ItemProps) {
  const hoverStyle = {
    backgroundColor: nossoCaderninho.color.navHover,
  };

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 20,
        gap: 10,
      }}
    >
      <Icon width={16} height={16} />
      <Block>{title}</Block>
      <View style={{ flex: 1 }} />
    </View>
  );

  return (
    <View style={{ flexShrink: 0, ...style }}>
      <ItemContent
        style={{
          ...styles.mediumText,
          margin: '2px 8px',
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: 12 + indent,
          paddingRight: 12,
          textDecoration: 'none',
          color: nossoCaderninho.color.navTextSubdued,
          borderRadius: nossoCaderninho.radius.control,
          ...(forceHover ? hoverStyle : {}),
          ':hover': hoverStyle,
        }}
        forceActive={forceActive}
        isExactPathMatch={to === '/'}
        activeStyle={{
          color: nossoCaderninho.color.navText,
          backgroundColor: nossoCaderninho.color.partnershipSurface,
          fontWeight: 650,
        }}
        to={to}
        onClick={onClick}
      >
        {content}
      </ItemContent>
      {children ? <View style={{ marginTop: 5 }}>{children}</View> : null}
    </View>
  );
}
