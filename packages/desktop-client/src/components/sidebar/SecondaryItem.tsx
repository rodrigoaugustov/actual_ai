// @ts-strict-ignore
import React from 'react';
import type {
  ComponentProps,
  ComponentType,
  CSSProperties,
  SVGProps,
} from 'react';

import { Block } from '@actual-app/components/block';
import { View } from '@actual-app/components/view';

import { nossoCaderninho } from '#style/nossoCaderninho';

import { ItemContent } from './ItemContent';

const fontWeight = 600;

type SecondaryItemProps = {
  title: string;
  to?: string;
  Icon?:
    | ComponentType<SVGProps<SVGElement>>
    | ComponentType<SVGProps<SVGSVGElement>>;
  style?: CSSProperties;
  onClick?: ComponentProps<typeof ItemContent>['onClick'];
  bold?: boolean;
  indent?: number;
};

export function SecondaryItem({
  Icon,
  title,
  style,
  to,
  onClick,
  bold,
  indent = 0,
}: SecondaryItemProps) {
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 16,
      }}
    >
      {Icon && <Icon width={12} height={12} />}
      <Block style={{ marginLeft: Icon ? 8 : 0, color: 'inherit' }}>
        {title}
      </Block>
    </View>
  );

  return (
    <View style={{ flexShrink: 0, ...style }}>
      <ItemContent
        style={{
          minHeight: 34,
          margin: '1px 8px',
          padding: `8px 12px 8px ${28 + indent}px`,
          color: nossoCaderninho.color.navTextSubdued,
          fontSize: 12,
          fontWeight: bold ? fontWeight : null,
          borderRadius: nossoCaderninho.radius.control,
          ':hover': {
            color: nossoCaderninho.color.navText,
            backgroundColor: nossoCaderninho.color.navHover,
          },
        }}
        to={to}
        onClick={onClick}
        activeStyle={{
          color: nossoCaderninho.color.navText,
          backgroundColor: nossoCaderninho.color.navHover,
          fontWeight: 650,
        }}
      >
        {content}
      </ItemContent>
    </View>
  );
}
