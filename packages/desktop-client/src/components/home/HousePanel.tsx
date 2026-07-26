import type { ReactNode } from 'react';

import { css } from '@emotion/css';

import { nossoCaderninho } from '#style/nossoCaderninho';

type HousePanelProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function HousePanel({
  title,
  description,
  action,
  children,
  className,
}: HousePanelProps) {
  return (
    <section className={`${panelClass} ${className ?? ''}`}>
      <header className={headerClass}>
        <div>
          <h2 className={titleClass}>{title}</h2>
          {description && <p className={descriptionClass}>{description}</p>}
        </div>
        {action}
      </header>
      <div className={contentClass}>{children}</div>
    </section>
  );
}

const panelClass = css({
  minWidth: 0,
  containerType: 'inline-size',
  backgroundColor: nossoCaderninho.color.plate,
  borderTop: `1px solid ${nossoCaderninho.color.rail}`,
  borderBottom: `1px solid ${nossoCaderninho.color.rail}`,
  '& + &': {
    borderLeft: `1px solid ${nossoCaderninho.color.rail}`,
  },
});

const headerClass = css({
  minHeight: 64,
  padding: `${nossoCaderninho.space.lg}px`,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: nossoCaderninho.space.md,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
});

const titleClass = css({
  margin: 0,
  color: nossoCaderninho.color.graphite,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 17,
  fontWeight: 650,
  lineHeight: 1.25,
});

const descriptionClass = css({
  margin: `${nossoCaderninho.space.xs}px 0 0`,
  color: nossoCaderninho.color.graphiteSubdued,
  fontFamily: nossoCaderninho.font.family,
  fontSize: 13,
  lineHeight: 1.35,
});

const contentClass = css({
  minWidth: 0,
});
