import { useEffect, useRef } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import {
  SvgBolt,
  SvgCloud,
  SvgCloudCheck,
  SvgColorPalette,
  SvgHardDrive,
  SvgHome,
  SvgShield,
} from '@actual-app/components/icons/v1';
import { css } from '@emotion/css';
import type { TFunction } from 'i18next';

import { nossoCaderninho } from '#style/nossoCaderninho';

export type OrganizationSectionId =
  | 'house'
  | 'appearance'
  | 'connection'
  | 'assistant'
  | 'data';

type SectionIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type OrganizationSection = {
  id: OrganizationSectionId;
  label: string;
  description: string;
  Icon: SectionIcon;
};

export function getInitialOrganizationSection(
  hash: string,
): OrganizationSectionId | null {
  return hash === '#advanced' ? 'data' : null;
}

export function getOrganizationSections(t: TFunction): OrganizationSection[] {
  return [
    {
      id: 'house',
      label: t('Home and budget'),
      description: t('Planning method and credit cards'),
      Icon: SvgHome,
    },
    {
      id: 'appearance',
      label: t('Appearance and formats'),
      description: t('Theme, language, dates and numbers'),
      Icon: SvgColorPalette,
    },
    {
      id: 'connection',
      label: t('Connection and security'),
      description: t('Access, sync and data protection'),
      Icon: SvgShield,
    },
    {
      id: 'assistant',
      label: t('Assistant'),
      description: t('AI providers, privacy and usage'),
      Icon: SvgBolt,
    },
    {
      id: 'data',
      label: t('Data and maintenance'),
      description: t('Export, backups and advanced tools'),
      Icon: SvgHardDrive,
    },
  ];
}

type OrganizationMapProps = {
  activeSection: OrganizationSectionId | null;
  budgetName: string;
  isSyncConfigured: boolean;
  focusSection?: OrganizationSectionId | null;
  onFocusRestored?: () => void;
  onSelectSection: (section: OrganizationSectionId) => void;
  onSwitchBudget: () => void;
};

export function OrganizationMap({
  activeSection,
  budgetName,
  isSyncConfigured,
  focusSection,
  onFocusRestored,
  onSelectSection,
  onSwitchBudget,
}: OrganizationMapProps) {
  const { t } = useTranslation();
  const sections = getOrganizationSections(t);
  const SyncIcon = isSyncConfigured ? SvgCloudCheck : SvgCloud;
  const mapRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!focusSection) {
      return;
    }

    const chapterButton = mapRef.current?.querySelector<HTMLButtonElement>(
      `[data-organization-section="${focusSection}"]`,
    );
    chapterButton?.focus();
    onFocusRestored?.();
  }, [focusSection, onFocusRestored]);

  return (
    <aside
      ref={mapRef}
      className={mapClass}
      aria-label={t('Organization chapters')}
    >
      <div className={houseContextClass}>
        <span className={contextLabelClass}>
          <Trans>Our home</Trans>
        </span>
        <strong className={budgetNameClass}>{budgetName}</strong>

        <div className={statusListClass}>
          <span className={statusClass}>
            <SvgHardDrive width={15} height={15} aria-hidden />
            <Trans>Available on this device</Trans>
          </span>
          <span className={statusClass}>
            <SyncIcon width={15} height={15} aria-hidden />
            {isSyncConfigured ? (
              <Trans>Sync is configured</Trans>
            ) : (
              <Trans>Local budget</Trans>
            )}
          </span>
        </div>

        <button
          type="button"
          className={switchBudgetClass}
          onClick={onSwitchBudget}
        >
          <Trans>Switch budget</Trans>
        </button>
      </div>

      <nav className={chaptersClass}>
        {sections.map(({ id, label, description, Icon }) => {
          const isActive = activeSection === id;

          return (
            <button
              key={id}
              type="button"
              className={chapterClass}
              data-active={isActive || undefined}
              data-organization-section={id}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelectSection(id)}
            >
              <Icon width={18} height={18} aria-hidden />
              <span className={chapterCopyClass}>
                <strong>{label}</strong>
                <span>{description}</span>
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

const mapClass = css({
  minWidth: 0,
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  scrollbarGutter: 'stable',
  backgroundColor: nossoCaderninho.color.plate,
});

const houseContextClass = css({
  display: 'flex',
  flexDirection: 'column',
  gap: nossoCaderninho.space.sm,
  padding: nossoCaderninho.space.lg,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
});

const contextLabelClass = css({
  color: nossoCaderninho.color.graphiteSubdued,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.3,
});

const budgetNameClass = css({
  minWidth: 0,
  overflow: 'hidden',
  color: nossoCaderninho.color.graphite,
  fontSize: 17,
  fontWeight: 650,
  lineHeight: 1.25,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const statusListClass = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginTop: nossoCaderninho.space.xs,
});

const statusClass = css({
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  color: nossoCaderninho.color.balance,
  fontSize: 12,
  lineHeight: 1.35,
});

const switchBudgetClass = css({
  alignSelf: 'flex-start',
  marginTop: nossoCaderninho.space.sm,
  padding: '7px 10px',
  color: nossoCaderninho.color.partnership,
  backgroundColor: nossoCaderninho.color.partnershipSoft,
  border: 0,
  borderRadius: nossoCaderninho.radius.control,
  font: 'inherit',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  transition: `background-color ${nossoCaderninho.motion.duration} ${nossoCaderninho.motion.easing}`,
  '&:hover': {
    backgroundColor: nossoCaderninho.color.signalSoft,
  },
  '&:focus-visible': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: 2,
  },
});

const chaptersClass = css({
  display: 'flex',
  flexDirection: 'column',
  padding: `${nossoCaderninho.space.sm}px`,
});

const chapterClass = css({
  width: '100%',
  minWidth: 0,
  display: 'grid',
  gridTemplateColumns: '20px minmax(0, 1fr)',
  alignItems: 'start',
  gap: 10,
  padding: '11px 10px',
  color: nossoCaderninho.color.graphiteSubdued,
  backgroundColor: 'transparent',
  border: 0,
  borderRadius: nossoCaderninho.radius.control,
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  '&:hover': {
    color: nossoCaderninho.color.graphite,
    backgroundColor: nossoCaderninho.color.signalSoft,
  },
  '&[data-active]': {
    color: nossoCaderninho.color.partnership,
    backgroundColor: nossoCaderninho.color.partnershipSoft,
  },
  '&:focus-visible': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: -2,
  },
});

const chapterCopyClass = css({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  '& strong': {
    overflow: 'hidden',
    color: 'inherit',
    fontSize: 13,
    fontWeight: 650,
    lineHeight: 1.3,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '& span': {
    overflow: 'hidden',
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 11,
    lineHeight: 1.35,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});
