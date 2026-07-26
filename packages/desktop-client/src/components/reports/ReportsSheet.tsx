import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgClose } from '@actual-app/components/icons/v1';
import { css, keyframes } from '@emotion/css';

import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { nossoCaderninho } from '#style/nossoCaderninho';

type ReportsSheetProps = {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  isOpen: boolean;
  returnFocusId: string;
  children: ReactNode;
  onClose: () => void;
};

export function ReportsSheet({
  id,
  title,
  subtitle,
  isOpen,
  returnFocusId,
  children,
  onClose,
}: ReportsSheetProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        requestAnimationFrame(() =>
          document.getElementById(returnFocusId)?.focus(),
        );
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
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, [isOpen, returnFocusId]);

  if (!isOpen) {
    return null;
  }

  function close() {
    onClose();
    requestAnimationFrame(() =>
      document.getElementById(returnFocusId)?.focus(),
    );
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      id={id}
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      className={sheetClass}
      onCancel={event => {
        event.preventDefault();
        close();
      }}
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
    </dialog>,
    document.body,
  );
}

const revealSheet = keyframes({
  from: {
    clipPath: 'inset(0 0 0 100%)',
    transform: 'translateX(10px)',
  },
  to: {
    clipPath: 'inset(0)',
    transform: 'translateX(0)',
  },
});

const sheetClass = css({
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  left: 'auto',
  zIndex: 120,
  width: 'min(420px, 100vw)',
  height: '100dvh',
  maxWidth: 'none',
  maxHeight: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  color: nossoCaderninho.color.graphite,
  backgroundColor: `${nossoCaderninho.color.plate} !important`,
  border: 0,
  boxShadow: '-18px 0 48px rgba(16, 41, 47, 0.16)',
  fontFamily: nossoCaderninho.font.family,
  animation: `${revealSheet} ${nossoCaderninho.motion.duration} ${nossoCaderninho.motion.easing}`,
  boxSizing: 'border-box',
  '&::backdrop': {
    backgroundColor: 'rgba(16, 41, 47, 0.22)',
  },
  '@media (max-width: 729px)': {
    bottom: MOBILE_NAV_HEIGHT,
    width: '100vw',
    height: `calc(100dvh - ${MOBILE_NAV_HEIGHT}px)`,
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
  '& h2': {
    margin: 0,
    color: nossoCaderninho.color.graphite,
    fontSize: 17,
    fontWeight: 650,
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
    outlineOffset: -2,
  },
});

const contentClass = css({
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
});
