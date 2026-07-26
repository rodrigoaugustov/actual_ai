import { css } from '@emotion/css';

import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { nossoCaderninho } from '#style/nossoCaderninho';

export const advisorSurfaceClass = css`
  --color-pageBackground: ${nossoCaderninho.color.enamel};
  --color-pageText: ${nossoCaderninho.color.graphite};
  --color-pageTextLight: ${nossoCaderninho.color.graphiteSubdued};
  --color-pageTextSubdued: ${nossoCaderninho.color.graphiteSubdued};
  --color-pageTextLink: ${nossoCaderninho.color.partnership};
  --color-tableBackground: ${nossoCaderninho.color.plate};
  --color-tableHeaderBackground: ${nossoCaderninho.color.signalSoft};
  --color-tableHeaderText: ${nossoCaderninho.color.graphiteSubdued};
  --color-tableText: ${nossoCaderninho.color.graphite};
  --color-tableTextLight: ${nossoCaderninho.color.graphiteSubdued};
  --color-tableTextSubdued: ${nossoCaderninho.color.graphiteSubdued};
  --color-tableBorder: ${nossoCaderninho.color.railSoft};
  --color-tableBorderSeparator: ${nossoCaderninho.color.rail};
  --color-tableRowBackgroundHover: ${nossoCaderninho.color.signalSoft};
  --color-tableRowBackgroundHighlight: ${nossoCaderninho.color.partnershipSoft};
  --color-tableRowBackgroundHighlightText: ${nossoCaderninho.color.graphite};
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
  --color-checkboxBackgroundSelected: ${nossoCaderninho.color.partnership};
  --color-checkboxBorderSelected: ${nossoCaderninho.color.partnership};
  --color-pillBackground: ${nossoCaderninho.color.signalSoft};
  --color-pillBackgroundLight: ${nossoCaderninho.color.signalSoft};
  --color-pillText: ${nossoCaderninho.color.graphiteSubdued};
  --color-pillTextHighlighted: ${nossoCaderninho.color.graphite};
  --color-pillBorder: ${nossoCaderninho.color.railSoft};
  --color-pillBorderDark: ${nossoCaderninho.color.railSoft};
  --color-pillBackgroundSelected: ${nossoCaderninho.color.partnershipSoft};
  --color-pillTextSelected: ${nossoCaderninho.color.partnership};
  --color-pillBorderSelected: ${nossoCaderninho.color.partnership};
  --color-markdownLight: ${nossoCaderninho.color.signalSoft};
  --color-noticeText: ${nossoCaderninho.color.balance};
  --color-errorText: ${nossoCaderninho.color.limit};
  --color-errorTextMenu: ${nossoCaderninho.color.limit};
  --color-mobilePageBackground: ${nossoCaderninho.color.enamel};
  --color-mobileHeaderBackground: ${nossoCaderninho.color.nav};
  --color-mobileHeaderText: ${nossoCaderninho.color.navText};
  --color-mobileHeaderTextSubdued: ${nossoCaderninho.color.navTextSubdued};
  --color-mobileHeaderTextHover: ${nossoCaderninho.color.navHover};

  min-width: 0;
  min-height: 0;
  flex: 1;
  color: ${nossoCaderninho.color.graphite};
  background: ${nossoCaderninho.color.enamel};
  font-family: ${nossoCaderninho.font.family};
`;

export const advisorWorkspaceClass = css({
  minWidth: 0,
  minHeight: 0,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: nossoCaderninho.color.enamel,
  '&[data-mobile="true"]': {
    paddingBottom: MOBILE_NAV_HEIGHT,
  },
});

export const advisorDesktopHeaderClass = css({
  minHeight: 68,
  padding: `0 ${nossoCaderninho.space.xl}px`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: nossoCaderninho.space.lg,
  flexShrink: 0,
  backgroundColor: nossoCaderninho.color.plate,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  '@media (max-width: 899px)': {
    padding: `0 ${nossoCaderninho.space.lg}px`,
  },
});

export const advisorHeaderIdentityClass = css({
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: nossoCaderninho.space.md,
  '& > button': {
    width: 40,
    height: 40,
    flexShrink: 0,
  },
  '& > div': {
    minWidth: 0,
  },
  '& h1': {
    margin: 0,
    overflow: 'hidden',
    color: nossoCaderninho.color.graphite,
    fontSize: 20,
    fontWeight: 720,
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '& p': {
    margin: '3px 0 0',
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 11,
  },
});

export const advisorHeaderActionsClass = css({
  display: 'flex',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
});

export const advisorHeaderButtonClass = css({
  minHeight: 40,
  padding: `0 ${nossoCaderninho.space.md}px`,
  gap: nossoCaderninho.space.sm,
  color: nossoCaderninho.color.graphite,
  borderRadius: nossoCaderninho.radius.control,
  '&[data-hovered]': {
    backgroundColor: nossoCaderninho.color.signalSoft,
  },
  '&[data-focus-visible]': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: 1,
  },
});

