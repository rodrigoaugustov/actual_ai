import { css } from '@emotion/css';

import { nossoCaderninho } from '#style/nossoCaderninho';

export const planningSurfaceClass = css`
  --color-pageBackground: ${nossoCaderninho.color.enamel};
  --color-pageText: ${nossoCaderninho.color.graphite};
  --color-pageTextLight: ${nossoCaderninho.color.graphiteSubdued};
  --color-pageTextSubdued: ${nossoCaderninho.color.graphiteSubdued};
  --color-pageTextDark: ${nossoCaderninho.color.graphite};
  --color-pageTextPositive: ${nossoCaderninho.color.balance};
  --color-pageTextLink: ${nossoCaderninho.color.partnership};
  --color-pageTextLinkLight: ${nossoCaderninho.color.partnership};
  --color-cardBackground: ${nossoCaderninho.color.plate};
  --color-cardBorder: ${nossoCaderninho.color.rail};
  --color-tableBackground: ${nossoCaderninho.color.plate};
  --color-tableRowBackgroundAlternate: ${nossoCaderninho.color.plate};
  --color-tableRowBackgroundHover: ${nossoCaderninho.color.signalSoft};
  --color-tableText: ${nossoCaderninho.color.graphite};
  --color-tableTextItemAdded: ${nossoCaderninho.color.partnership};
  --color-tableTextLight: ${nossoCaderninho.color.graphiteSubdued};
  --color-tableTextSubdued: ${nossoCaderninho.color.graphiteSubdued};
  --color-tableTextSelected: ${nossoCaderninho.color.graphite};
  --color-tableTextHover: ${nossoCaderninho.color.graphite};
  --color-tableTextInactive: ${nossoCaderninho.color.graphiteSubdued};
  --color-tableHeaderText: ${nossoCaderninho.color.graphite};
  --color-tableHeaderBackground: ${nossoCaderninho.color.signalSoft};
  --color-tableBorder: ${nossoCaderninho.color.railSoft};
  --color-tableBorderSelected: ${nossoCaderninho.color.partnership};
  --color-tableBorderHover: ${nossoCaderninho.color.partnership};
  --color-tableBorderSeparator: ${nossoCaderninho.color.rail};
  --color-tableRowBackgroundHighlight: ${nossoCaderninho.color.partnershipSoft};
  --color-tableRowBackgroundHighlightText: ${nossoCaderninho.color.graphite};
  --color-tableRowHeaderBackground: ${nossoCaderninho.color.signalSoft};
  --color-tableRowHeaderText: ${nossoCaderninho.color.graphite};
  --color-numberPositive: ${nossoCaderninho.color.balance};
  --color-numberNegative: ${nossoCaderninho.color.graphite};
  --color-numberNeutral: ${nossoCaderninho.color.graphiteSubdued};
  --color-budgetNumberPositive: ${nossoCaderninho.color.graphite};
  --color-budgetNumberNegative: ${nossoCaderninho.color.limit};
  --color-budgetNumberNeutral: ${nossoCaderninho.color.graphite};
  --color-budgetNumberZero: ${nossoCaderninho.color.graphiteSubdued};
  --color-toBudgetPositive: ${nossoCaderninho.color.balance};
  --color-toBudgetZero: ${nossoCaderninho.color.graphite};
  --color-toBudgetNegative: ${nossoCaderninho.color.limit};
  --color-budgetOtherMonth: ${nossoCaderninho.color.plate};
  --color-budgetCurrentMonth: ${nossoCaderninho.color.plate};
  --color-budgetHeaderOtherMonth: ${nossoCaderninho.color.signalSoft};
  --color-budgetHeaderCurrentMonth: ${nossoCaderninho.color.signalSoft};
  --color-mobilePageBackground: ${nossoCaderninho.color.enamel};
  --color-mobileHeaderBackground: ${nossoCaderninho.color.nav};
  --color-mobileHeaderText: ${nossoCaderninho.color.navText};
  --color-mobileHeaderTextSubdued: ${nossoCaderninho.color.navTextSubdued};
  --color-formInputText: ${nossoCaderninho.color.graphite};
  --color-pillBackground: ${nossoCaderninho.color.partnershipSoft};
  --color-pillBackgroundLight: ${nossoCaderninho.color.partnershipSoft};
  --color-pillText: ${nossoCaderninho.color.partnership};
  --color-pillBorder: ${nossoCaderninho.color.rail};

  min-width: 0;
  min-height: 0;
  color: ${nossoCaderninho.color.graphite};
  background: ${nossoCaderninho.color.enamel};
  font-family: ${nossoCaderninho.font.family};

  & [data-testid='budget-table'] {
    min-width: 0;
  }

  & [data-testid='budget-table-scroll-container'] {
    scrollbar-color: ${nossoCaderninho.color.rail} transparent;
  }

  & [data-testid='category-row']:hover {
    background: ${nossoCaderninho.color.signalSoft};
  }

  & button:focus-visible,
  & [role='button']:focus-visible {
    outline: 2px solid ${nossoCaderninho.color.focusOnLight};
    outline-offset: 2px;
  }
`;
