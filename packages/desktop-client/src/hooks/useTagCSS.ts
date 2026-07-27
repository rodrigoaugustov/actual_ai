import { useCallback } from 'react';

import { theme as themeStyle } from '@actual-app/components/theme';
import type { Theme } from '@actual-app/core/types/prefs';
import { css } from '@emotion/css';

import { useTheme } from '#style';

import { getAccessibleTagForeground } from './tagContrast';
import { useTags } from './useTags';

export function useTagCSS(opts?: {
  ellipsis?: boolean;
  touchTarget?: boolean;
}) {
  const { data: tags = [] } = useTags();
  const [theme] = useTheme();

  return useCallback(
    (
      tag: string,
      options: { color?: string | null; compact?: boolean } = {},
    ) => {
      const tagObj = tags.find(t => t.tag === tag);
      const [color, backgroundColor, backgroundColorHovered] = getTagCSSColors(
        theme,
        // fallback strategy: options color > tag color > default color > theme color (undefined)
        options.color ?? tagObj?.color,
      );

      return css({
        ...(opts?.ellipsis
          ? {
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              display: 'inline-block',
              whiteSpace: 'nowrap',
            }
          : { display: 'inline-flex' }),
        opacity: tagObj?.hidden ? 0.5 : undefined,
        padding: options.compact ? '0px 7px' : '3px 7px',
        borderRadius: 16,
        minWidth: opts?.touchTarget ? 44 : undefined,
        minHeight: opts?.touchTarget ? 44 : undefined,
        alignItems: opts?.touchTarget ? 'center' : undefined,
        justifyContent: opts?.touchTarget ? 'center' : undefined,
        userSelect: 'none',
        backgroundColor,
        color,
        cursor: 'pointer',
        '&[data-hovered]': {
          backgroundColor: backgroundColorHovered,
        },
        '&[data-pressed]': {
          backgroundColor: backgroundColorHovered,
        },
      });
    },
    [theme, tags, opts],
  );
}

function getTagCSSColors(theme: Theme, color?: string | null) {
  if (!color) {
    return [
      themeStyle.noteTagText,
      themeStyle.noteTagBackground,
      themeStyle.noteTagBackgroundHover,
    ];
  }

  const foreground = getAccessibleTagForeground(color);

  if (foreground === 'black') {
    // !important is used to override the hover text color in button.tsx used to style the tag button
    return [
      'black !important',
      color,
      `color-mix(in srgb, ${color} 80%, white)`,
    ];
  }

  return ['white !important', color, `color-mix(in srgb, ${color} 80%, black)`];
}
