import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button, ButtonWithLoading } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Tooltip } from '@actual-app/components/tooltip';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import type { AiSuggestionForReview } from '@actual-app/core/types/models';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { FinancialText } from '#components/FinancialText';
import { Field, Row, TableHeader } from '#components/table';
import { useCategoriesById } from '#hooks/useCategories';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';

const SUGGESTIONS_QUERY_KEY = ['ai-suggestions'];

export function SuggestionsInbox() {
  const { t } = useTranslation();
  const { data: suggestions = [] } = useQuery({
    queryKey: SUGGESTIONS_QUERY_KEY,
    queryFn: () => send('ai/get-suggestions'),
  });

  if (suggestions.length === 0) {
    return null;
  }

  // Column set/widths mirror the uncategorized register (Account/Payee/
  // Notes/Category are all flex there too) so the two screens read the same;
  // the AI-only columns (Confidence, actions) are the trailing fixed ones.
  return (
    <View style={{ width: '100%' }}>
      <TableHeader
        headers={[
          { name: t('Date'), width: 110 },
          { name: t('Account'), width: 'flex' },
          { name: t('Payee'), width: 'flex' },
          { name: t('Notes'), width: 'flex' },
          { name: t('Suggested category'), width: 'flex' },
          { name: t('Amount'), width: 90, style: { textAlign: 'right' } },
          { name: t('Confidence'), width: 90 },
          { name: '', width: 150 },
        ]}
      />
      {suggestions.map(suggestion => (
        <SuggestionRow key={suggestion.id} suggestion={suggestion} />
      ))}
    </View>
  );
}

function SuggestionRow({ suggestion }: { suggestion: AiSuggestionForReview }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const queryClient = useQueryClient();
  const { data } = useCategoriesById();
  const categoriesById = data?.list;
  const [isLoading, setIsLoading] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: SUGGESTIONS_QUERY_KEY });

  const onResolveFailed = () =>
    dispatch(
      addNotification({
        notification: {
          type: 'error',
          message: t(
            'Could not resolve this suggestion. Check your connection and try again.',
          ),
        },
      }),
    );

  const onAccept = async () => {
    setIsLoading(true);
    try {
      await send('ai/resolve-suggestion', {
        id: suggestion.id,
        action: 'accept',
      });
      await invalidate();
    } catch {
      onResolveFailed();
    } finally {
      setIsLoading(false);
    }
  };

  const onReject = async () => {
    setIsLoading(true);
    try {
      await send('ai/resolve-suggestion', {
        id: suggestion.id,
        action: 'reject',
      });
      await invalidate();
    } catch {
      onResolveFailed();
    } finally {
      setIsLoading(false);
    }
  };

  const categoryName = suggestion.categoryId
    ? (categoriesById?.[suggestion.categoryId]?.name ?? suggestion.categoryId)
    : t('(none)');

  return (
    <Row style={{ borderBottom: '1px solid ' + theme.tableBorder }}>
      <Field width={110}>
        {monthUtils.format(suggestion.date, dateFormat)}
      </Field>
      <Field width="flex">{suggestion.accountName ?? ''}</Field>
      <Field width="flex">{suggestion.payeeName || t('(no payee)')}</Field>
      <Field width="flex">{suggestion.notes ?? ''}</Field>
      <Field width="flex" truncate={false}>
        <Tooltip
          content={
            <Text style={{ maxWidth: 260, padding: 4 }}>
              {suggestion.rationale}
            </Text>
          }
        >
          <Text
            style={{
              cursor: 'default',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {categoryName}
          </Text>
        </Tooltip>
      </Field>
      <Field width={90} truncate={false} style={{ alignItems: 'flex-end' }}>
        <FinancialText>{format(suggestion.amount, 'financial')}</FinancialText>
      </Field>
      <Field width={90}>
        {t('{{confidence}}%', {
          confidence: Math.round(suggestion.confidence * 100),
        })}
      </Field>
      <Field
        width={150}
        truncate={false}
        contentStyle={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}
      >
        <ButtonWithLoading isLoading={isLoading} onPress={onAccept}>
          <Trans>Accept</Trans>
        </ButtonWithLoading>
        <Button onPress={() => void onReject()}>
          <Trans>Reject</Trans>
        </Button>
      </Field>
    </Row>
  );
}
