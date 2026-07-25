import { Trans } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { send } from '@actual-app/core/platform/client/connection';
import { useQuery } from '@tanstack/react-query';

import { Link } from '#components/common/Link';

type PendingAiReviewNoticeProps = {
  isMobile?: boolean;
};

export function PendingAiReviewNotice({
  isMobile = false,
}: PendingAiReviewNoticeProps = {}) {
  const { data: suggestions } = useQuery({
    queryKey: ['ai-suggestions'],
    queryFn: () => send('ai/get-suggestions'),
  });
  const count = suggestions?.length ?? 0;

  if (count === 0) {
    return null;
  }

  return (
    <Link
      variant="button"
      buttonVariant="bare"
      to="/ai-pending-categorizations"
      style={
        isMobile
          ? {
              flexShrink: 0,
              minHeight: 40,
              margin: '8px 10px 0',
              padding: '8px 12px',
              justifyContent: 'center',
              color: theme.warningText,
              backgroundColor: theme.warningBackground,
              border: '1px solid ' + theme.warningBorder,
              borderRadius: 6,
            }
          : {
              color: theme.noticeTextLight,
            }
      }
    >
      <Trans count={count}>{{ count }} AI categorizations pending review</Trans>
    </Link>
  );
}
