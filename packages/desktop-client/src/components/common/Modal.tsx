/**
 * THESIS: uma decisão temporária vira uma placa focada, nunca uma tela genérica.
 * OWN-WORLD: esmalte frio, placa branca, trilho inferior e Azul Parceria.
 * STORY: a família reconhece o contexto, conclui uma tarefa e retorna ao trabalho.
 * FIRST VIEWPORT: Web centraliza até 560px; mobile assenta em largura total.
 * FORM: Composição A aprovada — Placa Focada, primeira opção do sistema transversal.
 */
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type {
  ComponentPropsWithoutRef,
  ComponentPropsWithRef,
  CSSProperties,
  ReactNode,
} from 'react';
import {
  Dialog,
  Modal as ReactAriaModal,
  ModalOverlay as ReactAriaModalOverlay,
} from 'react-aria-components';
import { ErrorBoundary } from 'react-error-boundary';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { SvgDelete } from '@actual-app/components/icons/v0';
import { Input } from '@actual-app/components/input';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { css } from '@emotion/css';
import { AutoTextSize } from 'auto-text-size';

import { FeatureErrorFallback } from '#components/FeatureErrorFallback';
import { useModalState } from '#hooks/useModalState';
import { nossoCaderninho } from '#style/nossoCaderninho';

export const MODAL_Z_INDEX = 3000;

const modalDialogClass = css(styles.lightScrollbar, {
  '--color-buttonPrimaryBackground': nossoCaderninho.color.partnership,
  '--color-buttonPrimaryBackgroundHover': nossoCaderninho.color.navHover,
  '--color-buttonPrimaryBorder': nossoCaderninho.color.partnership,
  '--color-buttonPrimaryDisabledBackground': nossoCaderninho.color.rail,
  '--color-buttonPrimaryDisabledBorder': nossoCaderninho.color.rail,
  '--color-formInputBackgroundSelection': nossoCaderninho.color.partnership,
  '--color-formInputBorderSelected': nossoCaderninho.color.partnership,
  '--color-formInputShadowSelected': 'rgba(38, 103, 122, 0.42)',
  '--color-formInputTextHighlight': nossoCaderninho.color.partnershipSoft,
  '--color-checkboxBackgroundSelected': nossoCaderninho.color.partnership,
  '--color-checkboxBorderSelected': nossoCaderninho.color.partnership,
  '--color-checkboxShadowSelected': 'rgba(38, 103, 122, 0.32)',
  '--color-checkboxToggleBackgroundSelected': nossoCaderninho.color.partnership,
});

type ModalHeadingContextValue = {
  titleId: string;
  setHasAccessibleTitle: (hasAccessibleTitle: boolean) => void;
};

const ModalHeadingContext = createContext<ModalHeadingContextValue | null>(
  null,
);

type ModalProps = ComponentPropsWithRef<typeof ReactAriaModal> & {
  name: string;
  isLoading?: boolean;
  noAnimation?: boolean;
  style?: CSSProperties;
  onClose?: () => void;
  wrapperProps?: {
    style?: CSSProperties;
  };
  containerProps?: {
    style?: CSSProperties;
  };
};

