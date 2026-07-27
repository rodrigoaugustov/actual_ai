import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgChatBubbleDots } from '@actual-app/components/icons/v1';
import { css } from '@emotion/css';

import { nossoCaderninho } from '#style/nossoCaderninho';

type AdvisorEmptyStateProps = {
  onChoosePrompt: (prompt: string) => void;
};

export function AdvisorEmptyState({ onChoosePrompt }: AdvisorEmptyStateProps) {
  const { t } = useTranslation();
  const prompts = [
    t('How is our month going?'),
    t('Can we take on a new commitment?'),
    t('What has changed in recent months?'),
    t('Help us create a plan for…'),
  ];

  return (
    <section className={emptyClass}>
      <span className={markClass} aria-hidden>
        <SvgChatBubbleDots width={20} height={20} />
      </span>
      <div className={introClass}>
        <h2>
          <Trans>What should we look at together?</Trans>
        </h2>
        <p>
          <Trans>
            Ask about a decision, a concern or a goal for the household.
          </Trans>
        </p>
      </div>
      <div className={promptListClass} aria-label={t('Conversation starters')}>
        {prompts.map(prompt => (
          <Button
            key={prompt}
            variant="bare"
            className={promptClass}
            onPress={() => onChoosePrompt(prompt)}
          >
            <span>{prompt}</span>
            <span aria-hidden>→</span>
          </Button>
        ))}
      </div>
    </section>
  );
}

const emptyClass = css({
  width: 'min(680px, 100%)',
  margin: 'auto',
  padding: `${nossoCaderninho.space.xxl}px ${nossoCaderninho.space.xl}px`,
  display: 'grid',
  justifyItems: 'start',
  color: nossoCaderninho.color.graphite,
  fontFamily: nossoCaderninho.font.family,
  '@media (max-width: 729px)': {
    margin: 'auto 0',
    padding: `${nossoCaderninho.space.xl}px ${nossoCaderninho.space.lg}px`,
  },
});

const markClass = css({
  width: 38,
  height: 38,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: nossoCaderninho.color.plate,
  backgroundColor: nossoCaderninho.color.partnershipSurface,
  borderRadius: nossoCaderninho.radius.control,
});

const introClass = css({
  marginTop: nossoCaderninho.space.lg,
  '& h2': {
    maxWidth: '24ch',
    margin: 0,
    color: nossoCaderninho.color.graphite,
    fontSize: 24,
    fontWeight: 720,
    letterSpacing: '-0.025em',
    lineHeight: 1.15,
  },
  '& p': {
    maxWidth: '56ch',
    margin: `${nossoCaderninho.space.sm}px 0 0`,
    color: nossoCaderninho.color.graphiteSubdued,
    fontSize: 13,
    lineHeight: 1.5,
  },
});

const promptListClass = css({
  width: '100%',
  marginTop: nossoCaderninho.space.xl,
  display: 'grid',
  borderTop: `1px solid ${nossoCaderninho.color.rail}`,
});

const promptClass = css({
  width: '100%',
  minHeight: 48,
  padding: `0 ${nossoCaderninho.space.sm}px`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: nossoCaderninho.space.md,
  color: nossoCaderninho.color.graphite,
  borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  borderRadius: 0,
  fontSize: 13,
  fontWeight: 500,
  textAlign: 'left',
  '& span:first-child': {
    minWidth: 0,
  },
  '& span:last-child': {
    color: nossoCaderninho.color.partnership,
    fontSize: 16,
  },
  '&[data-hovered]': {
    backgroundColor: nossoCaderninho.color.signalSoft,
  },
  '&[data-focus-visible]': {
    outline: `2px solid ${nossoCaderninho.color.focusOnLight}`,
    outlineOffset: -2,
  },
});
