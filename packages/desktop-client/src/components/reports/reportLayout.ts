export type DashboardWidgetGeometry = {
  id: string;
  width: number;
  height: number;
  x: number;
  y: number;
};

const DASHBOARD_COLUMNS = 12;

export function moveDashboardWidget(
  widgets: readonly DashboardWidgetGeometry[],
  widgetId: string,
  direction: -1 | 1,
): DashboardWidgetGeometry[] | null {
  const reorderedWidgets = [...widgets].sort((left, right) => {
    if (left.y !== right.y) {
      return left.y - right.y;
    }
    return left.x - right.x;
  });
  const currentIndex = reorderedWidgets.findIndex(
    widget => widget.id === widgetId,
  );
  const targetIndex = currentIndex + direction;

  if (
    currentIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= reorderedWidgets.length
  ) {
    return null;
  }

  const [movedWidget] = reorderedWidgets.splice(currentIndex, 1);
  if (!movedWidget) {
    return null;
  }
  reorderedWidgets.splice(targetIndex, 0, movedWidget);

  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  return reorderedWidgets.map(widget => {
    if (cursorX > 0 && cursorX + widget.width > DASHBOARD_COLUMNS) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }

    const geometry = {
      id: widget.id,
      width: widget.width,
      height: widget.height,
      x: cursorX,
      y: cursorY,
    };
    cursorX += widget.width;
    rowHeight = Math.max(rowHeight, widget.height);

    if (cursorX >= DASHBOARD_COLUMNS) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }

    return geometry;
  });
}
