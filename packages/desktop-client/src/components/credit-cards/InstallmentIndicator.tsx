import { useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';

type InstallmentIndicatorProps = {
  current: number;
  total: number;
};

export function installmentDisplayNotes(
  notes: string | null | undefined,
  current: number | null | undefined,
  total: number | null | undefined,
): string {
  if (!notes || current == null || total == null) {
    return notes ?? '';
  }

  const legacySuffix = `(${current}/${total})`;
  if (notes === legacySuffix) {
    return '';
  }

  const suffixWithSeparator = ` ${legacySuffix}`;
  return notes.endsWith(suffixWithSeparator)
    ? notes.slice(0, -suffixWithSeparator.length)
    : notes;
}

export function InstallmentIndicator({
  current,
  total,
}: InstallmentIndicatorProps) {
  const { t } = useTranslation();
  const label = t('Installment {{current}} of {{total}}', { current, total });

  return (
    <Text
      aria-label={label}
      title={label}
      style={{
        flexShrink: 0,
        padding: '1px 5px',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: theme.tableBorder,
        borderRadius: 8,
        color: theme.pageTextSubdued,
        fontSize: 10,
        lineHeight: '14px',
      }}
    >
      {current}/{total}
    </Text>
  );
}