export const Modal = ({
  name,
  isLoading = false,
  noAnimation = false,
  style,
  children,
  onClose,
  wrapperProps,
  containerProps,
  ...props
}: ModalProps) => {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const { enableScope, disableScope } = useHotkeysContext();
  const modalTitleId = useId();
  const [hasAccessibleTitle, setHasAccessibleTitle] = useState(false);

  // This deactivates any key handlers in the "app" scope
  useEffect(() => {
    enableScope(name);
    return () => disableScope(name);
  }, [enableScope, disableScope, name]);

  const { isHidden, isActive, onClose: closeModal } = useModalState();

  const handleOnClose = () => {
    closeModal();
    onClose?.();
  };

  return (
    <ErrorBoundary FallbackComponent={FeatureErrorFallback}>
      <ReactAriaModalOverlay
        data-testid={`${name}-modal`}
        isDismissable
        defaultOpen
        onOpenChange={isOpen => !isOpen && handleOnClose?.()}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: MODAL_Z_INDEX,
          fontFamily: nossoCaderninho.font.family,
          fontSize: 13,
          backgroundColor: 'rgba(16, 41, 47, 0.34)',
          overscrollBehavior: 'contain',
          ...style,
        }}
        {...props}
      >
        {/* A container for positioning the modal relative to the visual viewport */}
        <View
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isNarrowWidth ? 'flex-end' : 'center',
            height: 'var(--visual-viewport-height)',
            boxSizing: 'border-box',
            overflowY: 'hidden',
            padding: isNarrowWidth ? 0 : nossoCaderninho.space.xl,
            ...wrapperProps?.style,
          }}
        >
          <ReactAriaModal>
            {modalProps => (
              <Dialog
                aria-label={hasAccessibleTitle ? undefined : t('Modal dialog')}
                aria-labelledby={hasAccessibleTitle ? modalTitleId : undefined}
                className={modalDialogClass}
                style={{
                  outline: 'none', // remove focus outline
                }}
              >
                <ModalHeadingContext.Provider
                  value={{
                    titleId: modalTitleId,
                    setHasAccessibleTitle,
                  }}
                >
                  <ModalContentContainer
                    noAnimation={noAnimation}
                    isActive={isActive(name)}
                    isNarrowWidth={isNarrowWidth}
                    isLoading={isLoading}
                    {...containerProps}
                    style={{
                      flex: 1,
                      position: 'relative',
                      width: 560,
                      padding: `${nossoCaderninho.space.md}px ${nossoCaderninho.space.lg}px ${nossoCaderninho.space.lg}px`,
                      willChange: 'opacity, transform',
                      maxWidth: 'calc(100vw - 48px)',
                      minWidth: 0,
                      maxHeight: 'calc(var(--visual-viewport-height) - 48px)',
                      minHeight: 0,
                      borderRadius: nossoCaderninho.radius.panel,
                      color: theme.pageText,
                      backgroundColor: theme.modalBackground,
                      opacity: isHidden ? 0 : 1,
                      overflow: 'hidden',
                      overscrollBehavior: 'contain',
                      boxShadow:
                        '0 24px 60px rgba(16, 41, 47, 0.22), 0 8px 20px rgba(16, 41, 47, 0.14)',
                      ...containerProps?.style,
                      ...(isNarrowWidth && {
                        width: '100%',
                        maxWidth: '100vw',
                        minWidth: 0,
                        maxHeight:
                          'calc(var(--visual-viewport-height) - env(safe-area-inset-top) - 8px)',
                        padding: `${nossoCaderninho.space.sm}px ${nossoCaderninho.space.lg}px calc(${nossoCaderninho.space.lg}px + env(safe-area-inset-bottom))`,
                        borderRadius: `${nossoCaderninho.radius.panel}px ${nossoCaderninho.radius.panel}px 0 0`,
                        boxShadow: '0 -12px 32px rgba(16, 41, 47, 0.2)',
                      }),
                    }}
                  >
                    {isNarrowWidth && (
                      <View
                        aria-hidden
                        style={{
                          width: 36,
                          height: 4,
                          flexShrink: 0,
                          alignSelf: 'center',
                          marginBottom: nossoCaderninho.space.sm,
                          borderRadius: nossoCaderninho.radius.status,
                          backgroundColor: theme.pageTextSubdued,
                          opacity: 0.42,
                        }}
                      />
                    )}
                    <View
                      inert={isLoading}
                      style={{
                        paddingTop: 0,
                        flex: 1,
                        flexShrink: 1,
                        minHeight: 0,
                        overflowY: 'auto',
                        overscrollBehavior: 'contain',
                      }}
                    >
                      <ErrorBoundary FallbackComponent={FeatureErrorFallback}>
                        {typeof children === 'function'
                          ? children(modalProps)
                          : children}
                      </ErrorBoundary>
                    </View>
                    {isLoading && (
                      <output
                        aria-label={t('Loading')}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 'inherit',
                          backgroundColor: theme.modalBackground,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 1000,
                        }}
                      >
                        <AnimatedLoading
                          style={{ width: 20, height: 20 }}
                          color={theme.pageText}
                        />
                      </output>
                    )}
                  </ModalContentContainer>
                </ModalHeadingContext.Provider>
              </Dialog>
            )}
          </ReactAriaModal>
        </View>
      </ReactAriaModalOverlay>
    </ErrorBoundary>
  );
};

