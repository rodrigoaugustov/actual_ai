import { css } from '@emotion/css';

import { nossoCaderninho } from '#style/nossoCaderninho';

export const movementsSurfaceClass = css`
  --color-pageBackground: ${nossoCaderninho.color.enamel};
  --color-pageText: ${nossoCaderninho.color.graphite};
  --color-pageTextLight: ${nossoCaderninho.color.graphiteSubdued};
  --color-pageTextSubdued: ${nossoCaderninho.color.graphiteSubdued};
  --color-pageTextDark: ${nossoCaderninho.color.graphite};
  --color-pageTextPositive: ${nossoCaderninho.color.balance};
  --color-pageTextLink: ${nossoCaderninho.color.partnership};
  --color-pageTextLinkLight: ${nossoCaderninho.color.partnership};
  --color-numberPositive: ${nossoCaderninho.color.balance};
  --color-numberNegative: ${nossoCaderninho.color.graphite};
  --color-numberNeutral: ${nossoCaderninho.color.graphiteSubdued};
  --color-tableBackground: ${nossoCaderninho.color.plate};
  --color-tableRowBackgroundHover: ${nossoCaderninho.color.signalSoft};
  --color-tableText: ${nossoCaderninho.color.graphite};
  --color-tableTextItemAdded: ${nossoCaderninho.color.partnership};
  --color-tableTextLight: ${nossoCaderninho.color.graphiteSubdued};
  --color-tableTextSubdued: ${nossoCaderninho.color.graphiteSubdued};
  --color-tableTextSelected: ${nossoCaderninho.color.graphite};
  --color-tableTextHover: ${nossoCaderninho.color.graphite};
  --color-tableTextInactive: ${nossoCaderninho.color.graphiteSubdued};
  --color-tableHeaderText: ${nossoCaderninho.color.graphiteSubdued};
  --color-tableHeaderBackground: ${nossoCaderninho.color.signalSoft};
  --color-tableBorder: ${nossoCaderninho.color.railSoft};
  --color-tableBorderSelected: ${nossoCaderninho.color.partnership};
  --color-tableBorderHover: ${nossoCaderninho.color.rail};
  --color-tableBorderSeparator: ${nossoCaderninho.color.rail};
  --color-tableRowBackgroundAlternate: ${nossoCaderninho.color.plate};
  --color-tableRowBackgroundHighlight: ${nossoCaderninho.color.partnershipSoft};
  --color-tableRowBackgroundHighlightText: ${nossoCaderninho.color.graphite};
  --color-tableRowHeaderBackground: ${nossoCaderninho.color.signalSoft};
  --color-tableRowHeaderText: ${nossoCaderninho.color.graphiteSubdued};
  --color-menuItemTextSelected: ${nossoCaderninho.color.partnership};
  --color-mobilePageBackground: ${nossoCaderninho.color.enamel};
  --color-mobileHeaderBackground: ${nossoCaderninho.color.nav};
  --color-mobileHeaderText: ${nossoCaderninho.color.navText};
  --color-mobileHeaderTextSubdued: ${nossoCaderninho.color.navTextSubdued};
  --color-mobileHeaderTextHover: ${nossoCaderninho.color.navHover};
  --color-mobileAccountText: ${nossoCaderninho.color.graphite};
  --color-mobileTransactionSelected: ${nossoCaderninho.color.partnership};
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
  --color-pillBackgroundSelected: ${nossoCaderninho.color.partnershipSoft};
  --color-pillTextSelected: ${nossoCaderninho.color.partnership};
  --color-pillBorderSelected: ${nossoCaderninho.color.partnership};
  --color-floatingActionBarBackground: ${nossoCaderninho.color.nav};
  --color-floatingActionBarBorder: ${nossoCaderninho.color.navHover};
  --color-floatingActionBarText: ${nossoCaderninho.color.navText};

  min-width: 0;
  color: ${nossoCaderninho.color.graphite};
  background: ${nossoCaderninho.color.enamel};
  font-family: ${nossoCaderninho.font.family};
`;

export const movementsLedgerClass = css({
  minWidth: 0,
  flex: 1,
  overflow: 'hidden',
  containerType: 'inline-size',
  backgroundColor: nossoCaderninho.color.plate,
  borderTop: `1px solid ${nossoCaderninho.color.rail}`,
  '@container (max-width: 700px)': {
    '& [data-testid="notes"]': {
      display: 'none !important',
    },
    '& [data-testid="date"]': {
      width: '84px !important',
      flex: '0 0 84px !important',
    },
    '& [data-testid="payment"], & [data-testid="deposit"], & [data-testid="debit"], & [data-testid="credit"]':
      {
        width: '82px !important',
        flex: '0 0 82px !important',
      },
  },
  '@media (max-width: 899px)': {
    borderTopColor: nossoCaderninho.color.railSoft,
  },
});
