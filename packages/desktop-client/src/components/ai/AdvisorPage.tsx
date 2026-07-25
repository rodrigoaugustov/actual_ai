import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { SvgCheveronRight } from '@actual-app/components/icons/v1';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { listen, send } from '@actual-app/core/platform/client/connection';
import type {
  AiAdviceRecordEntity,
  AiConversationEntity,
  AiDocumentEntity,
  AiGoalEntity,
  AiMemoryFactEntity,
  AiTracePart,
} from '@actual-app/core/types/models';
import type { AiAdvisorEvent } from '@actual-app/core/types/server-events';
import { css } from '@emotion/css';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format as formatDate } from 'date-fns';

import { FloatingActionBar } from '#components/mobile/FloatingActionBar';
import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { TapField } from '#components/mobile/MobileForms';
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { MobilePageHeader, Page } from '#components/Page';
import { useDateFormat } from '#hooks/useDateFormat';
import { useUrlParam } from '#hooks/useUrlParam';
import { pushModal } from '#modals/modalsSlice';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';

import { AdvisorMessage } from './AdvisorMessage';
import { toolLabel } from './AdvisorTrace';
import {
  adviceStatusLabel,
  documentKindLabel,
  goalStatusLabel,
  memoryKindLabel,
} from './labels';

type Tab = 'conversation' | 'profile' | 'goals' | 'documents' | 'plan';
const TAB_VALUES: readonly Tab[] = [
  'conversation',
  'profile',
  'goals',
  'documents',
  'plan',
];

function isTab(value: string | null): value is Tab {
  return value != null && TAB_VALUES.includes(value as Tab);
}

const panel = {
  border: `1px solid ${theme.pillBorderDark}`,
  borderRadius: 6,
  padding: 12,
  gap: 8,
};

function AdvisorTabButton({
  value,
  label,
  isSelected,
  isMobile = false,
  onSelect,
}: {
  value: Tab;
  label: string;
  isSelected: boolean;
  isMobile?: boolean;
  onSelect: (value: Tab) => void;
}) {
  return (
    <button
      id={`advisor-tab-${value}`}
      type="button"
      role="tab"
      aria-selected={isSelected}
      aria-controls={`advisor-panel-${value}`}
      className={css({
        minHeight: isMobile ? 40 : 32,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5px 10px',
        borderRadius: 4,
        border: `1px solid ${
          isSelected ? theme.buttonPrimaryBorder : theme.buttonNormalBorder
        }`,
        color: isSelected ? theme.buttonPrimaryText : theme.buttonNormalText,
        backgroundColor: isSelected
          ? theme.buttonPrimaryBackground
          : theme.buttonNormalBackground,
        cursor: 'pointer',
        font: 'inherit',
        whiteSpace: 'nowrap',
        ':hover': {
          color: isSelected
            ? theme.buttonPrimaryTextHover
            : theme.buttonNormalTextHover,
          backgroundColor: isSelected
            ? theme.buttonPrimaryBackgroundHover
            : theme.buttonNormalBackgroundHover,
        },
        ':focus-visible': {
          outline: `2px solid ${theme.pageTextLink}`,
          outlineOffset: 2,
        },
      })}
      onClick={() => onSelect(value)}
    >
      {label}
    </button>
  );
}

function useAdvisorMutation() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const pendingRef = useRef(false);
  const [isPending, setIsPending] = useState(false);

  const run = async (
    action: () => Promise<void>,
    onError?: () => void,
  ): Promise<void> => {
    if (pendingRef.current) {
      return;
    }

    pendingRef.current = true;
    setIsPending(true);
    try {
      await action();
    } catch {
      onError?.();
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t(
              'Could not complete this advisor action. Check your connection and try again.',
            ),
          },
        }),
      );
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  };

  return { isPending, run };
}

function LoadingIndicator() {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 0',
      }}
    >
      <AnimatedLoading width={20} color={theme.pageTextSubdued} />
    </View>
  );
}

function LoadingError() {
  return (
    <Text style={{ color: theme.errorText }}>
      <Trans>
        Could not load this advisor data. Check your connection and try again.
      </Trans>
    </Text>
  );
}