type ModalContentContainerProps = {
  style?: CSSProperties;
  noAnimation?: boolean;
  isActive?: boolean;
  isNarrowWidth?: boolean;
  isLoading?: boolean;
  children: ReactNode;
};

const ModalContentContainer = ({
  style,
  noAnimation,
  isActive,
  isNarrowWidth,
  isLoading,
  children,
}: ModalContentContainerProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useLayoutEffect(() => {
    if (!contentRef.current) {
      return;
    }

    function setProps() {
      if (!contentRef.current) {
        return;
      }

      if (isActive) {
        contentRef.current.style.transform = 'none';
        contentRef.current.style.willChange = 'auto';
        contentRef.current.style.pointerEvents = 'auto';
      } else {
        contentRef.current.style.transform = isNarrowWidth
          ? 'translateY(24px) scale(.985)'
          : 'translateY(-12px) scale(.985)';
        contentRef.current.style.pointerEvents = 'none';
      }
    }

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const transition = prefersReducedMotion
      ? 'none'
      : `opacity ${nossoCaderninho.motion.duration}, transform ${nossoCaderninho.motion.duration} ${nossoCaderninho.motion.easing}`;

    if (!mounted.current) {
      if (noAnimation) {
        contentRef.current.style.opacity = '1';
        contentRef.current.style.transform = 'translateY(0px) scale(1)';

        setTimeout(() => {
          if (contentRef.current) {
            contentRef.current.style.transition = transition;
          }
        }, 0);
      } else {
        contentRef.current.style.opacity = '0';
        contentRef.current.style.transform = isNarrowWidth
          ? 'translateY(24px)'
          : 'translateY(8px) scale(.985)';

        setTimeout(() => {
          if (contentRef.current) {
            mounted.current = true;
            contentRef.current.style.transition = transition;
            contentRef.current.style.opacity = '1';
            setProps();
          }
        }, 0);
      }
    } else {
      setProps();
    }
  }, [noAnimation, isActive, isNarrowWidth]);

  return (
    <View
      innerRef={contentRef}
      aria-busy={isLoading}
      style={{
        ...style,
        ...(noAnimation && !isActive && { display: 'none' }),
      }}
    >
      {children}
    </View>
  );
};

type ModalButtonsProps = {
  style?: CSSProperties;
  leftContent?: ReactNode;
  focusButton?: boolean;
  children: ReactNode;
};

export const ModalButtons = ({
  style,
  leftContent,
  focusButton = false,
  children,
}: ModalButtonsProps) => {
  const { isNarrowWidth } = useResponsive();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusButton && containerRef.current) {
      const button = containerRef.current.querySelector<HTMLButtonElement>(
        'button:not([data-hidden])',
      );

      if (button) {
        button.focus();
      }
    }
  }, [focusButton]);

  return (
    <View
      innerRef={containerRef}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: nossoCaderninho.space.sm,
        position: 'sticky',
        bottom: isNarrowWidth
          ? `calc(-${nossoCaderninho.space.lg}px - env(safe-area-inset-bottom))`
          : -nossoCaderninho.space.lg,
        zIndex: 1,
        margin: `${nossoCaderninho.space.xl}px -${nossoCaderninho.space.lg}px -${nossoCaderninho.space.lg}px`,
        padding: isNarrowWidth
          ? `${nossoCaderninho.space.md}px ${nossoCaderninho.space.lg}px calc(${nossoCaderninho.space.md}px + env(safe-area-inset-bottom))`
          : `${nossoCaderninho.space.md}px ${nossoCaderninho.space.lg}px`,
        borderTop: `1px solid ${theme.tableBorder}`,
        backgroundColor: theme.modalBackground,
        ...style,
      }}
    >
      {leftContent}
      <View style={{ flex: 1 }} />
      {children}
    </View>
  );
};

type ModalHeaderProps = {
  leftContent?: ReactNode;
  showLogo?: boolean;
  title?: ReactNode;
  rightContent?: ReactNode;
};

