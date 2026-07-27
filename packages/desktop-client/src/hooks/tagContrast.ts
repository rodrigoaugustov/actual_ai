type RGB = {
  red: number;
  green: number;
  blue: number;
};

function parseHexColor(color: string): RGB | null {
  const normalized = color.replace(/^#/, '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map(channel => channel + channel)
          .join('')
      : normalized;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    return null;
  }

  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function getRelativeLuminance({ red, green, blue }: RGB) {
  const channels = [red, green, blue].map(channel => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function getAccessibleTagForeground(color: string) {
  const rgb = parseHexColor(color);

  if (!rgb) {
    return 'black' as const;
  }

  const luminance = getRelativeLuminance(rgb);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);

  return contrastWithBlack >= contrastWithWhite
    ? ('black' as const)
    : ('white' as const);
}
