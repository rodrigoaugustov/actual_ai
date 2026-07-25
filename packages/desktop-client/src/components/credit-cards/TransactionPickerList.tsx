import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { useQuery } from '@tanstack/react-query';

import { Search } from '#components/common/Search';
import { FinancialText } from '#components/FinancialText';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { transactionsSearch } from '#queries';
import { aqlQuery } from '#queries/aqlQuery';

type CandidateTransaction = {
  id: string;
  date: string;
  amount: number;
  notes: string | null;
  payeeName: string | null;
  accountName: string | null;
};

const MAX_RESULTS = 30;

type TransactionPickerListProps = {
  /** Only show transactions on this account */
  accountId?: string;
  /** Exclude transactions on this account */
  excludeAccountId?: string;
  onSelect: (transactionId: string) => void;
};

export function TransactionPickerList({
  accountId,
  excludeAccountId,
  onSelect,
}: TransactionPickerListProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const [search, setSearch] = useState('');

  const {
    data: transactions = [],
    isError,
    isLoading,
  } = useQuery({
    queryKey: ['transaction-picker', accountId, excludeAccountId, search],
    queryFn: async () => {
      let query = q('transactions')
        .filter({
          transfer_id: null,
          ...(accountId ? { account: accountId } : {}),
          ...(excludeAccountId ? { account: { $ne: excludeAccountId } } : {}),
        })
        .options({ splits: 'none' });

      if (search.trim()) {
        query = transactionsSearch(query, search.trim(), dateFormat);
      }

      const { data } = await aqlQuery(
        query
          .select([
            'id',
            'date',
            'amount',
            'notes',
            { payeeName: 'payee.name' },
            { accountName: 'account.name' },
          ])
          .orderBy({ date: 'desc' })
          .limit(MAX_RESULTS),
      );
      return data as CandidateTransaction[];
    },
  });

  return (
    <View style={{ gap: 6 }}>
      <Search
        value={search}
        onChange={setSearch}
        placeholder={t('Search by payee, date, or amount…')}
        isInModal
        width="100%"
      />
      <View
        style={{
          maxHeight: 220,
          overflowY: 'auto',
          border: '1px solid ' + theme.tableBorder,
          borderRadius: 4,
        }}
      >
        {isLoading ? (
          <View style={{ alignItems: 'center', padding: 10 }}>
            <AnimatedLoading width={20} color={theme.pageTextSubdued} />
          </View>
        ) : isError ? (
          <Text
            style={{
              padding: 10,
              color: theme.errorText,
              fontSize: '0.9em',
            }}
          >
            <Trans>Could not load transactions.</Trans>
          </Text>
        ) : transactions.length === 0 ? (
          <Text
            style={{
              padding: 10,
              color: theme.pageTextSubdued,
              fontSize: '0.9em',
            }}
          >
            <Trans>No matching transactions</Trans>
          </Text>
        ) : null}
        {!isLoading &&
          !isError &&
          transactions.map(trans => {
            // Open-banking imports often leave the payee unresolved; the
            // raw description in notes is what actually identifies the
            // transaction in that case, so prefer it as the primary line
            const primary = trans.payeeName || trans.notes || t('(no payee)');
            const secondaryParts = [
              monthUtils.format(trans.date, dateFormat),
              !accountId && trans.accountName ? trans.accountName : null,
              trans.payeeName && trans.notes ? trans.notes : null,
            ].filter(Boolean);

            return (
              <Button
                key={trans.id}
                variant="bare"
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  borderBottom: '1px solid ' + theme.tableBorder,
                  flexShrink: 0,
                  minHeight: 40,
                }}
                onPress={() => onSelect(trans.id)}
              >
                <View style={{ flex: 1, minWidth: 0, flexShrink: 1 }}>
                  <Text
                    style={{
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={primary}
                  >
                    {primary}
                  </Text>
                  <Text
                    style={{
                      color: theme.pageTextSubdued,
                      fontSize: '0.85em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={secondaryParts.join(' · ')}
                  >
                    {secondaryParts.join(' · ')}
                  </Text>
                </View>
                <FinancialText style={{ fontWeight: 600, flexShrink: 0 }}>
                  {format(trans.amount, 'financial')}
                </FinancialText>
              </Button>
            );
          })}
      </View>
    </View>
  );
}
