import { css } from '@emotion/css';

import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { nossoCaderninho } from '#style/nossoCaderninho';

export const reportsSurfaceClass = css`
  --color-pageBackground: ${nossoCaderninho.color.enamel};
  --color-pageText: ${nossoCaderninho.color.graphite};
  --color-pageTextLight: ${nossoCaderninho.color.graphiteSubdued};
  --color-pageTextSubdued: ${nossoCaderninho.color.graphiteSubdued};
  --color-pageTextDark: ${nossoCaderninho.color.graphite};
  --color-pageTextPositive: ${nossoCaderninho.color.balance};
  --color-pageTextLink: ${nossoCaderninho.color.partnership};
  --color-numberPositive: ${nossoCaderninho.color.balance};
  --color-numberNegative: ${nossoCaderninho.color.commitment};
  --color-numberNeutral: ${nossoCaderninho.color.graphiteSubdued};
  --color-cardBackground: ${nossoCaderninho.color.plate};
  --color-cardBorder: ${nossoCaderninho.color.rail};
  --color-cardShadow: transparent;
  --color-tableBackground: ${nossoCaderninho.color.plate};
  --color-tableRowBackgroundAlternate: ${nossoCaderninho.color.plate};
  --color-tableRowBackgroundHover: ${nossoCaderninho.color.signalSoft};
  --color-tableRowBackgroundHighlight: ${nossoCaderninho.color.partnershipSoft};
  --color-tableRowBackgroundHighlightText: ${nossoCaderninho.color.graphite};
  --color-tableRowHeaderBackground: ${nossoCaderninho.color.signalSoft};
  --color-tableRowHeaderText: ${nossoCaderninho.color.graphiteSubdued};
  --color-tableHeaderBackground: ${nossoCaderninho.color.signalSoft};
  --color-tableHeaderText: ${nossoCaderninho.color.graphiteSubdued};
  --color-tableText: ${nossoCaderninho.color.graphite};
  --color-tableTextLight: ${nossoCaderninho.color.graphiteSubdued};
  --color-tableTextSubdued: ${nossoCaderninho.color.graphiteSubdued};
  --color-tableBorder: ${nossoCaderninho.color.railSoft};
  --color-tableBorderSeparator: ${nossoCaderninho.color.rail};
  --color-menuBackground: ${nossoCaderninho.color.plate};
  --color-menuItemBackground: ${nossoCaderninho.color.plate};
  --color-menuItemBackgroundHover: ${nossoCaderninho.color.signalSoft};
  --color-menuItemText: ${nossoCaderninho.color.graphite};
  --color-menuItemTextHover: ${nossoCaderninho.color.graphite};
  --color-menuItemTextSelected: ${nossoCaderninho.color.partnership};
  --color-menuBorder: ${nossoCaderninho.color.rail};
  --color-buttonPrimaryText: ${nossoCaderninho.color.navText};
  --color-buttonPrimaryTextHover: ${nossoCaderninho.color.navText};
  --color-buttonPrimaryBackground: ${nossoCaderninho.color.partnership};
  --color-buttonPrimaryBackgroundHover: ${nossoCaderninho.color.navHover};
  --color-buttonPrimaryBorder: ${nossoCaderninho.color.partnership};
  --color-buttonBareText: ${nossoCaderninho.color.partnership};
  --color-buttonBareTextHover: ${nossoCaderninho.color.partnership};
  --color-buttonBareBackground: transparent;
  --color-buttonBareBackgroundHover: ${nossoCaderninho.color.partnershipSoft};
  --color-buttonBareBackgroundActive: ${nossoCaderninho.color.partnershipSoft};
  --color-buttonNormalText: ${nossoCaderninho.color.graphite};
  --color-buttonNormalTextHover: ${nossoCaderninho.color.graphite};
  --color-buttonNormalBackground: ${nossoCaderninho.color.plate};
  --color-buttonNormalBackgroundHover: ${nossoCaderninho.color.signalSoft};
  --color-buttonNormalBorder: ${nossoCaderninho.color.rail};
  --color-formInputBackground: ${nossoCaderninho.color.plate};
  --color-formInputBackgroundSelected: ${nossoCaderninho.color.plate};
  --color-formInputBorder: ${nossoCaderninho.color.rail};
  --color-formInputBorderSelected: ${nossoCaderninho.color.partnership};
  --color-formInputText: ${nossoCaderninho.color.graphite};
  --color-formInputTextSelected: ${nossoCaderninho.color.graphite};
  --color-formInputTextPlaceholder: ${nossoCaderninho.color.graphiteSubdued};
  --color-formInputTextPlaceholderSelected: ${nossoCaderninho.color
    .graphiteSubdued};
  --color-formInputShadowSelected: ${nossoCaderninho.color.focusOnLight};
  --color-pillBackground: ${nossoCaderninho.color.signalSoft};
  --color-pillBackgroundLight: ${nossoCaderninho.color.signalSoft};
  --color-pillText: ${nossoCaderninho.color.graphiteSubdued};
  --color-pillTextHighlighted: ${nossoCaderninho.color.graphite};
  --color-pillBorder: ${nossoCaderninho.color.railSoft};
  --color-pillBorderDark: ${nossoCaderninho.color.rail};
  --color-pillBackgroundSelected: ${nossoCaderninho.color.partnershipSoft};
  --color-pillTextSelected: ${nossoCaderninho.color.partnership};
  --color-pillBorderSelected: ${nossoCaderninho.color.partnership};
  --color-reportsRed: ${nossoCaderninho.color.limit};
  --color-reportsBlue: ${nossoCaderninho.color.partnership};
  --color-reportsGreen: ${nossoCaderninho.color.balance};
  --color-reportsGray: ${nossoCaderninho.color.rail};
  --color-reportsLabel: ${nossoCaderninho.color.graphiteSubdued};
  --color-reportsInnerLabel: ${nossoCaderninho.color.graphite};
  --color-reportsChartFill: ${nossoCaderninho.color.partnership};
  --color-reportsNumberPositive: ${nossoCaderninho.color.balance};
  --color-reportsNumberNegative: ${nossoCaderninho.color.commitment};
  --color-reportsNumberNeutral: ${nossoCaderninho.color.graphiteSubdued};
  --color-noticeText: ${nossoCaderninho.color.balance};
  --color-warningText: ${nossoCaderninho.color.commitment};
  --color-errorText: ${nossoCaderninho.color.limit};
  --color-tooltipText: ${nossoCaderninho.color.navText};
  --color-tooltipBackground: ${nossoCaderninho.color.nav};
  --color-tooltipBorder: ${nossoCaderninho.color.navHover};
  --color-mobilePageBackground: ${nossoCaderninho.color.enamel};
  --color-mobileHeaderBackground: ${nossoCaderninho.color.nav};
  --color-mobileHeaderText: ${nossoCaderninho.color.navText};
  --color-mobileHeaderTextSubdued: ${nossoCaderninho.color.navTextSubdued};
  --color-mobileHeaderTextHover: ${nossoCaderninho.color.navHover};

  min-width: 0;
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  overflow: hidden;
  color: ${nossoCaderninho.color.graphite};
  background: ${nossoCaderninho.color.enamel};
  font-family: ${nossoCaderninho.font.family};
  box-sizing: border-box;

  & * {
    box-sizing: border-box;
  }
`;