export const advisorContextRailClass = css({
  minHeight: 34,
  padding: `0 ${nossoCaderninho.space.xl}px`,
  display: 'flex',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
  flexShrink: 0,
  overflow: 'hidden',
  color: nossoCaderninho.color.graphiteSubdued,
  backgroundColor: nossoCaderninho.color.plate,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  fontSize: 11,
  whiteSpace: 'nowrap',
  '& strong': {
    color: nossoCaderninho.color.graphite,
    fontWeight: 650,
  },
  '& span': {
    flexShrink: 0,
  },
  '@media (max-width: 729px)': {
    minHeight: 32,
    padding: `0 ${nossoCaderninho.space.lg}px`,
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
});

export const advisorConnectionDotClass = css({
  width: 7,
  height: 7,
  flexShrink: 0,
  backgroundColor: nossoCaderninho.color.balance,
  borderRadius: nossoCaderninho.radius.status,
  '&[data-online="false"]': {
    backgroundColor: nossoCaderninho.color.graphiteSubdued,
  },
});

export const advisorConversationClass = css({
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: nossoCaderninho.color.plate,
});

export const advisorMessageListClass = css({
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  overscrollBehavior: 'contain',
  scrollBehavior: 'smooth',
  backgroundColor: nossoCaderninho.color.plate,
});

export const advisorMessageMeasureClass = css({
  width: 'min(900px, 100%)',
  minHeight: '100%',
  margin: '0 auto',
  padding: `${nossoCaderninho.space.xl}px ${nossoCaderninho.space.xl}px`,
  display: 'flex',
  flexDirection: 'column',
  gap: nossoCaderninho.space.xl,
  boxSizing: 'border-box',
  '@media (max-width: 729px)': {
    padding: `${nossoCaderninho.space.lg}px ${nossoCaderninho.space.lg}px ${nossoCaderninho.space.xl}px`,
    gap: nossoCaderninho.space.lg,
  },
});

export const advisorInlineErrorClass = css({
  width: 'min(900px, 100%)',
  margin: '0 auto',
  padding: `${nossoCaderninho.space.md}px ${nossoCaderninho.space.xl}px`,
  color: nossoCaderninho.color.limit,
  backgroundColor: nossoCaderninho.color.limitSoft,
  borderTop: `1px solid ${nossoCaderninho.color.railSoft}`,
  fontSize: 12,
  boxSizing: 'border-box',
});

export const advisorComposerAreaClass = css({
  flexShrink: 0,
  padding: `${nossoCaderninho.space.md}px ${nossoCaderninho.space.xl}px ${nossoCaderninho.space.sm}px`,
  backgroundColor: nossoCaderninho.color.plate,
  borderTop: `1px solid ${nossoCaderninho.color.railSoft}`,
  '@media (max-width: 729px)': {
    padding: `${nossoCaderninho.space.sm}px ${nossoCaderninho.space.md}px ${nossoCaderninho.space.sm}px`,
  },
});

export const advisorComposerClass = css({
  width: 'min(900px, 100%)',
  minHeight: 58,
  margin: '0 auto',
  padding: nossoCaderninho.space.sm,
  display: 'flex',
  alignItems: 'flex-end',
  gap: nossoCaderninho.space.sm,
  backgroundColor: nossoCaderninho.color.plate,
  border: `1px solid ${nossoCaderninho.color.rail}`,
  borderRadius: nossoCaderninho.radius.panel,
  boxSizing: 'border-box',
  '&:focus-within': {
    borderColor: nossoCaderninho.color.partnership,
    boxShadow: `0 0 0 1px ${nossoCaderninho.color.focusOnLight}`,
  },
});

export const advisorTextareaClass = css({
  minWidth: 0,
  minHeight: 40,
  maxHeight: 112,
  flex: 1,
  padding: `${nossoCaderninho.space.sm}px`,
  resize: 'none',
  overflowY: 'auto',
  color: nossoCaderninho.color.graphite,
  backgroundColor: 'transparent',
  border: 0,
  outline: 0,
  font: `400 13px/1.45 ${nossoCaderninho.font.family}`,
  '&::placeholder': {
    color: nossoCaderninho.color.graphiteSubdued,
    opacity: 1,
  },
});

export const advisorSendButtonClass = css({
  minWidth: 44,
  minHeight: 40,
  flexShrink: 0,
  borderRadius: nossoCaderninho.radius.control,
});

export const advisorComposerHintClass = css({
  width: 'min(900px, 100%)',
  margin: `${nossoCaderninho.space.xs}px auto 0`,
  color: nossoCaderninho.color.graphiteSubdued,
  fontSize: 10,
  lineHeight: 1.35,
  textAlign: 'center',
  '&[data-offline="true"]': {
    color: nossoCaderninho.color.limit,
    fontSize: 11,
    fontWeight: 600,
  },
});

export const advisorHistoryListClass = css({
  display: 'grid',
});

export const advisorNewConversationClass = css({
  width: 'calc(100% - 32px)',
  minHeight: 42,
  margin: `${nossoCaderninho.space.lg}px`,
  gap: nossoCaderninho.space.sm,
  borderRadius: nossoCaderninho.radius.control,
});

export const advisorHistoryRowClass = css({
  minWidth: 0,
  minHeight: 58,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 44px',
  alignItems: 'stretch',
  backgroundColor: nossoCaderninho.color.plate,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  '&[data-current="true"]': {
    backgroundColor: nossoCaderninho.color.partnershipSoft,
  },
});

export const advisorHistorySelectClass = css({
  minWidth: 0,
  padding: `${nossoCaderninho.space.sm}px ${nossoCaderninho.space.lg}px`,
  display: 'grid',
  alignContent: 'center',
  justifyItems: 'start',
  gap: 3,
  color: nossoCaderninho.color.graphite,
  backgroundColor: 'transparent',
  border: 0,
  font: `500 13px ${nossoCaderninho.font.family}`,
  textAlign: 'left',
  cursor: 'pointer',
  '& strong': {
    width: '100%',
    overflow: 'hidden',
    fontWeight: 600,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '& span': {
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 10,
  },
  '&:hover': {
    backgroundColor: nossoCaderninho.color.signalSoft,
  },
  '&:focus-visible': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: -2,
  },
  '&:disabled': {
    cursor: 'not-allowed',
    opacity: 0.55,
  },
});

export const advisorHistoryDeleteClass = css({
  width: 44,
  minHeight: 44,
  alignSelf: 'center',
  color: nossoCaderninho.color.graphiteSubdued,
  borderRadius: nossoCaderninho.radius.control,
  '&[data-hovered]': {
    color: nossoCaderninho.color.limit,
    backgroundColor: nossoCaderninho.color.limitSoft,
  },
  '&[data-focus-visible]': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: 1,
  },
});

