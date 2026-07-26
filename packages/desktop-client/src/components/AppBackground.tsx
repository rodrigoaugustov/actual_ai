import React from 'react';
import { animated, useTransition } from 'react-spring';

import { Block } from '@actual-app/components/block';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { css } from '@emotion/css';

import { useSelector } from '#redux';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { Background } from './Background';

type AppBackgroundProps = {
  isLoading?: boolean;
  surface?: 'default' | 'manager';
};

export function AppBackground({
  isLoading,
  surface = 'default',
}: AppBackgroundProps) {
  const loadingText = useSelector(state => state.app.loadingText);
  const showLoading = isLoading || loadingText !== null;
  const transitions = useTransition(loadingText, {
    from: { opacity: 0, transform: 'translateY(-100px)' },
    enter: { opacity: 1, transform: 'translateY(0)' },
    leave: { opacity: 0, transform: 'translateY(100px)' },
  });

  return (
    <>
      {surface === 'manager' ? (
        <div
          className={css({
            position: 'absolute',
            inset: 0,
            backgroundColor: nossoCaderninho.color.enamel,
          })}
        />
      ) : (
        <Background />
      )}

      {showLoading &&
        transitions((style, item) => (
          <animated.div key={item} style={style}>
            <View
              className={css({
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: 50,
                paddingTop: 200,
                color:
                  surface === 'manager'
                    ? nossoCaderninho.color.graphite
                    : theme.pageText,
                alignItems: 'center',
                fontFamily:
                  surface === 'manager'
                    ? nossoCaderninho.font.family
                    : undefined,
              })}
            >
              <Block style={{ marginBottom: 20, fontSize: 18 }}>
                {loadingText}
              </Block>
              <AnimatedLoading
                width={25}
                color={
                  surface === 'manager'
                    ? nossoCaderninho.color.partnership
                    : theme.pageText
                }
              />
            </View>
          </animated.div>
        ))}
    </>
  );
}