export const reportsDesktopHeaderClass = css({
  minWidth: 0,
  minHeight: 72,
  padding: `0 ${nossoCaderninho.space.xl}px`,
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: nossoCaderninho.space.lg,
  backgroundColor: nossoCaderninho.color.plate,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
});

export const reportsMenuClass = css`
  --color-menuBackground: ${nossoCaderninho.color.plate};
  --color-menuItemBackground: ${nossoCaderninho.color.plate};
  --color-menuItemBackgroundHover: ${nossoCaderninho.color.signalSoft};
  --color-menuItemText: ${nossoCaderninho.color.graphite};
  --color-menuItemTextHover: ${nossoCaderninho.color.graphite};
  --color-menuItemTextSelected: ${nossoCaderninho.color.partnership};
  --color-menuItemTextHeader: ${nossoCaderninho.color.graphiteSubdued};
  --color-menuBorder: ${nossoCaderninho.color.railSoft};
  --color-menuKeybindingText: ${nossoCaderninho.color.graphiteSubdued};
  --color-buttonBareText: ${nossoCaderninho.color.graphite};
  --color-buttonBareTextHover: ${nossoCaderninho.color.graphite};
  --color-buttonBareBackground: transparent;
  --color-buttonBareBackgroundHover: ${nossoCaderninho.color.signalSoft};

  min-width: 220px;
  color: ${nossoCaderninho.color.graphite};
  background: ${nossoCaderninho.color.plate};
  border: 1px solid ${nossoCaderninho.color.railSoft};
  font-family: ${nossoCaderninho.font.family};
`;

