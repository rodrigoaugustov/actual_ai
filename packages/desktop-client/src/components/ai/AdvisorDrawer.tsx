import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgClose } from '@actual-app/components/icons/v1';
import { css, keyframes } from '@emotion/css';

import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { advisorSurfaceClass } from './advisorStyles';

type AdvisorDrawerProps = {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  isOpen: boolean;
  size?: 'normal' | 'wide';
  returnFocusId?: string;
  children: ReactNode;
  onClose: () => void;
};

export function AdvisorDrawer({
  id,
  title,
  subtitle,
  isOpen,
  size = 'normal',
  returnFocusId,
  children,
  onClose,
}: AdvisorDrawerProps) {
  const { t } = useTranslation();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current();
        requestAnimationFrame(() => {
          document.getElementById(returnFocusId ?? '')?.focus();
        });
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }

      const focusable = [
        ...(dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? []),
      ];
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, returnFocusId]);

  if (!isOpen) {
    return null;
  }

  function close() {
    onClose();
    requestAnimationFrame(() => {
      document.getElementById(returnFocusId ?? '')?.focus();
    });
  }

  return createPortal(
    <>
      <button
        type="button"
        className={backdropClass}
        aria-label={t('Close advisor panel')}
        onClick={close}
      />
      <dialog
        ref={dialogRef}
        open
        aria-modal="true"
        id={id}
        className={`${advisorSurfaceClass} ${drawerClass}`}
        data-size={size}
        aria-labelledby={`${id}-title`}
      >
        <header className={headerClass}>
          <div>
            <h2 id={`${id}-title`}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <Button
            ref={closeButtonRef}
            variant="bare"
            aria-label={t('Close')}
            className={closeButtonClass}
            onPress={close}
          >
            <SvgClose width={16} height={16} />
          </Button>
        </header>
        <div className={contentClass}>{children}</div>
        <span className={escapeHintClass}>
          <Trans>Press Esc to close</Trans>
        </span>
      </dialog>
    </>,
    document.body,
  );
}

const revealDrawer = keyframes({
  from: {
    clipPath: 'inset(0 0 0 100%)',
    transform: 'translateX(10px)',
  },
  to: {
    clipPath: 'inset(0)',
    transform: 'translateX(0)',
  },
});

const backdropClass = css({
  position: 'fixed',
  inset: 0,
  zIndex: 119,
  padding: 0,
  backgroundColor: 'rgba(16, 41, 47, 0.22)',
  border: 0,
});

const drawerClass = css({
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  left: 'auto',
  zIndex: 120,
  height: '100dvh',
  width: 'min(440px, 100vw)',
  maxWidth: 'none',
  maxHeight: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  color: nossoCaderninho.color.graphite,
  backgroundColor: `${nossoCaderninho.color.plate} !important`,
  border: 0,
  boxShadow: '-18px 0 48px rgba(16, 41, 47, 0.16)',
  fontFamily: nossoCaderninho.font.family,
  animation: `${revealDrawer} ${nossoCaderninho.motion.duration} ${nossoCaderninho.motion.easing}`,
  boxSizing: 'border-box',
  '&[data-size="wide"]': {
    width: 'min(560px, 100vw)',
  },
  '@media (max-width: 729px)': {
    top: 0,
    bottom: MOBILE_NAV_HEIGHT,
    height: `calc(100dvh - ${MOBILE_NAV_HEIGHT}px)`,
    width: '100vw',
    '&[data-size="wide"]': {
      width: '100vw',
    },
    boxShadow: '0 -18px 48px rgba(16, 41, 47, 0.16)',
  },
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
});

const headerClass = css({
  minHeight: 70,
  padding: `${nossoCaderninho.space.md}px ${nossoCaderninho.space.lg}px`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: nossoCaderninho.space.md,
  backgroundColor: nossoCaderninho.color.plate,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  '& > div': {
    minWidth: 0,
  },
  '& h2': {
    margin: 0,
    color: nossoCaderninho.color.graphite,
    fontSize: 17,
    fontWeight: 650,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  '& p': {
    margin: '3px 0 0',
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 11,
    lineHeight: 1.35,
  },
});

const closeButtonClass = css({
  width: 44,
  height: 44,
  flexShrink: 0,
  color: nossoCaderninho.color.graphiteSubdued,
  borderRadius: nossoCaderninho.radius.control,
  '&[data-hovered]': {
    color: nossoCaderninho.color.graphite,
    backgroundColor: nossoCaderninho.color.signalSoft,
  },
  '&[data-focus-visible]': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: 1,
  },
});

const contentClass = css({
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
});

const escapeHintClass = css({
  padding: `${nossoCaderninho.space.xs}px ${nossoCaderninho.space.lg}px ${nossoCaderninho.space.sm}px`,
  color: nossoCaderninho.color.graphiteSubdued,
  backgroundColor: nossoCaderninho.color.plate,
  fontSize: 10,
  textAlign: 'right',
  '@media (max-width: 729px)': {
    display: 'none',
  },
});
