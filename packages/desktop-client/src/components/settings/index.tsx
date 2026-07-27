import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { SvgArrowLeft } from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { tokens } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';
import { listen } from '@actual-app/core/platform/client/connection';
import { isElectron } from '@actual-app/core/shared/environment';
import { css } from '@emotion/css';

import { getLatestAppVersion } from '#app/appSlice';
import { closeBudget } from '#budgetfiles/budgetfilesSlice';
import { Checkbox } from '#components/forms';
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { MobilePageHeader, Page } from '#components/Page';
import { useServerVersion } from '#components/ServerContext';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useGlobalPref } from '#hooks/useGlobalPref';
import { useMetadataPref } from '#hooks/useMetadataPref';
import { loadPrefs, saveSyncedPrefs } from '#prefs/prefsSlice';
import { useDispatch, useSelector } from '#redux';
import { nossoCaderninho } from '#style/nossoCaderninho';
import { getClientBuildVersion } from '#util/versions';

import { AiSettings } from './AiSettings';
import { AuthSettings } from './AuthSettings';
import { Backups } from './Backups';
import { BudgetRegimeSettings } from './BudgetRegimeSettings';
import { BudgetTypeSettings } from './BudgetTypeSettings';
import { CurrencySettings } from './Currency';
import { EncryptionSettings } from './Encryption';
import { ExperimentalFeatures } from './Experimental';
import { ExportBudget } from './Export';
import { FormatSettings } from './Format';
import { LanguageSettings } from './LanguageSettings';
import {
  getInitialOrganizationSection,
  getOrganizationSections,
  OrganizationMap,
} from './OrganizationMap';
import type { OrganizationSectionId } from './OrganizationMap';
import { RepairTransactions } from './RepairTransactions';
import { ResetCache, ResetSync } from './Reset';
import { ThemeSettings } from './Themes';
import { AdvancedToggle, Setting } from './UI';

// Impeccable contract · concept seed ba8a5088
// Composition C: a persistent home map beside one focused chapter on desktop;
// on mobile, the map and chapter are separate views with an explicit return.
// Preserve existing capabilities only, keep budget switching secondary, and
// never compress both scales into the same narrow viewport.

function About() {
  const version = useServerVersion();
  const versionInfo = useSelector(state => state.app.versionInfo);
  const [notifyWhenUpdateIsAvailable, setNotifyWhenUpdateIsAvailablePref] =
    useGlobalPref('notifyWhenUpdateIsAvailable', () => {
      void dispatch(getLatestAppVersion());
    });
  const dispatch = useDispatch();

  return (
    <Setting>
      <Text>
        <Trans>
          <strong>Nosso Caderninho</strong> keeps your household finances
          available and under your control.
        </Trans>
      </Text>
      <View
        style={{
          flexDirection: 'column',
          gap: 10,
        }}
        className={css({
          [`@media (min-width: ${tokens.breakpoint_small})`]: {
            display: 'grid',
            gridTemplateRows: '1fr 1fr',
            gridTemplateColumns: '50% 50%',
            columnGap: '2em',
            gridAutoFlow: 'column',
          },
        })}
        data-vrt-mask
      >
        <Text>
          <Trans>
            Client version: {{ version: `v${getClientBuildVersion()}` }}
          </Trans>
        </Text>
        <Text>
          <Trans>Server version: {{ version }}</Trans>
        </Text>

        {notifyWhenUpdateIsAvailable && versionInfo?.isOutdated ? (
          <Text
            style={{
              color: nossoCaderninho.color.commitment,
              fontWeight: 600,
            }}
          >
            <Trans>New version available: {versionInfo.latestVersion}</Trans>
          </Text>
        ) : (
          <Text style={{ color: theme.noticeText, fontWeight: 600 }}>
            {notifyWhenUpdateIsAvailable ? (
              <Trans>You're up to date!</Trans>
            ) : null}
          </Text>
        )}
      </View>
      <View>
        <Text style={{ display: 'flex' }}>
          <Checkbox
            id="settings-notifyWhenUpdateIsAvailable"
            checked={notifyWhenUpdateIsAvailable}
            onChange={e =>
              setNotifyWhenUpdateIsAvailablePref(e.currentTarget.checked)
            }
          />
          <label htmlFor="settings-notifyWhenUpdateIsAvailable">
            <Trans>Display a notification when updates are available</Trans>
          </label>
        </Text>
      </View>
    </Setting>
  );
}

function IDName({ children }: { children: ReactNode }) {
  return <Text style={{ fontWeight: 500 }}>{children}</Text>;
}

