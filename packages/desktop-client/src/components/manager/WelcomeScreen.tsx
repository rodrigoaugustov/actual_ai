import { Trans } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgCheveronRight,
  SvgCloudDownload,
  SvgFileDouble,
  SvgUserGroup,
} from '@actual-app/components/icons/v1';
import { css } from '@emotion/css';

import { createBudget } from '#budgetfiles/budgetfilesSlice';
import { useServerURL } from '#components/ServerContext';
import { useNavigate } from '#hooks/useNavigate';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { ManagerSurface } from './ManagerSurface';

// impeccable:surface Entry is a connected two-plate composition: partnership
// promise on the left, mutually clear paths to first household value on the right.
export function WelcomeScreen() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const serverURL = useServerURL();

  function createNewBudget({ testMode = false } = {}) {
    void dispatch(createBudget({ testMode }));
  }

  return (
    <ManagerSurface
      chapter={<Trans>The finances of our home</Trans>}
      title={<Trans>Cared for together.</Trans>}
      description={
        <Trans>
          Continue from where you left off or start a new financial memory for
          the family.
        </Trans>
      }
    >
      <div className={stageHeadingClass}>
        <h2>
          <Trans>How do you want to start?</Trans>
        </h2>
        <p>
          <Trans>Reach your first household view in less than a minute.</Trans>
        </p>
      </div>

      <div className={primaryPathsClass}>
        <button
          type="button"
          className={pathClass}
          onClick={() => navigate('/config-server')}
        >
          <SvgUserGroup width={20} height={20} aria-hidden />
          <span className={pathCopyClass}>
            <strong>
              {serverURL ? (
                <Trans>Open our connected home</Trans>
              ) : (
                <Trans>Enter our home</Trans>
              )}
            </strong>
            <span>
              {serverURL ? (
                <Trans>Review the connection used by this device</Trans>
              ) : (
                <Trans>Connect and open a budget that is already shared</Trans>
              )}
            </span>
          </span>
          <SvgCheveronRight width={17} height={17} aria-hidden />
        </button>

        <button
          type="button"
          className={pathClass}
          onClick={() => createNewBudget()}
        >
          <SvgFileDouble width={20} height={20} aria-hidden />
          <span className={pathCopyClass}>
            <strong>
              <Trans>Start a new caderninho</Trans>
            </strong>
            <span>
              <Trans>Create the first budget on this device</Trans>
            </span>
          </span>
          <SvgCheveronRight width={17} height={17} aria-hidden />
        </button>
      </div>

      <div className={secondaryAreaClass}>
        <p>
          <Trans>Want to explore first or bring an existing budget?</Trans>
        </p>
        <div className={secondaryActionsClass}>
          <Button
            variant="bare"
            style={secondaryButtonStyle}
            onPress={() => createNewBudget({ testMode: true })}
          >
            <Trans>Try with an example</Trans>
          </Button>
          <Button
            variant="bare"
            style={secondaryButtonStyle}
            onPress={() => dispatch(pushModal({ modal: { name: 'import' } }))}
          >
            <SvgCloudDownload width={15} height={15} aria-hidden />
            <Trans>Import budget</Trans>
          </Button>
        </div>
      </div>

      <span className={connectionNoteClass}>
        <Trans>You can change the connection later in Home settings.</Trans>
      </span>
    </ManagerSurface>
  );
}

const stageHeadingClass = css({
  display: 'grid',
  gap: nossoCaderninho.space.sm,
  marginBottom: nossoCaderninho.space.xl,
  h2: {
    margin: 0,
    color: nossoCaderninho.color.graphite,
    fontSize: 20,
    fontWeight: 720,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  p: {
    margin: 0,
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 13,
    lineHeight: 1.45,
  },
});

const primaryPathsClass = css({
  display: 'grid',
  borderTop: `1px solid ${nossoCaderninho.color.railSoft}`,
});

const pathClass = css({
  display: 'grid',
  gridTemplateColumns: '20px minmax(0, 1fr) 17px',
  alignItems: 'center',
  gap: nossoCaderninho.space.md,
  width: '100%',
  padding: '16px 4px',
  color: nossoCaderninho.color.graphite,
  font: 'inherit',
  textAlign: 'left',
  background: 'transparent',
  border: 0,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  borderRadius: 0,
  cursor: 'pointer',
  transition: `background-color ${nossoCaderninho.motion.duration} ${nossoCaderninho.motion.easing}`,
  '&:hover': {
    backgroundColor: nossoCaderninho.color.signalSoft,
  },
  '&:focus-visible': {
    position: 'relative',
    zIndex: 1,
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: 2,
  },
  svg: {
    color: nossoCaderninho.color.partnership,
  },
  '@media (max-width: 720px)': {
    minHeight: 58,
    padding: '14px 4px',
  },
});

const pathCopyClass = css({
  display: 'grid',
  minWidth: 0,
  gap: 3,
  strong: {
    fontSize: 14,
    fontWeight: 650,
    lineHeight: 1.3,
  },
  span: {
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 12,
    lineHeight: 1.4,
  },
});

const secondaryAreaClass = css({
  display: 'grid',
  gap: nossoCaderninho.space.sm,
  marginTop: 'auto',
  paddingTop: nossoCaderninho.space.xl,
  p: {
    margin: 0,
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 12,
    lineHeight: 1.4,
  },
});

const secondaryActionsClass = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: nossoCaderninho.space.sm,
});

const secondaryButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 36,
  padding: '8px 12px',
  color: nossoCaderninho.color.partnership,
  backgroundColor: nossoCaderninho.color.partnershipSoft,
  borderRadius: nossoCaderninho.radius.control,
} as const;

const connectionNoteClass = css({
  marginTop: nossoCaderninho.space.lg,
  color: nossoCaderninho.color.graphiteSubdued,
  fontSize: 11,
  lineHeight: 1.4,
});