export const reportsHeaderIdentityClass = css({
  minWidth: 0,
  '& h1': {
    margin: 0,
    color: nossoCaderninho.color.graphite,
    fontSize: 20,
    fontWeight: 720,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  '& p': {
    margin: '4px 0 0',
    overflow: 'hidden',
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 12,
    lineHeight: 1.3,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

export const reportsHeaderActionsClass = css({
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
  '& > button': {
    minHeight: 40,
    borderRadius: nossoCaderninho.radius.control,
  },
  '&[data-mobile="true"]': {
    display: 'grid',
    gridTemplateColumns: '1fr',
    '& > button': {
      width: '100%',
      justifyContent: 'center',
    },
  },
});

export const reportsWorkbenchClass = css({
  minWidth: 0,
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: '176px minmax(0, 1fr)',
  overflow: 'hidden',
  '&[data-library-hidden="true"]': {
    gridTemplateColumns: 'minmax(0, 1fr)',
  },
  '@media (max-width: 729px)': {
    gridTemplateColumns: 'minmax(0, 1fr)',
  },
});

export const reportsNavigatorClass = css({
  minWidth: 0,
  minHeight: 0,
  padding: `${nossoCaderninho.space.md}px 0`,
  overflowY: 'auto',
  backgroundColor: nossoCaderninho.color.signalSoft,
  borderRight: `1px solid ${nossoCaderninho.color.railSoft}`,
  '& h2': {
    margin: `0 ${nossoCaderninho.space.lg}px ${nossoCaderninho.space.sm}px`,
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.3,
  },
});

export const reportsNavigatorItemClass = css({
  width: '100%',
  minHeight: 44,
  padding: `0 ${nossoCaderninho.space.lg}px`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: nossoCaderninho.space.sm,
  color: nossoCaderninho.color.graphite,
  borderRadius: 0,
  fontSize: 12,
  fontWeight: 500,
  textAlign: 'left',
  '&[data-current="true"]': {
    color: nossoCaderninho.color.partnership,
    backgroundColor: nossoCaderninho.color.partnershipSoft,
    fontWeight: 650,
  },
  '&[data-hovered]': {
    backgroundColor: nossoCaderninho.color.partnershipSoft,
  },
  '&[data-focus-visible]': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: -2,
  },
  '& span:last-child': {
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 14,
  },
});

export const reportsStageClass = css({
  minWidth: 0,
  minHeight: 0,
  padding: nossoCaderninho.space.lg,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  backgroundColor: nossoCaderninho.color.enamel,
  '@media (max-width: 729px)': {
    padding: `${nossoCaderninho.space.md}px ${nossoCaderninho.space.sm}px`,
    paddingBottom: MOBILE_NAV_HEIGHT + nossoCaderninho.space.lg,
  },
});

export const reportsStageHeadingClass = css({
  width: 'min(1480px, 100%)',
  minHeight: 54,
  margin: '0 auto',
  padding: `0 ${nossoCaderninho.space.sm}px ${nossoCaderninho.space.md}px`,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: nossoCaderninho.space.md,
  '& h2': {
    margin: 0,
    overflow: 'hidden',
    color: nossoCaderninho.color.graphite,
    fontSize: 17,
    fontWeight: 650,
    lineHeight: 1.25,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '& p': {
    margin: '3px 0 0',
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 11,
    lineHeight: 1.3,
  },
  '@media (max-width: 729px)': {
    minHeight: 48,
    padding: `0 ${nossoCaderninho.space.sm}px ${nossoCaderninho.space.sm}px`,
  },
});

export const reportsGridClass = css({
  width: 'min(1480px, 100%)',
  minWidth: 0,
  margin: '0 auto',
  padding: nossoCaderninho.space.sm,
  backgroundColor: nossoCaderninho.color.plate,
  border: `1px solid ${nossoCaderninho.color.rail}`,
  borderRadius: nossoCaderninho.radius.panel,
  overflow: 'hidden',
  '@media (max-width: 729px)': {
    padding: 0,
    borderRight: 0,
    borderLeft: 0,
    borderRadius: 0,
  },
});

export const reportsMobileHeaderButtonClass = css({
  width: 44,
  height: 44,
  color: nossoCaderninho.color.navText,
  borderRadius: nossoCaderninho.radius.control,
  '&[data-hovered]': {
    backgroundColor: nossoCaderninho.color.navHover,
  },
  '&[data-focus-visible]': {
    outline: `2px solid ${nossoCaderninho.color.focusOnDark}`,
    outlineOffset: -2,
  },
});

export const reportsOrganizeClass = css({
  padding: nossoCaderninho.space.lg,
  display: 'grid',
  alignContent: 'start',
  gap: nossoCaderninho.space.md,
  '& > button': {
    width: '100%',
    minHeight: 42,
    justifyContent: 'center',
  },
});

export const reportsCurrentViewClass = css({
  padding: nossoCaderninho.space.md,
  display: 'grid',
  gap: nossoCaderninho.space.sm,
  backgroundColor: nossoCaderninho.color.signalSoft,
  border: `1px solid ${nossoCaderninho.color.railSoft}`,
  borderRadius: nossoCaderninho.radius.control,
});

export const reportsMobileWidgetToolbarClass = css({
  minHeight: 38,
  padding: `0 ${nossoCaderninho.space.sm}px`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: nossoCaderninho.space.sm,
  color: nossoCaderninho.color.graphiteSubdued,
  backgroundColor: nossoCaderninho.color.partnershipSoft,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  fontSize: 11,
  '& > div': {
    display: 'flex',
    gap: nossoCaderninho.space.xs,
  },
  '& button': {
    width: 34,
    minWidth: 34,
    height: 32,
    minHeight: 32,
    padding: 0,
    color: nossoCaderninho.color.partnership,
    borderRadius: nossoCaderninho.radius.control,
  },
});

export const reportsGridItemClass = css({
  minWidth: 0,
  minHeight: 0,
  '&[data-mobile-editing="true"]': {
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr)',
    '& > div:last-child': {
      minHeight: 0,
    },
  },
});

export const reportsEmptyStateClass = css({
  width: 'min(680px, 100%)',
  margin: 'auto',
  padding: `${nossoCaderninho.space.xxl}px ${nossoCaderninho.space.xl}px`,
  color: nossoCaderninho.color.graphite,
  '& h2': {
    margin: 0,
    fontSize: 20,
    fontWeight: 720,
    letterSpacing: '-0.02em',
  },
  '& p': {
    maxWidth: '60ch',
    margin: `${nossoCaderninho.space.sm}px 0 ${nossoCaderninho.space.lg}px`,
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 13,
    lineHeight: 1.5,
  },
});