function AdvancedAbout() {
  const [budgetId] = useMetadataPref('id');
  const [groupId] = useMetadataPref('groupId');
  const { t } = useTranslation();

  return (
    <Setting>
      <Text>
        <Trans>
          <strong>IDs</strong> are the names Nosso Caderninho uses to identify
          your budget internally. There are several different IDs associated
          with your budget. The Budget ID is used to identify your budget file.
          The Sync ID is used to access the budget on the server.
        </Trans>
      </Text>
      <Text>
        <Trans>
          <IDName>Budget ID:</IDName> {{ budgetId }}
        </Trans>
      </Text>
      <Text style={{ color: theme.pageText }}>
        <Trans>
          <IDName>Sync ID:</IDName> {{ syncId: groupId || t('(none)') }}
        </Trans>
      </Text>
      {/* low priority todo: eliminate some or all of these, or decide when/if to show them */}
      {/* <Text>
        <IDName>Cloud File ID:</IDName> {prefs.cloudFileId || t('(none)')}
      </Text>
      <Text>
        <IDName>User ID:</IDName> {prefs.userId || t('(none)')}
      </Text> */}
    </Setting>
  );
}

export function Settings() {
  const { t } = useTranslation();
  const location = useLocation();
  const [floatingSidebar] = useGlobalPref('floatingSidebar');
  const [budgetName] = useMetadataPref('budgetName');
  const [groupId] = useMetadataPref('groupId');
  const dispatch = useDispatch();
  const isCurrencyExperimentalEnabled = useFeatureFlag('currency');
  const [activeSection, setActiveSection] =
    useState<OrganizationSectionId | null>(() =>
      getInitialOrganizationSection(location.hash),
    );
  const [returnFocusSection, setReturnFocusSection] =
    useState<OrganizationSectionId | null>(null);
  const chapterHeadingRef = useRef<HTMLHeadingElement>(null);

  const onCloseBudget = () => {
    void dispatch(closeBudget());
  };

  useEffect(() => {
    const unlisten = listen('prefs-updated', () => {
      void dispatch(loadPrefs());
    });

    void dispatch(loadPrefs());
    return () => unlisten();
  }, [dispatch]);

  useEffect(() => {
    if (!isCurrencyExperimentalEnabled) {
      void dispatch(saveSyncedPrefs({ prefs: { defaultCurrencyCode: '' } }));
    }
  }, [dispatch, isCurrencyExperimentalEnabled]);

  const { isNarrowWidth } = useResponsive();

  useEffect(() => {
    if (location.hash === '#advanced') {
      setActiveSection('data');
    }
  }, [location.hash]);

  useEffect(() => {
    if (isNarrowWidth && activeSection && location.hash !== '#advanced') {
      chapterHeadingRef.current?.focus();
    }
  }, [activeSection, isNarrowWidth, location.hash]);

  const visibleSection = activeSection ?? (isNarrowWidth ? null : 'house');
  const section = getOrganizationSections(t).find(
    candidate => candidate.id === visibleSection,
  );

  const sectionContent = (() => {
    switch (visibleSection) {
      case 'house':
        return (
          <>
            <BudgetTypeSettings />
            <BudgetRegimeSettings />
          </>
        );
      case 'appearance':
        return (
          <>
            <ThemeSettings />
            <FormatSettings />
            {isCurrencyExperimentalEnabled && <CurrencySettings />}
            <LanguageSettings />
          </>
        );
      case 'connection':
        return (
          <>
            <AuthSettings />
            <EncryptionSettings />
          </>
        );
      case 'assistant':
        return <AiSettings />;
      case 'data':
        return (
          <>
            {isElectron() && <Backups />}
            <ExportBudget />
            <About />
            <AdvancedToggle>
              <AdvancedAbout />
              <ResetCache />
              <ResetSync />
              <RepairTransactions />
              <ExperimentalFeatures />
            </AdvancedToggle>
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <Page
      header={
        isNarrowWidth ? (
          <MobilePageHeader
            title={t('Organization')}
            style={{
              backgroundColor: nossoCaderninho.color.nav,
            }}
          />
        ) : null
      }
      style={{
        marginInline: floatingSidebar && !isNarrowWidth ? 'auto' : 0,
        backgroundColor: nossoCaderninho.color.enamel,
      }}
      contentStyle={{
        minHeight: 0,
        overflowY: isNarrowWidth ? 'auto' : 'hidden',
      }}
    >
      <View
        data-testid="settings"
        className={organizationPageClass}
        data-narrow={isNarrowWidth || undefined}
        style={
          {
            '--organization-bottom-space': isNarrowWidth
              ? `${MOBILE_NAV_HEIGHT + nossoCaderninho.space.lg}px`
              : `${nossoCaderninho.space.xl}px`,
          } as CSSProperties
        }
      >
        {!isNarrowWidth && (
          <header className={organizationHeaderClass}>
            <h1>
              <Trans>Organization</Trans>
            </h1>
            <p>
              <Trans>
                Care for the structure of Nosso Caderninho, one chapter at a
                time.
              </Trans>
            </p>
          </header>
        )}
        {isNarrowWidth && (
          <Text className={organizationIntroClass}>
            <Trans>Settings for the home you manage together.</Trans>
          </Text>
        )}

        <View
          className={organizationWorkspaceClass}
          data-narrow={isNarrowWidth || undefined}
        >
          {(!isNarrowWidth || visibleSection === null) && (
            <OrganizationMap
              activeSection={visibleSection}
              budgetName={budgetName ?? t('Untitled budget')}
              isSyncConfigured={Boolean(groupId)}
              focusSection={returnFocusSection}
              onFocusRestored={() => setReturnFocusSection(null)}
              onSelectSection={setActiveSection}
              onSwitchBudget={onCloseBudget}
            />
          )}

          {visibleSection !== null && section && (
            <section className={chapterStageClass}>
              <header className={chapterHeaderClass}>
                {isNarrowWidth && (
                  <Button
                    variant="bare"
                    onPress={() => {
                      setReturnFocusSection(activeSection);
                      setActiveSection(null);
                    }}
                    className={backButtonClass}
                  >
                    <SvgArrowLeft width={16} height={16} />
                    <Trans>All chapters</Trans>
                  </Button>
                )}
                <View>
                  <h2
                    ref={chapterHeadingRef}
                    tabIndex={-1}
                    className={chapterTitleClass}
                  >
                    {section.label}
                  </h2>
                  <p className={chapterDescriptionClass}>
                    {section.description}
                  </p>
                </View>
                {visibleSection === 'assistant' && (
                  <Text className={onlineNoticeClass}>
                    <Trans>
                      The Assistant needs an internet connection to respond.
                    </Trans>
                  </Text>
                )}
              </header>
              <View className={chapterContentClass}>{sectionContent}</View>
            </section>
          )}
        </View>
      </View>
    </Page>
  );
}

const organizationPageClass = css({
  width: '100%',
  height: '100%',
  maxWidth: 1180,
  minWidth: 0,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  containerType: 'inline-size',
  margin: '0 auto',
  paddingTop: nossoCaderninho.space.sm,
  paddingBottom: 'var(--organization-bottom-space)',
  color: nossoCaderninho.color.graphite,
  fontFamily: nossoCaderninho.font.family,
  '&[data-narrow]': {
    height: 'auto',
    minHeight: '100%',
    overflow: 'visible',
  },
});

const organizationHeaderClass = css({
  marginBottom: nossoCaderninho.space.sm,
  '& h1': {
    margin: 0,
    color: nossoCaderninho.color.graphite,
    fontSize: 20,
    fontWeight: 720,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  '& p': {
    maxWidth: '70ch',
    margin: `${nossoCaderninho.space.xs}px 0 0`,
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 13,
    lineHeight: 1.45,
  },
});

const organizationIntroClass = css({
  maxWidth: '70ch',
  marginBottom: nossoCaderninho.space.lg,
  color: nossoCaderninho.color.graphiteSubdued,
  fontSize: 13,
  lineHeight: 1.45,
});

const organizationWorkspaceClass = css({
  width: '100%',
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  display: 'grid',
  gridTemplateColumns: '280px minmax(0, 1fr)',
  alignItems: 'stretch',
  overflow: 'hidden',
  backgroundColor: nossoCaderninho.color.plate,
  border: `1px solid ${nossoCaderninho.color.railSoft}`,
  borderRadius: nossoCaderninho.radius.panel,
  '& > aside': {
    borderRight: `1px solid ${nossoCaderninho.color.railSoft}`,
  },
  '@container (max-width: 760px)': {
    gridTemplateColumns: 'minmax(0, 1fr)',
    '& > aside': {
      borderRight: 0,
      borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
    },
  },
  '&[data-narrow]': {
    display: 'block',
    flex: 'none',
    borderInline: 0,
    borderRadius: 0,
    '& > aside': {
      borderRight: 0,
    },
  },
});

const chapterStageClass = css({
  minWidth: 0,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  backgroundColor: nossoCaderninho.color.plate,
});

const chapterHeaderClass = css({
  display: 'flex',
  flexDirection: 'column',
  gap: nossoCaderninho.space.md,
  padding: nossoCaderninho.space.lg,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
});

const chapterTitleClass = css({
  margin: 0,
  color: nossoCaderninho.color.graphite,
  fontSize: 17,
  fontWeight: 650,
  lineHeight: 1.25,
});

const chapterDescriptionClass = css({
  margin: `${nossoCaderninho.space.xs}px 0 0`,
  color: nossoCaderninho.color.graphiteSubdued,
  fontSize: 13,
  lineHeight: 1.45,
});

const onlineNoticeClass = css({
  alignSelf: 'flex-start',
  padding: '7px 9px',
  color: nossoCaderninho.color.commitment,
  backgroundColor: nossoCaderninho.color.commitmentSoft,
  borderRadius: nossoCaderninho.radius.control,
  fontSize: 12,
  lineHeight: 1.4,
});

const chapterContentClass = css({
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  width: '100%',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  scrollbarGutter: 'stable',
  '& > :last-child': {
    borderBottom: 0,
  },
  [`.${organizationPageClass}[data-narrow] &`]: {
    overflowY: 'visible',
    scrollbarGutter: 'auto',
  },
});

const backButtonClass = css({
  alignSelf: 'flex-start',
  display: 'inline-flex',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
  color: nossoCaderninho.color.partnership,
  fontSize: 12,
  fontWeight: 600,
  '&:focus-visible': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: 2,
  },
});