export function ModalHeader({
  leftContent,
  showLogo,
  title,
  rightContent,
}: ModalHeaderProps) {
  const headingContext = useContext(ModalHeadingContext);
  const hasHeading = Boolean(title || showLogo);
  const setHasAccessibleTitle = headingContext?.setHasAccessibleTitle;

  useEffect(() => {
    if (!hasHeading || !setHasAccessibleTitle) {
      return;
    }

    setHasAccessibleTitle(true);
    return () => setHasAccessibleTitle(false);
  }, [hasHeading, setHasAccessibleTitle]);

  return (
    <View
      style={{
        position: 'relative',
        minHeight: 56,
        flex: 'none',
        justifyContent: 'center',
        padding: leftContent ? '8px 40px 12px' : '8px 40px 12px 0',
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
        }}
      >
        {leftContent}
      </View>

      {(title || showLogo) && (
        <h1
          id={headingContext?.titleId}
          style={{
            display: 'flex',
            width: '100%',
            minWidth: 0,
            margin: 0,
            textAlign: 'left',
          }}
        >
          <View
            style={{
              width: '100%',
              minWidth: 0,
              textAlign: 'left',
              alignItems: 'flex-start',
            }}
          >
            {showLogo && (
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: 650,
                  color: nossoCaderninho.color.partnership,
                }}
              >
                <Trans>Nosso Caderninho</Trans>
              </Text>
            )}
            {title &&
              (typeof title === 'string' || typeof title === 'number' ? (
                <ModalTitle title={`${title}`} />
              ) : (
                title
              ))}
          </View>
        </h1>
      )}

      {rightContent && (
        <View
          style={{
            position: 'absolute',
            top: 6,
            right: -4,
          }}
        >
          {rightContent}
        </View>
      )}
    </View>
  );
}

type ModalTitleProps = {
  title: string;
  isEditable?: boolean;
  getStyle?: (isEditing: boolean) => CSSProperties;
  onEdit?: (isEditing: boolean) => void;
  onTitleUpdate?: (newName: string) => void;
  shrinkOnOverflow?: boolean;
};

export function ModalTitle({
  title,
  isEditable,
  getStyle,
  onTitleUpdate,
  shrinkOnOverflow = false,
}: ModalTitleProps) {
  const [isEditing, setIsEditing] = useState(false);

  const onTitleClick = () => {
    if (isEditable) {
      setIsEditing(true);
    }
  };

  const _onTitleUpdate = (newTitle: string) => {
    if (newTitle !== title) {
      onTitleUpdate?.(newTitle);
    }
    setIsEditing(false);
  };

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isEditing) {
      if (inputRef.current) {
        inputRef.current.scrollLeft = 0;
      }
    }
  }, [isEditing]);

  const style = getStyle?.(isEditing);

  return isEditing ? (
    <Input
      ref={inputRef}
      style={{
        fontSize: 20,
        fontWeight: 720,
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
        textAlign: 'left',
        ...style,
      }}
      defaultValue={title}
      onUpdate={_onTitleUpdate}
      onEnter={(value, e) => {
        e.preventDefault();
        _onTitleUpdate?.(value);
      }}
    />
  ) : (
    <View
      style={{
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'flex-start',
        alignItems: 'center',
      }}
    >
      {shrinkOnOverflow ? (
        <AutoTextSize
          as={Text}
          minFontSizePx={15}
          maxFontSizePx={20}
          onClick={onTitleClick}
          style={{
            fontSize: 20,
            fontWeight: 720,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            textAlign: 'left',
            ...(isEditable && styles.underlinedText),
            ...style,
          }}
        >
          {title}
        </AutoTextSize>
      ) : (
        <TextOneLine
          onClick={onTitleClick}
          style={{
            fontSize: 20,
            fontWeight: 720,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            textAlign: 'left',
            ...(isEditable && styles.underlinedText),
            ...style,
          }}
        >
          {title}
        </TextOneLine>
      )}
    </View>
  );
}

type ModalCloseButtonProps = {
  onPress: ComponentPropsWithoutRef<typeof Button>['onPress'];
  style?: CSSProperties;
};

export function ModalCloseButton({ onPress, style }: ModalCloseButtonProps) {
  const { t } = useTranslation();
  return (
    <Button
      variant="bare"
      onPress={onPress}
      style={{
        width: 36,
        height: 36,
        padding: 10,
        borderRadius: nossoCaderninho.radius.control,
      }}
      aria-label={t('Close')}
    >
      <SvgDelete
        width={14}
        style={{ color: theme.pageTextSubdued, ...style }}
      />
    </Button>
  );
}
