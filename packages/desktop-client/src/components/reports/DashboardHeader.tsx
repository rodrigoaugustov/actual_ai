import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgPencil1 } from '@actual-app/components/icons/v2';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { Input } from '@actual-app/components/input';
import { View } from '@actual-app/components/view';
import type { DashboardPageEntity } from '@actual-app/core/types/models';

import { useRenameDashboardPageMutation } from '#reports/mutations';
import { nossoCaderninho } from '#style/nossoCaderninho';

type DashboardHeaderProps = {
  dashboard: DashboardPageEntity;
};

export function DashboardHeader({ dashboard }: DashboardHeaderProps) {
  const { t } = useTranslation();
  const [editingName, setEditingName] = useState(false);

  const renameDashboardPageMutation = useRenameDashboardPageMutation();

  const handleSaveName = async (newName: string) => {
    const trimmedName = newName.trim();
    if (!trimmedName || trimmedName === dashboard.name) {
      setEditingName(false);
      return;
    }

    renameDashboardPageMutation.mutate(
      { id: dashboard.id, name: trimmedName },
      {
        onSuccess: () => {
          setEditingName(false);
        },
      },
    );
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        gap: 6,
        color: nossoCaderninho.color.graphite,
        fontFamily: nossoCaderninho.font.family,
        '& .hover-visible': {
          opacity: 0,
          transition: 'opacity .25s',
        },
        '&:hover .hover-visible': {
          opacity: 1,
        },
        flexGrow: 0,
        flexShrink: 1,
        flexBasis: 'auto',
        minWidth: 0,
        display: 'flex',
        justifyContent: 'flex-start',
      }}
    >
      <View
        style={{
          color: nossoCaderninho.color.graphiteSubdued,
          fontSize: 11,
          fontWeight: 600,
          flexGrow: 0,
          flexShrink: 0,
          flexBasis: 'auto',
        }}
      >
        <Trans>Current view</Trans>:
      </View>
      {editingName ? (
        <InitialFocus>
          <Input
            defaultValue={dashboard.name}
            onEnter={handleSaveName}
            onUpdate={handleSaveName}
            onEscape={() => setEditingName(false)}
            style={{
              minHeight: 36,
              fontSize: 14,
              fontWeight: 600,
            }}
          />
        </InitialFocus>
      ) : (
        <>
          <View
            style={{
              fontSize: 14,
              fontWeight: 650,
              flexGrow: 0,
              flexShrink: 1,
              flexBasis: 'auto',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            {dashboard.name}
          </View>
          <Button
            variant="bare"
            aria-label={t('Rename dashboard')}
            className="hover-visible"
            style={{
              width: 36,
              height: 36,
              color: nossoCaderninho.color.graphiteSubdued,
            }}
            onPress={() => setEditingName(true)}
          >
            <SvgPencil1 style={{ width: 14, height: 14, flexShrink: 0 }} />
          </Button>
        </>
      )}
    </View>
  );
}
