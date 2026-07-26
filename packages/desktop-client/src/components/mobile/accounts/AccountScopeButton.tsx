import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgCheveronDown, SvgClose } from '@actual-app/components/icons/v1';
import { css } from '@emotion/css';

import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { useAccounts } from '#hooks/useAccounts';
import { useNavigate } from '#hooks/useNavigate';
import { nossoCaderninho } from '#style/nossoCaderninho';

type AccountScopeButtonProps = {
  currentId?: string;
  currentName: string;
  appearance?: 'nav' | 'surface';
};

type ScopeItem = {
  id: string;
  name: string;
  path: string;
};

export function AccountScopeButton({
  currentId,
  currentName,
  appearance = 'nav',
}: AccountScopeButtonProps) {
  const { t } = useTranslation();
  const { data: accounts = [] } = useAccounts();
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled])',
        ),
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }

    window.addEventListener('keydown', handleDialogKeyDown);
    return () => window.removeEventListener('keydown', handleDialogKeyDown);
  }, [isOpen]);

  const scopes: ScopeItem[] = [
    { id: 'all', name: t('All Accounts'), path: '/accounts' },
    {
      id: 'onbudget',
      name: t('On Budget Accounts'),
      path: '/accounts/onbudget',
    },
    {
      id: 'offbudget',
      name: t('Off Budget Accounts'),
      path: '/accounts/offbudget',
    },
    {
      id: 'uncategorized',
      name: t('Uncategorized'),
      path: '/accounts/uncategorized',
    },
  ];
  const openAccounts = accounts.filter(account => !account.closed);
  const closedAccounts = accounts.filter(account => account.closed);

  function isCurrentScope(id: string) {
    return id === (currentId || 'all');
  }

  function selectScope(path: string) {
    setOpen(false);
    void navigate(path);
  }

  function dismissSelector() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <>
      <Button
        ref={triggerRef}
        variant="bare"
        aria-expanded={isOpen}
        aria-controls="account-scope-navigation"
        aria-haspopup="dialog"
        onPress={() => setOpen(open => !open)}
        style={{
          maxWidth: '100%',
          minHeight: 38,
          padding: '4px 8px',
          color:
            appearance === 'nav'
              ? nossoCaderninho.color.navText
              : nossoCaderninho.color.graphite,
          backgroundColor:
            appearance === 'surface' ? nossoCaderninho.color.plate : undefined,
          border:
            appearance === 'surface'
              ? `1px solid ${nossoCaderninho.color.rail}`
              : undefined,
          borderRadius: nossoCaderninho.radius.control,
        }}
      >
        <span className={triggerLabelClass}>{currentName}</span>
        <SvgCheveronDown
          width={12}
          height={12}
          style={{
            marginLeft: nossoCaderninho.space.xs,
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : undefined,
            transition: `transform ${nossoCaderninho.motion.duration} ${nossoCaderninho.motion.easing}`,
          }}
        />
      </Button>

      {isOpen &&
        createPortal(
          <>
            <button
              type="button"
              className={backdropClass}
              aria-label={t('Close account selector')}
              onClick={dismissSelector}
            />
            <dialog
              ref={dialogRef}
              open
              aria-modal="true"
              id="account-scope-navigation"
              className={sheetClass}
              aria-label={t('Choose account')}
            >
              <header className={sheetHeaderClass}>
                <div>
                  <strong>
                    <Trans>Movements</Trans>
                  </strong>
                  <span>
                    <Trans>Choose which accounts to see</Trans>
                  </span>
                </div>
                <Button
                  variant="bare"
                  aria-label={t('Close')}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    color: nossoCaderninho.color.graphiteSubdued,
                  }}
                  onPress={dismissSelector}
                >
                  <SvgClose width={16} height={16} />
                </Button>
              </header>

              <nav className={scopeListClass}>
                {scopes.map(scope => (
                  <ScopeButton
                    key={scope.id}
                    item={scope}
                    isCurrent={isCurrentScope(scope.id)}
                    onSelect={selectScope}
                  />
                ))}
              </nav>

              {openAccounts.length > 0 && (
                <AccountGroup
                  label={t('Accounts')}
                  accounts={openAccounts}
                  currentId={currentId}
                  onSelect={selectScope}
                />
              )}
              {closedAccounts.length > 0 && (
                <AccountGroup
                  label={t('Closed Accounts')}
                  accounts={closedAccounts}
                  currentId={currentId}
                  onSelect={selectScope}
                />
              )}
            </dialog>
          </>,
          document.body,
        )}
    </>
  );
}

