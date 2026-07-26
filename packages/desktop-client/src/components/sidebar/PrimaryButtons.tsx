import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

import {
  SvgChatBubbleDots,
  SvgCheveronDown,
  SvgCheveronRight,
  SvgCog,
  SvgCreditCard,
  SvgInboxFull,
  SvgPiggyBank,
  SvgReports,
  SvgStoreFront,
  SvgTag,
  SvgTuning,
  SvgWallet,
} from '@actual-app/components/icons/v1';
import { SvgCalendar3 } from '@actual-app/components/icons/v2';
import { View } from '@actual-app/components/view';

import { useIsTestEnv } from '#hooks/useIsTestEnv';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';

import { Item } from './Item';
import { SecondaryItem } from './SecondaryItem';

const ORGANIZATION_ROUTES = [
  '/schedules',
  '/ai-pending-categorizations',
  '/ai-usage',
  '/payees',
  '/rules',
  '/bank-sync',
  '/tags',
  '/settings',
];

export function PrimaryButtons() {
  const { t } = useTranslation();
  const location = useLocation();
  const isOrganizationActive = ORGANIZATION_ROUTES.some(route =>
    location.pathname.startsWith(route),
  );
  const [isOrganizationOpen, setOrganizationOpen] =
    useState(isOrganizationActive);
  const syncServerStatus = useSyncServerStatus();
  const isTestEnv = useIsTestEnv();
  const isUsingServer = syncServerStatus !== 'no-server' || isTestEnv;

  useEffect(() => {
    if (isOrganizationActive) {
      setOrganizationOpen(true);
    }
  }, [isOrganizationActive]);

  return (
    <View style={{ flexShrink: 0 }}>
      <Item title={t('Today')} Icon={SvgCalendar3} to="/" />
      <Item title={t('Movements')} Icon={SvgPiggyBank} to="/accounts" />
      <Item title={t('Planning')} Icon={SvgWallet} to="/budget" />
      <Item title={t('Assistant')} Icon={SvgChatBubbleDots} to="/advisor" />
      <Item title={t('Analyses')} Icon={SvgReports} to="/reports" />

      <Item
        title={t('Organization')}
        Icon={isOrganizationOpen ? SvgCheveronDown : SvgCheveronRight}
        onClick={() => setOrganizationOpen(isOpen => !isOpen)}
        style={{ marginTop: 10 }}
        forceActive={!isOrganizationOpen && isOrganizationActive}
      />
      {isOrganizationOpen && (
        <View style={{ marginBottom: 8 }}>
          <SecondaryItem
            title={t('Commitments')}
            Icon={SvgCalendar3}
            to="/schedules"
          />
          <SecondaryItem
            title={t('AI review')}
            Icon={SvgInboxFull}
            to="/ai-pending-categorizations"
          />
          <SecondaryItem
            title={t('Payees')}
            Icon={SvgStoreFront}
            to="/payees"
          />
          <SecondaryItem title={t('Rules')} Icon={SvgTuning} to="/rules" />
          {isUsingServer && (
            <SecondaryItem
              title={t('Bank sync')}
              Icon={SvgCreditCard}
              to="/bank-sync"
            />
          )}
          <SecondaryItem title={t('Tags')} Icon={SvgTag} to="/tags" />
          <SecondaryItem title={t('Settings')} Icon={SvgCog} to="/settings" />
        </View>
      )}
    </View>
  );
}
