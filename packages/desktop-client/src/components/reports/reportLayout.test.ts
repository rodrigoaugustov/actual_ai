import { moveDashboardWidget } from './reportLayout';

describe('moveDashboardWidget', () => {
  const widgets = [
    { id: 'summary', width: 3, height: 1, x: 0, y: 0 },
    { id: 'wide-graph', width: 6, height: 3, x: 3, y: 0 },
    { id: 'graph', width: 3, height: 2, x: 9, y: 0 },
  ];

  it('reorders widgets without exchanging their dimensions', () => {
    const geometry = moveDashboardWidget(widgets, 'summary', 1);

    expect(geometry?.map(widget => widget.id)).toEqual([
      'wide-graph',
      'summary',
      'graph',
    ]);
    expect(geometry?.find(widget => widget.id === 'summary')).toMatchObject({
      width: 3,
      height: 1,
    });
    expect(geometry?.find(widget => widget.id === 'wide-graph')).toMatchObject({
      width: 6,
      height: 3,
    });
  });

  it('repacks widgets into non-overlapping dashboard rows', () => {
    const geometry = moveDashboardWidget(widgets, 'graph', -1);

    expect(geometry).toEqual([
      { id: 'summary', width: 3, height: 1, x: 0, y: 0 },
      { id: 'graph', width: 3, height: 2, x: 3, y: 0 },
      { id: 'wide-graph', width: 6, height: 3, x: 6, y: 0 },
    ]);
  });

  it('does nothing when movement would leave the list', () => {
    expect(moveDashboardWidget(widgets, 'summary', -1)).toBeNull();
    expect(moveDashboardWidget(widgets, 'graph', 1)).toBeNull();
  });
});
