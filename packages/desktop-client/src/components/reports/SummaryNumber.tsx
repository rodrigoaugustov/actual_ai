import React, { useRef, useState } from 'react';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { debounce } from 'es-toolkit/compat';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFormat } from '#hooks/useFormat';
import { useMergedRefs } from '#hooks/useMergedRefs';
import { useResizeObserver } from '#hooks/useResizeObserver';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { ReportCardValueSkeleton } from './ReportCardValueSkeleton';

const FONT_SIZE_SCALE_FACTOR = 1.6;
const CONTAINER_MARGIN = 8;

type SummaryNumberProps = {
  value: number;
  contentType: string;
  animate?: boolean;
  suffix?: string;
  loading?: boolean;
  compact?: boolean;
  initialFontSize?: number;
  fontSizeChanged?: (fontSize: number) => void;
};

export function SummaryNumber({
  value,
  contentType,
  animate = false,
  suffix = '',
  loading = true,
  compact = false,
  initialFontSize = 14,
  fontSizeChanged,
}: SummaryNumberProps) {
  const { t } = useTranslation();
  const [fontSize, setFontSize] = useState<number>(initialFontSize);
  const [hasSized, setHasSized] = useState(false);
  const refDiv = useRef<HTMLOutputElement>(null);
  const format = useFormat();
  const isNumericValue = Number.isFinite(value);

  let displayAmount = isNumericValue
    ? contentType === 'percentage'
      ? format(Math.abs(value), 'number')
      : format(Math.abs(Math.round(value)), 'financial')
    : '—';

  if (isNumericValue) {
    displayAmount += suffix;
  }
  const accessibleLabel = !isNumericValue
    ? t('Unknown amount')
    : value === 0
      ? t('Zero amount')
      : value < 0
        ? t('Negative amount: {{amount}}', { amount: displayAmount })
        : t('Positive amount: {{amount}}', { amount: displayAmount });

  const handleResize = debounce(() => {
    if (!refDiv.current) return;

    const { clientWidth, clientHeight } = refDiv.current;
    const width = clientWidth; // no margin required on left and right
    const height = clientHeight - CONTAINER_MARGIN * 2; // account for margin top and bottom

    const calculatedFontSize = Math.min(
      (width * FONT_SIZE_SCALE_FACTOR) / displayAmount.toString().length,
      height, // Ensure the text fits vertically by using the height as the limiting factor
      32,
    );

    if (calculatedFontSize > 0) {
      setFontSize(calculatedFontSize);
      setHasSized(true);
    }

    if (calculatedFontSize !== initialFontSize && fontSizeChanged) {
      fontSizeChanged(calculatedFontSize);
    }
  }, 100);

  const ref = useResizeObserver<HTMLOutputElement>(handleResize);
  const mergedRef = useMergedRefs(ref, refDiv);

  return (
    <>
      {loading && <ReportCardValueSkeleton />}
      {!loading && (
        <output
          ref={mergedRef as Ref<HTMLOutputElement>}
          style={{
            display: 'flex',
            alignItems: 'center',
            flexGrow: 1,
            flexShrink: 1,
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            fontSize: compact ? 20 : fontSize,
            lineHeight: 1,
            margin: `${CONTAINER_MARGIN}px 0`,
            justifyContent: 'center',
            transition: animate ? 'font-size 0.3s ease' : '',
            color: !isNumericValue
              ? nossoCaderninho.color.graphiteSubdued
              : value === 0
                ? nossoCaderninho.color.graphiteSubdued
                : value < 0
                  ? nossoCaderninho.color.commitment
                  : nossoCaderninho.color.balance,
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 650,
          }}
        >
          <span style={visuallyHiddenStyle}>{accessibleLabel}</span>
          {!compact && !hasSized ? (
            <ReportCardValueSkeleton />
          ) : (
            <FinancialText aria-hidden="true">
              <PrivacyFilter>{displayAmount}</PrivacyFilter>
            </FinancialText>
          )}
        </output>
      )}
    </>
  );
}

const visuallyHiddenStyle = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;