export const advisorContextLayoutClass = css({
  minHeight: '100%',
  display: 'grid',
  gridTemplateColumns: '150px minmax(0, 1fr)',
  '@media (max-width: 529px)': {
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'auto minmax(0, 1fr)',
  },
});

export const advisorContextNavClass = css({
  padding: `${nossoCaderninho.space.sm}px 0`,
  display: 'grid',
  alignContent: 'start',
  backgroundColor: nossoCaderninho.color.signalSoft,
  borderRight: `1px solid ${nossoCaderninho.color.railSoft}`,
  '@media (max-width: 529px)': {
    padding: `${nossoCaderninho.space.xs}px 0`,
    gridTemplateColumns: '1fr',
    backgroundColor: nossoCaderninho.color.plate,
    borderRight: 0,
    borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  },
});

export const advisorContextNavButtonClass = css({
  minWidth: 0,
  minHeight: 46,
  padding: `0 ${nossoCaderninho.space.md}px`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: nossoCaderninho.space.sm,
  color: nossoCaderninho.color.graphite,
  backgroundColor: 'transparent',
  border: 0,
  font: `500 12px ${nossoCaderninho.font.family}`,
  textAlign: 'left',
  cursor: 'pointer',
  '& span:last-child': {
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 10,
  },
  '&[aria-selected="true"]': {
    color: nossoCaderninho.color.partnership,
    backgroundColor: nossoCaderninho.color.partnershipSoft,
    fontWeight: 650,
  },
  '&:hover': {
    backgroundColor: nossoCaderninho.color.partnershipSoft,
  },
  '&:focus-visible': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: -2,
  },
  '@media (max-width: 529px)': {
    minHeight: 44,
    padding: `0 ${nossoCaderninho.space.lg}px`,
    justifyContent: 'space-between',
    fontSize: 12,
  },
});

export const advisorContextPanelClass = css({
  minWidth: 0,
  minHeight: 0,
  padding: nossoCaderninho.space.lg,
  overflowY: 'auto',
  backgroundColor: nossoCaderninho.color.plate,
  '& > div': {
    minWidth: 0,
  },
  '@media (max-width: 529px)': {
    padding: nossoCaderninho.space.md,
  },
});
