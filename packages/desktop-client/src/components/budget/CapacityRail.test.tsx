import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TestProviders } from '#mocks';

import { CapacityRail } from './CapacityRail';
import type { CapacityMetric } from './CapacityRail';

const metrics: CapacityMetric[] = [
  { label: 'Planned', value: '100', tone: 'partnership' },
  { label: 'Spent', value: '-60', tone: 'commitment' },
  { label: 'Transfers', value: '10', tone: 'partnership' },
  { label: 'Net spending', value: '-50', tone: 'commitment' },
  { label: 'Remaining in plan', value: '40', tone: 'balance' },
  { label: 'Projected savings', value: '20', tone: 'balance' },
];

function renderRail(metricCount: number, action?: ReactNode) {
  render(
    <TestProviders>
      <CapacityRail
        metrics={metrics.slice(0, metricCount)}
        action={action}
        usedRatio={60}
        isOverPlan={false}
      />
    </TestProviders>,
  );

  const rail = screen.getByRole('region', {
    name: 'Household capacity for this month',
  });
  const grid = rail.firstElementChild;
  if (!(grid instanceof HTMLDivElement)) {
    throw new Error('Capacity rail grid was not rendered');
  }
  return grid;
}

function collectCssRules(rules: CSSRuleList): string[] {
  return Array.from(rules).flatMap(rule => {
    const nestedRules = 'cssRules' in rule ? rule.cssRules : undefined;
    return [
      rule.cssText,
      ...(nestedRules instanceof CSSRuleList
        ? collectCssRules(nestedRules)
        : []),
    ];
  });
}

function getRenderedGridCss(grid: HTMLDivElement) {
  const selectors = grid.className
    .split(' ')
    .filter(Boolean)
    .map(className => `.${className}`);

  return Array.from(document.styleSheets)
    .flatMap(styleSheet => collectCssRules(styleSheet.cssRules))
    .filter(rule => selectors.some(selector => rule.includes(selector)))
    .join('\n')
    .replaceAll(/\s/g, '');
}

describe('CapacityRail responsive structure', () => {
  it('uses the injected CSS for one dynamic row above 520px and two columns at 520px', () => {
    const grid = renderRail(6);
    const css = getRenderedGridCss(grid);

    expect(css).toContain(
      'grid-template-columns:repeat(var(--capacity-rail-columns),minmax(0,1fr))',
    );
    expect(css).not.toContain('grid-template-columns:repeat(4,');
    expect(css).toContain('@container(max-width:520px)');
    expect(css).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
    expect(css).toMatch(/:nth-child\(even\).*border-left:/);
    expect(css).toMatch(/:nth-last-child\(-n\+2\).*border-bottom:0/);
  });

  it.each([
    ['tracking off', 4, undefined, 4],
    ['tracking on', 6, undefined, 6],
    ['envelope off', 3, <button type="button">Assign</button>, 4],
    ['envelope on', 5, <button type="button">Assign</button>, 6],
  ] as const)(
    'keeps the %s cardinality and action position on both sides of 520px',
    (_mode, metricCount, action, expectedItems) => {
      const grid = renderRail(metricCount, action);

      expect(grid).toHaveAttribute(
        'style',
        `--capacity-rail-columns: ${expectedItems};`,
      );
      expect(grid.children).toHaveLength(expectedItems);

      if (action) {
        const actionItem = screen.getByRole('button', {
          name: 'Assign',
        }).parentElement;
        expect(actionItem).toBe(grid.lastElementChild);
        expect(Array.from(grid.children).indexOf(actionItem as Element)).toBe(
          expectedItems - 1,
        );
      }
    },
  );
});