function Profile({
  memories,
  refresh,
  isLoading,
  isError,
}: {
  memories: AiMemoryFactEntity[];
  refresh: () => void;
  isLoading: boolean;
  isError: boolean;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState('');
  const [value, setValue] = useState('');
  const [isSensitive, setIsSensitive] = useState(false);
  const dispatch = useDispatch();
  const mutation = useAdvisorMutation();
  const candidates = memories.filter(item => item.status === 'candidate');
  const confirmed = memories.filter(item => item.status === 'confirmed');
  const resolve = async (id: string, action: 'confirm' | 'reject') => {
    await mutation.run(async () => {
      await send('ai/advisor/resolve-memory', { id, action });
      refresh();
    });
  };
  const add = async () => {
    if (!kind.trim() || !value.trim()) return;
    await mutation.run(async () => {
      await send('ai/advisor/create-memory', {
        kind: kind.trim(),
        value: value.trim(),
        originalText: value.trim(),
        sensitivity: isSensitive ? 'sensitive' : 'normal',
      });
      setKind('');
      setValue('');
      setIsSensitive(false);
      refresh();
    });
  };
  const remove = async (id: string) => {
    await mutation.run(async () => {
      await send('ai/advisor/delete-memory', { id });
      refresh();
    });
  };
  const confirmRemove = (id: string) => {
    dispatch(
      pushModal({
        modal: {
          name: 'confirm-delete',
          options: {
            message: t('Delete this memory from your advisor profile?'),
            onConfirm: () => {
              void remove(id);
            },
          },
        },
      }),
    );
  };
  return (
    <View style={{ gap: 16 }}>
      <View style={panel}>
        <Text style={{ fontWeight: 600 }}>
          <Trans>Pending confirmations</Trans>
        </Text>
        <Text style={{ color: theme.pageTextSubdued }}>
          <Trans>
            The advisor never turns a personal inference into memory without
            your confirmation.
          </Trans>
        </Text>
        {isLoading ? (
          <LoadingIndicator />
        ) : isError ? (
          <LoadingError />
        ) : (
          <>
            {candidates.length === 0 && (
              <Text>
                <Trans>No pending memories.</Trans>
              </Text>
            )}
            {candidates.map(item => (
              <View key={item.id} style={panel}>
                <Text style={{ fontWeight: 600 }}>
                  {memoryKindLabel(item.kind, t)}
                </Text>
                {item.sensitivity === 'sensitive' && (
                  <Text style={{ color: theme.pageTextSubdued }}>
                    <Trans>
                      Sensitive — excluded from AI prompts by default
                    </Trans>
                  </Text>
                )}
                <Text>
                  {typeof item.value === 'string'
                    ? item.value
                    : JSON.stringify(item.value)}
                </Text>
                {item.originalText && <Text>"{item.originalText}"</Text>}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button
                    variant="primary"
                    isDisabled={mutation.isPending}
                    onPress={() => resolve(item.id, 'confirm')}
                  >
                    <Trans>Confirm</Trans>
                  </Button>
                  <Button
                    isDisabled={mutation.isPending}
                    onPress={() => resolve(item.id, 'reject')}
                  >
                    <Trans>Reject</Trans>
                  </Button>
                </View>
              </View>
            ))}
          </>
        )}
      </View>
      <View style={panel}>
        <Text style={{ fontWeight: 600 }}>
          <Trans>Add a profile fact</Trans>
        </Text>
        <Input
          value={kind}
          onChangeValue={setKind}
          placeholder={t('Type (for example: life stage)')}
        />
        <label
          className={css({ display: 'flex', gap: 8, alignItems: 'center' })}
        >
          <input
            type="checkbox"
            checked={isSensitive}
            onChange={event => setIsSensitive(event.target.checked)}
          />
          <Trans>Mark as sensitive</Trans>
        </label>
        <Input
          value={value}
          onChangeValue={setValue}
          placeholder={t('What should the advisor remember?')}
        />
        <Button variant="primary" isDisabled={mutation.isPending} onPress={add}>
          <Trans>Add for confirmation</Trans>
        </Button>
      </View>
      <View style={panel}>
        <Text style={{ fontWeight: 600 }}>
          <Trans>Confirmed profile</Trans>
        </Text>
        {isLoading ? (
          <LoadingIndicator />
        ) : isError ? (
          <LoadingError />
        ) : (
          confirmed.map(item => (
            <View key={item.id} style={{ padding: 8 }}>
              <Text style={{ fontWeight: 600 }}>
                {memoryKindLabel(item.kind, t)}
              </Text>
              {item.sensitivity === 'sensitive' && (
                <Text style={{ color: theme.pageTextSubdued }}>
                  <Trans>Sensitive — excluded from AI prompts by default</Trans>
                </Text>
              )}
              <Text>
                {typeof item.value === 'string'
                  ? item.value
                  : JSON.stringify(item.value)}
              </Text>
              <Button
                variant="bare"
                style={{ color: theme.errorTextMenu }}
                isDisabled={mutation.isPending}
                onPress={() => confirmRemove(item.id)}
              >
                <Trans>Delete</Trans>
              </Button>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function Goals({
  goals,
  refresh,
  isLoading,
  isError,
}: {
  goals: AiGoalEntity[];
  refresh: () => void;
  isLoading: boolean;
  isError: boolean;
}) {
  const { t } = useTranslation();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const dispatch = useDispatch();
  const mutation = useAdvisorMutation();
  const add = async () => {
    if (!title.trim() || !description.trim()) return;
    await mutation.run(async () => {
      await send('ai/advisor/create-goal', {
        title: title.trim(),
        description: description.trim(),
      });
      setTitle('');
      setDescription('');
      refresh();
    });
  };
  const remove = async (id: string) => {
    await mutation.run(async () => {
      await send('ai/advisor/delete-goal', { id });
      refresh();
    });
  };
  const confirmRemove = (goal: AiGoalEntity) => {
    dispatch(
      pushModal({
        modal: {
          name: 'confirm-delete',
          options: {
            message: t('Delete the goal "{{title}}"?', {
              title: goal.title,
            }),
            onConfirm: () => {
              void remove(goal.id);
            },
          },
        },
      }),
    );
  };
  return (
    <View style={{ gap: 12 }}>
      <View style={panel}>
        <Text style={{ fontWeight: 600 }}>
          <Trans>New goal</Trans>
        </Text>
        <Input value={title} onChangeValue={setTitle} placeholder={t('Goal')} />
        <Input
          value={description}
          onChangeValue={setDescription}
          placeholder={t('Desired outcome, deadline and constraints')}
        />
        <Button variant="primary" isDisabled={mutation.isPending} onPress={add}>
          <Trans>Add goal</Trans>
        </Button>
      </View>
      {isLoading ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError />
      ) : (
        goals.map(goal => (
          <View key={goal.id} style={panel}>
            <Text style={{ fontWeight: 600 }}>{goal.title}</Text>
            <Text>{goal.description}</Text>
            <Text style={{ color: theme.pageTextSubdued }}>
              {t('Priority {{priority}} · {{status}}', {
                priority: goal.priority,
                status: goalStatusLabel(goal.status, t),
              })}
            </Text>
            {goal.nextReviewAt != null && (
              <Text style={{ color: theme.pageTextSubdued }}>
                {t('Next review: {{date}}', {
                  date: formatDate(new Date(goal.nextReviewAt), dateFormat),
                })}
              </Text>
            )}
            <Button
              variant="bare"
              style={{ color: theme.errorTextMenu }}
              isDisabled={mutation.isPending}
              onPress={() => confirmRemove(goal)}
            >
              <Trans>Delete</Trans>
            </Button>
          </View>
        ))
      )}
    </View>
  );
}

function DocumentRow({
  document,
  isMutationPending,
  onDelete,
}: {
  document: AiDocumentEntity;
  isMutationPending: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const isTruncated = document.content.length > 300;
  const displayedContent =
    isTruncated && !isExpanded
      ? `${document.content.slice(0, 300).trimEnd()}…`
      : document.content;

  return (
    <View style={panel}>
      <Text style={{ fontWeight: 600 }}>{document.title}</Text>
      <Text style={{ color: theme.pageTextSubdued }}>
        {documentKindLabel(document.kind, t)}
      </Text>
      <Text>{displayedContent}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {isTruncated && (
          <Button
            variant="bare"
            aria-expanded={isExpanded}
            onPress={() => setIsExpanded(value => !value)}
          >
            {isExpanded ? <Trans>View less</Trans> : <Trans>View more</Trans>}
          </Button>
        )}
        <Button
          variant="bare"
          style={{ color: theme.errorTextMenu }}
          isDisabled={isMutationPending}
          onPress={onDelete}
        >
          <Trans>Delete</Trans>
        </Button>
      </View>
    </View>
  );
}

function Documents({
  documents,
  refresh,
  isLoading,
  isError,
}: {
  documents: AiDocumentEntity[];
  refresh: () => void;
  isLoading: boolean;
  isError: boolean;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const dispatch = useDispatch();
  const mutation = useAdvisorMutation();
  const add = async () => {
    if (!title.trim() || !content.trim()) return;
    await mutation.run(async () => {
      await send('ai/advisor/create-document', {
        title: title.trim(),
        kind: 'user-note',
        content: content.trim(),
      });
      setTitle('');
      setContent('');
      refresh();
    });
  };
  const remove = async (id: string) => {
    await mutation.run(async () => {
      await send('ai/advisor/delete-document', { id });
      refresh();
    });
  };
  const confirmRemove = (document: AiDocumentEntity) => {
    dispatch(
      pushModal({
        modal: {
          name: 'confirm-delete',
          options: {
            message: t('Delete the document "{{title}}"?', {
              title: document.title,
            }),
            onConfirm: () => {
              void remove(document.id);
            },
          },
        },
      }),
    );
  };
  return (
    <View style={{ gap: 12 }}>
      <View style={panel}>
        <Text style={{ fontWeight: 600 }}>
          <Trans>Add context document</Trans>
        </Text>
        <Input
          value={title}
          onChangeValue={setTitle}
          placeholder={t('Title')}
        />
        <textarea
          className={css({
            minHeight: 130,
            resize: 'vertical',
            padding: 8,
            color: theme.pageText,
            backgroundColor: theme.tableBackground,
            border: `1px solid ${theme.buttonNormalBorder}`,
          })}
          value={content}
          onChange={event => setContent(event.target.value)}
          placeholder={t(
            'Paste a policy, benefit description or planning note.',
          )}
        />
        <Button variant="primary" isDisabled={mutation.isPending} onPress={add}>
          <Trans>Save document</Trans>
        </Button>
      </View>
      {isLoading ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError />
      ) : (
        documents.map(document => (
          <DocumentRow
            key={document.id}
            document={document}
            isMutationPending={mutation.isPending}
            onDelete={() => confirmRemove(document)}
          />
        ))
      )}
    </View>
  );
}

function Plan({
  advice,
  refresh,
  isLoading,
  isError,
  isMobile = false,
}: {
  advice: AiAdviceRecordEntity[];
  refresh: () => void;
  isLoading: boolean;
  isError: boolean;
  isMobile?: boolean;
}) {
  const { t } = useTranslation();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const mutation = useAdvisorMutation();
  const update = async (
    id: string,
    status: 'accepted' | 'rejected' | 'completed',
  ) => {
    await mutation.run(async () => {
      await send('ai/advisor/update-advice', { id, status });
      refresh();
    });
  };
  return (
    <View style={{ gap: 12 }}>
      {isLoading ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError />
      ) : (
        <>
          {advice.length === 0 && (
            <Text>
              <Trans>
                Recommendations proposed in conversations appear here.
              </Trans>
            </Text>
          )}
          {advice.map(item => (
            <View
              key={item.id}
              style={{ ...panel, width: '100%', flexShrink: 0 }}
            >
              <Text
                style={{
                  fontWeight: 600,
                  lineHeight: 1.4,
                  overflowWrap: 'anywhere',
                }}
              >
                {item.title}
              </Text>
              <Text style={{ lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                {item.recommendation}
              </Text>
              <Text style={{ color: theme.pageTextSubdued }}>
                {adviceStatusLabel(item.status, t)}
              </Text>
              {item.followUpAt != null && (
                <Text style={{ color: theme.pageTextSubdued }}>
                  {t('Follow-up: {{date}}', {
                    date: formatDate(new Date(item.followUpAt), dateFormat),
                  })}
                </Text>
              )}
              <AdviceDetailList
                label={t('Assumptions')}
                items={item.assumptions}
              />
              <AdviceDetailList
                label={t('Alternatives')}
                items={item.alternatives}
              />
              <AdviceDetailList label={t('Risks')} items={item.risks} />
              <AdviceDetailList
                label={t('Evidence')}
                items={item.evidence.flatMap(part => {
                  switch (part.type) {
                    case 'source':
                      return [
                        part.excerpt
                          ? `${part.title} — ${part.excerpt}`
                          : part.title,
                      ];
                    case 'text':
                      return [part.text];
                    case 'tool':
                      return [toolLabel(part.toolName, t)];
                    case 'trace':
                      return [];
                    default: {
                      const exhaustive: never = part;
                      return exhaustive;
                    }
                  }
                })}
              />
              {item.status === 'proposed' && (
                <View
                  style={{
                    flexDirection: isMobile ? 'column' : 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <Button
                    style={
                      isMobile ? { width: '100%', minHeight: 40 } : undefined
                    }
                    variant="primary"
                    isDisabled={mutation.isPending}
                    onPress={() => update(item.id, 'accepted')}
                  >
                    <Trans>Accept plan</Trans>
                  </Button>
                  <Button
                    style={
                      isMobile ? { width: '100%', minHeight: 40 } : undefined
                    }
                    isDisabled={mutation.isPending}
                    onPress={() => update(item.id, 'rejected')}
                  >
                    <Trans>Reject</Trans>
                  </Button>
                </View>
              )}
              {item.status === 'accepted' && (
                <Button
                  style={
                    isMobile ? { width: '100%', minHeight: 40 } : undefined
                  }
                  isDisabled={mutation.isPending}
                  onPress={() => update(item.id, 'completed')}
                >
                  <Trans>Mark completed</Trans>
                </Button>
              )}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function AdviceDetailList({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: 3 }}>
      <Text style={{ fontWeight: 600 }}>{label}</Text>
      <View role="list" style={{ gap: 4 }}>
        {items.map((item, index) => (
          <View
            key={`${index}-${item}`}
            role="listitem"
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 7,
            }}
          >
            <Text aria-hidden="true" style={{ flexShrink: 0, lineHeight: 1.4 }}>
              •
            </Text>
            <Text
              style={{
                flex: 1,
                minWidth: 0,
                lineHeight: 1.4,
                overflowWrap: 'anywhere',
              }}
            >
              {item}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

type AdvisorPageProps = {
  isMobile?: boolean;
};

export function AdvisorPage({ isMobile = false }: AdvisorPageProps = {}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const client = useQueryClient();
  const conversationMutation = useAdvisorMutation();
  const submitMutation = useAdvisorMutation();
  const cancelMutation = useAdvisorMutation();
  const [sectionParam, setSectionParam] = useUrlParam('section');
  const [conversationId, setConversationParam] = useUrlParam('conversation');
  const tab = isTab(sectionParam) ? sectionParam : 'conversation';
  const setTab = (value: Tab) => {
    setSectionParam(value === 'conversation' ? null : value);
  };
  const setConversationId = (value: string | null) => {
    setConversationParam(value);
  };
  const [draft, setDraft] = useState('');
  const [streamed, setStreamed] = useState('');
  const [liveTrace, setLiveTrace] = useState<AiTracePart[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isCreatingInitial, setIsCreatingInitial] = useState(false);
  const [isMobileConversationList, setIsMobileConversationList] =
    useState(false);
  const createdInitial = useRef(false);
  const runFailed = useRef(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const conversations = useQuery({
    queryKey: ['advisor-conversations'],
    queryFn: () => send('ai/advisor/list-conversations'),
  });
  const messages = useQuery({
    queryKey: ['advisor-messages', conversationId],
    queryFn: () =>
      send('ai/advisor/list-messages', {
        conversationId: conversationId as string,
      }),
    enabled: conversationId != null,
  });
  const memory = useQuery({
    queryKey: ['advisor-memory'],
    queryFn: () => send('ai/advisor/list-memory', {}),
  });
  const goals = useQuery({
    queryKey: ['advisor-goals'],
    queryFn: () => send('ai/advisor/list-goals'),
  });
  const documents = useQuery({
    queryKey: ['advisor-documents'],
    queryFn: () => send('ai/advisor/list-documents'),
  });
  const advice = useQuery({
    queryKey: ['advisor-advice'],
    queryFn: () => send('ai/advisor/list-advice'),
  });

  useEffect(() => {
    if (!conversations.isSuccess) {
      return;
    }

    const isValidConversation = conversations.data.some(
      item => item.id === conversationId,
    );
    if (!isValidConversation) {
      setConversationParam(conversations.data[0]?.id ?? null, {
        replace: true,
      });
    }
  }, [
    conversationId,
    conversations.data,
    conversations.isSuccess,
    setConversationParam,
  ]);
  useEffect(() => {
    if (
      conversations.isSuccess &&
      conversations.data?.length === 0 &&
      !createdInitial.current
    ) {
      createdInitial.current = true;
      setIsCreatingInitial(true);
      void (async () => {
        try {
          const item = await send('ai/advisor/create-conversation', {});
          setConversationParam(item.id, { replace: true });
          await client.invalidateQueries({
            queryKey: ['advisor-conversations'],
          });
        } catch {
          dispatch(
            addNotification({
              notification: {
                type: 'error',
                message: t(
                  'Could not complete this advisor action. Check your connection and try again.',
                ),
              },
            }),
          );
        } finally {
          createdInitial.current = false;
          setIsCreatingInitial(false);
        }
      })();
    }
  }, [
    client,
    conversations.data?.length,
    conversations.isSuccess,
    dispatch,
    setConversationParam,
    t,
  ]);
  useEffect(
    () =>
      listen('ai-advisor-event', (event: AiAdvisorEvent) => {
        if (event.conversationId !== conversationId) return;
        if (event.type === 'text-delta') {
          setStreamed(value => value + event.text);
        } else if (event.type === 'started') {
          runFailed.current = false;
          setRunId(event.runId);
          setStreamed('');
          setLiveTrace([]);
          setError('');
        } else if (event.type === 'trace') {
          setLiveTrace(value => {
            const existingIndex = value.findIndex(
              item => item.id === event.trace.id,
            );
            if (existingIndex === -1) {
              return [...value, event.trace];
            }
            return value.map((item, index) =>
              index === existingIndex ? event.trace : item,
            );
          });
        } else if (event.type === 'completed') {
          setRunId(null);
          void Promise.all([
            client.invalidateQueries({ queryKey: ['advisor-messages'] }),
            client.invalidateQueries({ queryKey: ['advisor-conversations'] }),
            client.invalidateQueries({ queryKey: ['advisor-memory'] }),
            client.invalidateQueries({ queryKey: ['advisor-advice'] }),
          ]).finally(() => {
            setStreamed('');
            setLiveTrace([]);
          });
        } else if (event.type === 'cancelled' || event.type === 'error') {
          runFailed.current = true;
          setRunId(null);
          setLiveTrace(value =>
            value.map(item =>
              item.state === 'running'
                ? {
                    ...item,
                    state: 'error',
                    completedAt: Date.now(),
                  }
                : item,
            ),
          );
          if (event.type === 'error') {
            setError(event.message ?? t('Advisor failed.'));
          }
        }
      }),
    [client, conversationId, t],
  );
  useEffect(() => {
    const messageList = messageListRef.current;
    if (messageList) {
      messageList.scrollTop = messageList.scrollHeight;
    }
  }, [liveTrace, messages.data?.length, streamed]);

  const createConversation = async () => {
    if (createdInitial.current) {
      return;
    }

    await conversationMutation.run(async () => {
      const item = await send('ai/advisor/create-conversation', {});
      setConversationId(item.id);
      await client.invalidateQueries({ queryKey: ['advisor-conversations'] });
    });
  };
  const deleteConversation = async (id: string) => {
    await conversationMutation.run(async () => {
      await send('ai/advisor/delete-conversation', { id });
      if (conversationId === id) {
        setConversationId(null);
      }
      await client.invalidateQueries({
        queryKey: ['advisor-conversations'],
      });
    });
  };
  const confirmDeleteConversation = (conversation: AiConversationEntity) => {
    dispatch(
      pushModal({
        modal: {
          name: 'confirm-delete',
          options: {
            message: t(
              'Delete "{{title}}" and its entire conversation history?',
              { title: conversation.title },
            ),
            onConfirm: () => {
              void deleteConversation(conversation.id);
            },
          },
        },
      }),
    );
  };
  const submit = async () => {
    if (!conversationId || !draft.trim() || runId || submitMutation.isPending) {
      return;
    }

    const draftAtSubmit = draft;
    const message = draftAtSubmit.trim();
    await submitMutation.run(
      async () => {
        runFailed.current = false;
        setError('');
        setStreamed('');
        setLiveTrace([]);
        const result = await send('ai/advisor/start', {
          conversationId,
          message,
        });
        if (result.status === 'completed') {
          if (!runFailed.current) {
            setDraft(currentDraft =>
              currentDraft === draftAtSubmit ? '' : currentDraft,
            );
          }
          await client.invalidateQueries({ queryKey: ['advisor-messages'] });
        } else {
          setError(
            result.status === 'disabled'
              ? t('Enable AI features in Settings before using the advisor.')
              : result.status === 'budget-exceeded'
                ? t("Today's AI spending limit has been reached.")
                : t('Conversation not found.'),
          );
        }
      },
      () => {
        setError(
          t(
            'Could not send this advisor message. Check your connection and try again.',
          ),
        );
      },
    );
  };
  const cancel = async (activeRunId: string) => {
    await cancelMutation.run(
      async () => {
        await send('ai/advisor/cancel', { runId: activeRunId });
      },
      () => {
        setError(
          t(
            'Could not stop this advisor response. Check your connection and try again.',
          ),
        );
      },
    );
  };
  const refresh = (key: string) => () => {
    void client.invalidateQueries({ queryKey: [key] });
  };

  const tabs: Array<[Tab, string]> = [
    ['conversation', t('Conversation')],
    ['profile', t('Profile & memory')],
    ['goals', t('Goals')],
    ['documents', t('Documents')],
    ['plan', t('Plan')],
  ];
  const selectedConversation = conversations.data?.find(
    item => item.id === conversationId,
  );

  if (isMobile && isMobileConversationList) {
    return (
      <Page
        header={
          <MobilePageHeader
            title={t('Conversations')}
            leftContent={
              <MobileBackButton
                onPress={() => setIsMobileConversationList(false)}
              />
            }
            rightContent={
              <Button
                variant="bare"
                isDisabled={isCreatingInitial || conversationMutation.isPending}
                onPress={() => {
                  void createConversation().then(() => {
                    setIsMobileConversationList(false);
                  });
                }}
              >
                <Trans>New</Trans>
              </Button>
            }
          />
        }
        padding={0}
      >
        <View
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            gap: 8,
            padding: 10,
            paddingBottom: MOBILE_NAV_HEIGHT,
          }}
        >
          {conversations.isLoading ? (
            <LoadingIndicator />
          ) : conversations.isError ? (
            <LoadingError />
          ) : (
            (conversations.data ?? []).map(item => (
              <View
                key={item.id}
                style={{
                  ...panel,
                  padding: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Button
                  variant={item.id === conversationId ? 'bare' : 'normal'}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 40,
                    justifyContent: 'flex-start',
                  }}
                  onPress={() => {
                    setConversationId(item.id);
                    setIsMobileConversationList(false);
                  }}
                >
                  {item.title}
                </Button>
                <Button
                  variant="bare"
                  style={{
                    minHeight: 40,
                    color: theme.errorTextMenu,
                  }}
                  isDisabled={conversationMutation.isPending}
                  onPress={() => confirmDeleteConversation(item)}
                >
                  <Trans>Delete</Trans>
                </Button>
              </View>
            ))
          )}
        </View>
      </Page>
    );
  }

  if (isMobile) {
    const mobilePanel =
      tab === 'profile' ? (
        <Profile
          memories={memory.data ?? []}
          refresh={refresh('advisor-memory')}
          isLoading={memory.isLoading}
          isError={memory.isError}
        />
      ) : tab === 'goals' ? (
        <Goals
          goals={goals.data ?? []}
          refresh={refresh('advisor-goals')}
          isLoading={goals.isLoading}
          isError={goals.isError}
        />
      ) : tab === 'documents' ? (
        <Documents
          documents={documents.data ?? []}
          refresh={refresh('advisor-documents')}
          isLoading={documents.isLoading}
          isError={documents.isError}
        />
      ) : tab === 'plan' ? (
        <Plan
          advice={advice.data ?? []}
          refresh={refresh('advisor-advice')}
          isLoading={advice.isLoading}
          isError={advice.isError}
          isMobile
        />
      ) : null;

    return (
      <Page
        header={<MobilePageHeader title={t('Financial advisor')} />}
        padding={0}
      >
        <View style={{ flex: 1, minHeight: 0 }}>
          <View
            role="tablist"
            aria-label={t('Advisor sections')}
            style={{
              flexDirection: 'row',
              flexShrink: 0,
              gap: 6,
              overflowX: 'auto',
              padding: 8,
              borderBottomWidth: 1,
              borderBottomStyle: 'solid',
              borderBottomColor: theme.tableBorder,
            }}
          >
            {tabs.map(([value, label]) => (
              <AdvisorTabButton
                key={value}
                value={value}
                label={label}
                isSelected={tab === value}
                isMobile
                onSelect={setTab}
              />
            ))}
          </View>
          {tab === 'conversation' ? (
            <View
              id="advisor-panel-conversation"
              role="tabpanel"
              aria-labelledby="advisor-tab-conversation"
              style={{ flex: 1, minHeight: 0 }}
            >
              <View style={{ flexShrink: 0, padding: 8 }}>
                <TapField
                  value={selectedConversation?.title ?? ''}
                  placeholder={t('Choose a conversation')}
                  rightContent={
                    <SvgCheveronRight
                      style={{ width: 16, height: 16, flexShrink: 0 }}
                    />
                  }
                  onPress={() => setIsMobileConversationList(true)}
                />
              </View>
              <View
                ref={messageListRef}
                aria-live="polite"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  gap: 10,
                  padding: 8,
                  paddingBottom: MOBILE_NAV_HEIGHT + 92,
                }}
              >
                {conversationId != null && messages.isLoading ? (
                  <LoadingIndicator />
                ) : messages.isError ? (
                  <LoadingError />
                ) : (
                  (messages.data ?? []).map(item => (
                    <AdvisorMessage key={item.id} message={item} />
                  ))
                )}
                {(streamed || liveTrace.length > 0) && (
                  <AdvisorMessage
                    isStreaming={runId != null}
                    message={{
                      id: 'stream',
                      conversationId: conversationId ?? '',
                      role: 'assistant',
                      content: streamed,
                      parts: liveTrace,
                      runId: null,
                      createdAt: Date.now(),
                    }}
                  />
                )}
                {error && (
                  <Text style={{ color: theme.errorText }}>{error}</Text>
                )}
                <Text
                  style={{
                    color: theme.pageTextSubdued,
                    fontSize: 11,
                  }}
                >
                  <Trans>
                    Financial data is read-only. Personal memories and plans
                    require your confirmation.
                  </Trans>
                </Text>
              </View>
              <FloatingActionBar
                style={{
                  bottom: MOBILE_NAV_HEIGHT + 8,
                  left: 0,
                  width: 'calc(100vw - 20px)',
                  height: 'auto',
                  minHeight: 60,
                  margin: '0 10px',
                  padding: 6,
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  gap: 6,
                }}
              >
                <textarea
                  rows={1}
                  aria-label={t('Advisor message')}
                  className={css({
                    flex: 1,
                    minWidth: 0,
                    minHeight: 40,
                    maxHeight: 88,
                    resize: 'none',
                    padding: 8,
                    color: theme.pageText,
                    backgroundColor: theme.tableBackground,
                    border: `1px solid ${theme.buttonNormalBorder}`,
                    borderRadius: 6,
                  })}
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  placeholder={t('Talk about a decision, concern or goal…')}
                />
                {runId ? (
                  <Button
                    style={{ minHeight: 40 }}
                    isDisabled={cancelMutation.isPending}
                    onPress={() => cancel(runId)}
                  >
                    <Trans>Stop</Trans>
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    style={{ minHeight: 40 }}
                    isDisabled={
                      !conversationId ||
                      !draft.trim() ||
                      submitMutation.isPending
                    }
                    onPress={submit}
                  >
                    <Trans>Send</Trans>
                  </Button>
                )}
              </FloatingActionBar>
            </View>
          ) : (
            <View
              id={`advisor-panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`advisor-tab-${tab}`}
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: 10,
                paddingBottom: MOBILE_NAV_HEIGHT,
              }}
            >
              {mobilePanel}
            </View>
          )}
        </View>
      </Page>
    );
  }

  return (
    <Page header={t('Financial advisor')}>
      <View style={{ flex: 1, minHeight: 0, gap: 12 }}>
        <View
          role="tablist"
          aria-label={t('Advisor sections')}
          style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
        >
          {tabs.map(([value, label]) => (
            <AdvisorTabButton
              key={value}
              value={value}
              label={label}
              isSelected={tab === value}
              onSelect={setTab}
            />
          ))}
        </View>
        {tab === 'conversation' && (
          <View
            id="advisor-panel-conversation"
            role="tabpanel"
            aria-labelledby="advisor-tab-conversation"
            style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap: 12 }}
          >
            <View
              style={{
                width: 220,
                flexShrink: 0,
                ...panel,
                overflow: 'auto',
              }}
            >
              <Button
                variant="primary"
                isDisabled={isCreatingInitial || conversationMutation.isPending}
                onPress={createConversation}
              >
                <Trans>New conversation</Trans>
              </Button>
              {conversations.isLoading ? (
                <LoadingIndicator />
              ) : conversations.isError ? (
                <LoadingError />
              ) : (
                (conversations.data ?? []).map((item: AiConversationEntity) => (
                  <View key={item.id} style={{ gap: 2 }}>
                    <Button
                      variant={item.id === conversationId ? 'bare' : 'normal'}
                      onPress={() => setConversationId(item.id)}
                    >
                      {item.title}
                    </Button>
                    <Button
                      variant="bare"
                      style={{ color: theme.errorTextMenu }}
                      isDisabled={conversationMutation.isPending}
                      onPress={() => confirmDeleteConversation(item)}
                    >
                      <Trans>Delete</Trans>
                    </Button>
                  </View>
                ))
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0, minHeight: 0, gap: 10 }}>
              <View
                ref={messageListRef}
                aria-live="polite"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  gap: 10,
                  padding: 8,
                }}
              >
                {conversationId != null && messages.isLoading ? (
                  <LoadingIndicator />
                ) : messages.isError ? (
                  <LoadingError />
                ) : (
                  (messages.data ?? []).map(item => (
                    <AdvisorMessage key={item.id} message={item} />
                  ))
                )}
                {(streamed || liveTrace.length > 0) && (
                  <AdvisorMessage
                    isStreaming={runId != null}
                    message={{
                      id: 'stream',
                      conversationId: conversationId ?? '',
                      role: 'assistant',
                      content: streamed,
                      parts: liveTrace,
                      runId: null,
                      createdAt: Date.now(),
                    }}
                  />
                )}
                {error && (
                  <Text style={{ flexShrink: 0, color: theme.errorText }}>
                    {error}
                  </Text>
                )}
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  flexShrink: 0,
                  gap: 8,
                  alignItems: 'flex-end',
                }}
              >
                <textarea
                  className={css({
                    flex: 1,
                    minWidth: 0,
                    minHeight: 64,
                    maxHeight: 180,
                    resize: 'vertical',
                    padding: 10,
                    color: theme.pageText,
                    backgroundColor: theme.tableBackground,
                    border: `1px solid ${theme.buttonNormalBorder}`,
                    borderRadius: 6,
                  })}
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void submit();
                    }
                  }}
                  placeholder={t('Talk about a decision, concern or goal…')}
                />
                {runId ? (
                  <Button
                    isDisabled={cancelMutation.isPending}
                    onPress={() => cancel(runId)}
                  >
                    <Trans>Stop</Trans>
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    isDisabled={
                      !conversationId ||
                      !draft.trim() ||
                      submitMutation.isPending
                    }
                    onPress={submit}
                  >
                    <Trans>Send</Trans>
                  </Button>
                )}
              </View>
              <Text
                style={{
                  flexShrink: 0,
                  color: theme.pageTextSubdued,
                  fontSize: 12,
                }}
              >
                <Trans>
                  Financial data is read-only. Personal memories and plans
                  require your confirmation.
                </Trans>
              </Text>
            </View>
          </View>
        )}
        {tab === 'profile' && (
          <View
            id="advisor-panel-profile"
            role="tabpanel"
            aria-labelledby="advisor-tab-profile"
            style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
          >
            <Profile
              memories={memory.data ?? []}
              refresh={refresh('advisor-memory')}
              isLoading={memory.isLoading}
              isError={memory.isError}
            />
          </View>
        )}
        {tab === 'goals' && (
          <View
            id="advisor-panel-goals"
            role="tabpanel"
            aria-labelledby="advisor-tab-goals"
            style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
          >
            <Goals
              goals={goals.data ?? []}
              refresh={refresh('advisor-goals')}
              isLoading={goals.isLoading}
              isError={goals.isError}
            />
          </View>
        )}
        {tab === 'documents' && (
          <View
            id="advisor-panel-documents"
            role="tabpanel"
            aria-labelledby="advisor-tab-documents"
            style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
          >
            <Documents
              documents={documents.data ?? []}
              refresh={refresh('advisor-documents')}
              isLoading={documents.isLoading}
              isError={documents.isError}
            />
          </View>
        )}
        {tab === 'plan' && (
          <View
            id="advisor-panel-plan"
            role="tabpanel"
            aria-labelledby="advisor-tab-plan"
            style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
          >
            <Plan
              advice={advice.data ?? []}
              refresh={refresh('advisor-advice')}
              isLoading={advice.isLoading}
              isError={advice.isError}
            />
          </View>
        )}
      </View>
    </Page>
  );
}

export function MobileAdvisorPage() {
  return <AdvisorPage isMobile />;
}
