import { useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Tooltip } from '@actual-app/components/tooltip';
import type { AiSuggestionIndexEntry } from '@actual-app/core/types/models';

type AiOriginBadgeProps = {
  status: Exclude<AiSuggestionIndexEntry['status'], 'rejected'>;
};

export function AiOriginBadge({ status }: AiOriginBadgeProps) {
  const { t } = useTranslation();

  const { label, description, colors } =
    status === 'auto_applied'
      ? {
          label: t('AI auto-applied'),
          description: t(
            'The AI selected and applied this category automatically.',
          ),
          colors: {
            color: theme.noticeText,
            backgroundColor: theme.noticeBackground,
          },
        }
      : status === 'accepted'
        ? {
            label: t('AI suggestion approved'),
            description: t(
              'You approved the category originally suggested by the AI.',
            ),
            colors: {
              color: theme.pillText,
              backgroundColor: theme.pillBackground,
            },
          }
        : {
            label: t('AI suggestion pending'),
            description: t(
              'The AI suggested a category and is waiting for your review.',
            ),
            colors: {
              color: theme.warningText,
              backgroundColor: theme.warningBackground,
            },
          };

  return (
    <Tooltip
      content={<Text style={{ maxWidth: 260, padding: 4 }}>{description}</Text>}
    >
      <Text
        aria-label={description}
        style={{
          ...colors,
          borderRadius: 4,
          padding: '1px 5px',
          fontSize: 10,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {label}
      </Text>
    </Tooltip>
  );
}