function AccountGroup({
  label,
  accounts,
  currentId,
  onSelect,
}: {
  label: string;
  accounts: NonNullable<ReturnType<typeof useAccounts>['data']>;
  currentId?: string;
  onSelect: (path: string) => void;
}) {
  return (
    <section className={accountGroupClass}>
      <h2>{label}</h2>
      <nav className={scopeListClass}>
        {accounts.map(account => (
          <ScopeButton
            key={account.id}
            item={{
              id: account.id,
              name: account.name,
              path: `/accounts/${account.id}`,
            }}
            isCurrent={account.id === currentId}
            onSelect={onSelect}
          />
        ))}
      </nav>
    </section>
  );
}

function ScopeButton({
  item,
  isCurrent,
  onSelect,
}: {
  item: ScopeItem;
  isCurrent: boolean;
  onSelect: (path: string) => void;
}) {
  return (
    <button
      type="button"
      className={`${scopeButtonClass} ${isCurrent ? currentScopeClass : ''}`}
      aria-current={isCurrent ? 'page' : undefined}
      onClick={() => onSelect(item.path)}
    >
      <span>{item.name}</span>
      {isCurrent && <span aria-hidden="true">✓</span>}
    </button>
  );
}

const triggerLabelClass = css({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: nossoCaderninho.font.family,
  fontSize: 15,
  fontWeight: 650,
});

const backdropClass = css({
  position: 'fixed',
  inset: `0 0 ${MOBILE_NAV_HEIGHT}px`,
  zIndex: 109,
  padding: 0,
  backgroundColor: 'rgba(16, 41, 47, 0.2)',
  border: 0,
  '@media (min-width: 900px)': {
    inset: 0,
  },
});

const sheetClass = css({
  position: 'fixed',
  right: 0,
  bottom: MOBILE_NAV_HEIGHT,
  left: 0,
  width: 'auto',
  maxWidth: 'none',
  zIndex: 110,
  maxHeight: 'min(72vh, 620px)',
  margin: 0,
  padding: 0,
  color: nossoCaderninho.color.graphite,
  backgroundColor: nossoCaderninho.color.plate,
  border: 0,
  borderTop: `1px solid ${nossoCaderninho.color.rail}`,
  overflowY: 'auto',
  fontFamily: nossoCaderninho.font.family,
  '@media (min-width: 900px)': {
    right: nossoCaderninho.space.lg,
    bottom: nossoCaderninho.space.lg,
    left: 'auto',
    width: 420,
    border: `1px solid ${nossoCaderninho.color.rail}`,
    borderRadius: nossoCaderninho.radius.panel,
    boxShadow: '0 18px 48px rgba(16, 41, 47, 0.18)',
  },
});

const sheetHeaderClass = css({
  position: 'sticky',
  top: 0,
  zIndex: 1,
  minHeight: 62,
  padding: `${nossoCaderninho.space.sm}px ${nossoCaderninho.space.lg}px`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: nossoCaderninho.space.md,
  backgroundColor: nossoCaderninho.color.plate,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  '& > div': {
    minWidth: 0,
    display: 'grid',
    gap: 2,
  },
  '& strong': {
    fontSize: 16,
  },
  '& span': {
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 11,
  },
});

const scopeListClass = css({
  display: 'grid',
});

const scopeButtonClass = css({
  minWidth: 0,
  minHeight: 48,
  padding: `0 ${nossoCaderninho.space.lg}px`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: nossoCaderninho.space.sm,
  color: nossoCaderninho.color.graphite,
  backgroundColor: nossoCaderninho.color.plate,
  border: 0,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  font: `500 13px ${nossoCaderninho.font.family}`,
  textAlign: 'left',
  cursor: 'pointer',
  '& span:first-child': {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '&:hover': {
    backgroundColor: nossoCaderninho.color.signalSoft,
  },
  '&:focus-visible': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: -2,
  },
});

const currentScopeClass = css({
  color: nossoCaderninho.color.partnership,
  backgroundColor: nossoCaderninho.color.partnershipSoft,
  fontWeight: 650,
});

const accountGroupClass = css({
  '& h2': {
    margin: 0,
    padding: `${nossoCaderninho.space.lg}px ${nossoCaderninho.space.lg}px ${nossoCaderninho.space.sm}px`,
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 11,
    fontWeight: 600,
  },
});
