import type { ReactNode } from 'react';
import { Trans } from 'react-i18next';

import { SvgHardDrive, SvgHome } from '@actual-app/components/icons/v1';
import { css } from '@emotion/css';

import { nossoCaderninho } from '#style/nossoCaderninho';

type ManagerSurfaceProps = {
  chapter: ReactNode;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  status?: ReactNode;
};

export function ManagerSurface({
  chapter,
  title,
  description,
  children,
  status,
}: ManagerSurfaceProps) {
  return (
    <main className={surfaceClass}>
      <section className={identityClass}>
        <div className={wordmarkClass}>
          <span className={wordmarkIconClass}>
            <SvgHome width={18} height={18} aria-hidden />
          </span>
          <strong>
            <Trans>Nosso Caderninho</Trans>
          </strong>
        </div>

        <div className={`${promiseClass} ${desktopContextClass}`}>
          <span className={chapterClass}>{chapter}</span>
          <h1 className={titleClass}>{title}</h1>
          <p className={descriptionClass}>{description}</p>
        </div>

        <div className={`${localStatusClass} ${desktopContextClass}`}>
          <SvgHardDrive width={16} height={16} aria-hidden />
          {status ?? <Trans>Available even without internet</Trans>}
        </div>
      </section>

      <section className={stageClass}>
        <div className={mobileContextClass}>
          <span className={mobileChapterClass}>{chapter}</span>
          <h1 className={mobileTitleClass}>{title}</h1>
          <p className={mobileDescriptionClass}>{description}</p>
          <div className={mobileStatusClass}>
            <SvgHardDrive width={15} height={15} aria-hidden />
            {status ?? <Trans>Available even without internet</Trans>}
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}

const surfaceClass = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(260px, 0.82fr) minmax(360px, 1.18fr)',
  width: 'min(960px, 100%)',
  minHeight: 520,
  maxHeight: 'min(720px, calc(100dvh - 96px))',
  overflow: 'hidden',
  color: nossoCaderninho.color.graphite,
  backgroundColor: nossoCaderninho.color.plate,
  border: `1px solid ${nossoCaderninho.color.rail}`,
  borderRadius: nossoCaderninho.radius.panel,
  fontFamily: nossoCaderninho.font.family,
  '@media (max-width: 720px)': {
    gridTemplateColumns: 'minmax(0, 1fr)',
    width: '100%',
    minHeight: 0,
    maxHeight: 'none',
    overflow: 'visible',
    border: 0,
    borderRadius: 0,
  },
});

const identityClass = css({
  display: 'flex',
  minWidth: 0,
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: nossoCaderninho.space.xxl,
  padding: nossoCaderninho.space.xxl,
  color: nossoCaderninho.color.navText,
  backgroundColor: nossoCaderninho.color.nav,
  borderRight: `1px solid ${nossoCaderninho.color.rail}`,
  '@media (max-width: 720px)': {
    gap: 0,
    padding: 'calc(12px + env(safe-area-inset-top)) 20px 12px',
    borderRight: 0,
    borderBottom: `1px solid ${nossoCaderninho.color.rail}`,
  },
});

const wordmarkClass = css({
  display: 'flex',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
  fontSize: 14,
  lineHeight: 1.25,
});

const wordmarkIconClass = css({
  display: 'grid',
  width: 30,
  height: 30,
  placeItems: 'center',
  color: nossoCaderninho.color.navText,
  backgroundColor: nossoCaderninho.color.partnershipSurface,
  borderRadius: nossoCaderninho.radius.control,
});

const promiseClass = css({
  display: 'grid',
  gap: nossoCaderninho.space.md,
  maxWidth: '32ch',
});

const chapterClass = css({
  color: nossoCaderninho.color.navTextSubdued,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.3,
});

const titleClass = css({
  margin: 0,
  color: nossoCaderninho.color.navText,
  fontSize: 28,
  fontWeight: 720,
  lineHeight: 1.08,
  letterSpacing: '-0.025em',
  textWrap: 'balance',
  '@media (max-width: 720px)': {
    fontSize: 24,
  },
});

const descriptionClass = css({
  margin: 0,
  color: nossoCaderninho.color.navTextSubdued,
  fontSize: 14,
  lineHeight: 1.5,
});

const localStatusClass = css({
  display: 'flex',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
  color: nossoCaderninho.color.navTextSubdued,
  fontSize: 12,
  lineHeight: 1.35,
});

const desktopContextClass = css({
  '@media (max-width: 720px)': {
    display: 'none',
  },
});

const stageClass = css({
  display: 'flex',
  minWidth: 0,
  minHeight: 0,
  flexDirection: 'column',
  padding: nossoCaderninho.space.xxl,
  backgroundColor: nossoCaderninho.color.plate,
  overflowY: 'auto',
  '@media (max-width: 720px)': {
    overflowY: 'visible',
    padding: '24px 20px calc(88px + env(safe-area-inset-bottom))',
  },
});

const mobileContextClass = css({
  display: 'none',
  '@media (max-width: 720px)': {
    display: 'grid',
    gap: nossoCaderninho.space.sm,
    marginBottom: nossoCaderninho.space.xl,
  },
});

const mobileChapterClass = css({
  color: nossoCaderninho.color.graphiteSubdued,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.3,
});

const mobileTitleClass = css({
  margin: 0,
  color: nossoCaderninho.color.graphite,
  fontSize: 24,
  fontWeight: 720,
  lineHeight: 1.08,
  letterSpacing: '-0.025em',
  textWrap: 'balance',
});

const mobileDescriptionClass = css({
  maxWidth: '58ch',
  margin: 0,
  color: nossoCaderninho.color.graphiteSubdued,
  fontSize: 13,
  lineHeight: 1.45,
});

const mobileStatusClass = css({
  display: 'flex',
  alignItems: 'center',
  gap: nossoCaderninho.space.sm,
  marginTop: nossoCaderninho.space.xs,
  color: nossoCaderninho.color.balance,
  fontSize: 12,
  lineHeight: 1.35,
});
