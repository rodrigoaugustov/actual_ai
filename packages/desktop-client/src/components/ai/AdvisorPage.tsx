import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import {
  SvgChatBubbleDots,
  SvgCog,
  SvgMenu,
  SvgSend,
  SvgTrash,
} from '@actual-app/components/icons/v1';
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

import { MobilePageHeader, Page } from '#components/Page';
import { useDateFormat } from '#hooks/useDateFormat';
import { useUrlParam } from '#hooks/useUrlParam';
import { pushModal } from '#modals/modalsSlice';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';
import { nossoCaderninho } from '#style/nossoCaderninho';

import { AdvisorDrawer } from './AdvisorDrawer';
import { AdvisorEmptyState } from './AdvisorEmptyState';
import { AdvisorMessage } from './AdvisorMessage';
import {
  advisorComposerAreaClass,
  advisorComposerClass,
  advisorComposerHintClass,
  advisorConnectionDotClass,
  advisorContextLayoutClass,
  advisorContextNavButtonClass,
  advisorContextNavClass,
  advisorContextPanelClass,
  advisorContextRailClass,
  advisorConversationClass,
  advisorDesktopHeaderClass,
  advisorHeaderActionsClass,
  advisorHeaderButtonClass,
  advisorHeaderIdentityClass,
  advisorHistoryDeleteClass,
  advisorHistoryListClass,
  advisorHistoryRowClass,
  advisorHistorySelectClass,
  advisorMessageListClass,
  advisorMessageMeasureClass,
  advisorNewConversationClass,
  advisorSendButtonClass,
  advisorSurfaceClass,
  advisorTextareaClass,
  advisorWorkspaceClass,
} from './advisorStyles';
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
const ADVISOR_DRAFT_STORAGE_PREFIX = 'actual:advisor-draft:';

function isTab(value: string | null): value is Tab {
  return value != null && TAB_VALUES.includes(value as Tab);
}

function readAdvisorDraft(conversationId: string): string {
  try {
    return (
      window.localStorage.getItem(
        `${ADVISOR_DRAFT_STORAGE_PREFIX}${conversationId}`,
      ) ?? ''
    );
  } catch {
    return '';
  }
}

function writeAdvisorDraft(conversationId: string, draft: string) {
  try {
    const key = `${ADVISOR_DRAFT_STORAGE_PREFIX}${conversationId}`;
    if (draft) {
      window.localStorage.setItem(key, draft);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Draft persistence is best-effort when storage is unavailable.
  }
}

const panel = {
  border: `1px solid ${theme.pillBorderDark}`,
  borderRadius: 6,
  padding: 12,
  gap: 8,
};

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
            message: t('Could not complete this Assistant action. Try again.'),
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
      <Trans>Could not load this Assistant data. Try again.</Trans>
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
      <ul
        className={css({
          margin: 0,
          paddingLeft: 18,
          display: 'grid',
          gap: 4,
        })}
      >
        {items.map((item, index) => (
          <li
            key={`${index}-${item}`}
            className={css({ lineHeight: 1.4, overflowWrap: 'anywhere' })}
          >
            {item}
          </li>
        ))}
      </ul>
    </View>
  );
}

type AdvisorPageProps = {
  isMobile?: boolean;
};

/*
THESIS — A conversa é o Assistente; histórico e contexto recusam o peso de destinos iguais.
OWN-WORLD — Esmalte frio, placas brancas e trilhos azul-petróleo organizam diálogo e prova.
STORY — A família pergunta, acompanha a análise, confere evidências e confirma o próximo passo.
FIRST VIEWPORT — Thread ampla entre faixa contextual e composer; gavetas aparecem somente sob demanda.
FORM — Thread + faixa de contexto, posição 4; composição “Conversa em foco”; seed f6a18c77.
*/
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
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [streamed, setStreamed] = useState('');
  const [liveTrace, setLiveTrace] = useState<AiTracePart[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isCreatingInitial, setIsCreatingInitial] = useState(false);
  const [isConversationListOpen, setIsConversationListOpen] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const createdInitial = useRef(false);
  const runFailed = useRef(false);
  const draftRef = useRef('');
  const messageListRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
  const draft =
    conversationId == null
      ? ''
      : (drafts[conversationId] ?? readAdvisorDraft(conversationId));
  const setDraft = (value: string) => {
    if (conversationId == null) {
      return;
    }

    writeAdvisorDraft(conversationId, value);
    setDrafts(current => ({
      ...current,
      [conversationId]: value,
    }));
  };
  const hasActiveResponse = runId != null || submitMutation.isPending;

  useEffect(() => {
    function updateOnlineStatus() {
      setIsOnline(navigator.onLine);
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    if (!draft && textareaRef.current) {
      textareaRef.current.style.height = '';
    }
  }, [draft]);
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
                  'Could not complete this Assistant action. Try again.',
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
    if (createdInitial.current || hasActiveResponse) {
      return;
    }

    await conversationMutation.run(async () => {
      const item = await send('ai/advisor/create-conversation', {});
      setConversationId(item.id);
      await client.invalidateQueries({ queryKey: ['advisor-conversations'] });
    });
  };
  const deleteConversation = async (id: string) => {
    if (hasActiveResponse) {
      return;
    }

    await conversationMutation.run(async () => {
      await send('ai/advisor/delete-conversation', { id });
      writeAdvisorDraft(id, '');
      setDrafts(current =>
        Object.fromEntries(
          Object.entries(current).filter(([conversationDraftId]) => {
            return conversationDraftId !== id;
          }),
        ),
      );
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
    if (
      !isOnline ||
      !conversationId ||
      !draft.trim() ||
      runId ||
      submitMutation.isPending
    ) {
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
          if (!runFailed.current && draftRef.current === draftAtSubmit) {
            setDraft('');
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
  const selectedConversation = conversations.data?.find(
    item => item.id === conversationId,
  );
  const confirmedMemories = (memory.data ?? []).filter(
    item => item.status === 'confirmed',
  ).length;
  const activeGoals = (goals.data ?? []).filter(
    item => item.status === 'active',
  ).length;
  const activePlans = (advice.data ?? []).filter(
    item => item.status !== 'rejected',
  ).length;
  const contextSections: Array<[Exclude<Tab, 'conversation'>, string, number]> =
    [
      ['profile', t('Memory'), confirmedMemories],
      ['goals', t('Goals'), activeGoals],
      ['documents', t('Documents'), documents.data?.length ?? 0],
      ['plan', t('Plans'), activePlans],
    ];
  const contextSection = tab === 'conversation' ? 'profile' : tab;
  const contextPanel =
    contextSection === 'profile' ? (
      <Profile
        memories={memory.data ?? []}
        refresh={refresh('advisor-memory')}
        isLoading={memory.isLoading}
        isError={memory.isError}
      />
    ) : contextSection === 'goals' ? (
      <Goals
        goals={goals.data ?? []}
        refresh={refresh('advisor-goals')}
        isLoading={goals.isLoading}
        isError={goals.isError}
      />
    ) : contextSection === 'documents' ? (
      <Documents
        documents={documents.data ?? []}
        refresh={refresh('advisor-documents')}
        isLoading={documents.isLoading}
        isError={documents.isError}
      />
    ) : contextSection === 'plan' ? (
      <Plan
        advice={advice.data ?? []}
        refresh={refresh('advisor-advice')}
        isLoading={advice.isLoading}
        isError={advice.isError}
        isMobile={isMobile}
      />
    ) : null;
  const historyTriggerId = isMobile
    ? 'advisor-mobile-history-trigger'
    : 'advisor-history-trigger';
  const contextTriggerId = isMobile
    ? 'advisor-mobile-context-trigger'
    : 'advisor-context-trigger';

  const mobileHeader = (
    <MobilePageHeader
      title={selectedConversation?.title ?? t('Assistant')}
      style={{
        backgroundColor: nossoCaderninho.color.nav,
        color: nossoCaderninho.color.navText,
        fontFamily: nossoCaderninho.font.family,
      }}
      leftContent={
        <Button
          id={historyTriggerId}
          variant="bare"
          aria-label={t('Conversation history')}
          aria-haspopup="dialog"
          aria-expanded={isConversationListOpen}
          onPress={() => setIsConversationListOpen(true)}
          style={{
            width: 44,
            height: 44,
            color: nossoCaderninho.color.navText,
          }}
        >
          <SvgMenu width={18} height={18} />
        </Button>
      }
      rightContent={
        <Button
          id={contextTriggerId}
          variant="bare"
          aria-label={t('Assistant context')}
          aria-haspopup="dialog"
          aria-expanded={isContextOpen || tab !== 'conversation'}
          onPress={() => setIsContextOpen(true)}
          style={{
            width: 44,
            height: 44,
            color: nossoCaderninho.color.navText,
          }}
        >
          <SvgCog width={18} height={18} />
        </Button>
      }
    />
  );

  return (
    <Page
      header={isMobile ? mobileHeader : null}
      padding={0}
      style={{
        minHeight: 0,
        overflow: 'hidden',
        backgroundColor: nossoCaderninho.color.enamel,
      }}
    >
      <div
        className={`${advisorSurfaceClass} ${advisorWorkspaceClass}`}
        data-mobile={isMobile}
      >
        {!isMobile && (
          <header className={advisorDesktopHeaderClass}>
            <div className={advisorHeaderIdentityClass}>
              <Button
                id={historyTriggerId}
                variant="bare"
                aria-label={t('Conversation history')}
                aria-haspopup="dialog"
                aria-expanded={isConversationListOpen}
                onPress={() => setIsConversationListOpen(true)}
                className={advisorHeaderButtonClass}
              >
                <SvgMenu width={17} height={17} />
              </Button>
              <div>
                <h1>{selectedConversation?.title ?? t('Assistant')}</h1>
                <p>
                  <Trans>Financial assistant for the household</Trans>
                </p>
              </div>
            </div>
            <div className={advisorHeaderActionsClass}>
              <Button
                id={contextTriggerId}
                variant="bare"
                aria-haspopup="dialog"
                aria-expanded={isContextOpen || tab !== 'conversation'}
                onPress={() => setIsContextOpen(true)}
                className={advisorHeaderButtonClass}
              >
                <SvgCog width={16} height={16} />
                <Trans>Assistant context</Trans>
              </Button>
            </div>
          </header>
        )}

        <div className={advisorContextRailClass} aria-live="polite">
          <span
            className={advisorConnectionDotClass}
            data-online={isOnline}
            aria-hidden
          />
          <strong>
            {isOnline ? <Trans>Online</Trans> : <Trans>Offline</Trans>}
          </strong>
          <span aria-hidden>·</span>
          <span>
            {confirmedMemories} <Trans>memories</Trans>
          </span>
          <span aria-hidden>·</span>
          <span>
            {activeGoals} <Trans>goals</Trans>
          </span>
          <span aria-hidden>·</span>
          <span>
            {activePlans} <Trans>plans</Trans>
          </span>
        </div>

        <section
          className={advisorConversationClass}
          aria-label={t('Assistant conversation')}
        >
          <div
            ref={messageListRef}
            aria-live="polite"
            className={advisorMessageListClass}
          >
            <div className={advisorMessageMeasureClass}>
              {conversationId == null || messages.isLoading ? (
                <LoadingIndicator />
              ) : messages.isError ? (
                <LoadingError />
              ) : (messages.data ?? []).length === 0 &&
                !streamed &&
                liveTrace.length === 0 ? (
                <AdvisorEmptyState onChoosePrompt={setDraft} />
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
                <Text style={{ color: nossoCaderninho.color.limit }}>
                  {error}
                </Text>
              )}
            </div>
          </div>

          <div className={advisorComposerAreaClass}>
            <div className={advisorComposerClass}>
              <textarea
                ref={textareaRef}
                rows={1}
                aria-label={t('Advisor message')}
                className={advisorTextareaClass}
                value={draft}
                onChange={event => {
                  const target = event.currentTarget;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 112)}px`;
                  setDraft(target.value);
                }}
                onKeyDown={event => {
                  if (!isMobile && event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void submit();
                  }
                }}
                placeholder={t('Ask about the household finances…')}
              />
              {runId ? (
                <Button
                  className={advisorSendButtonClass}
                  isDisabled={cancelMutation.isPending || !isOnline}
                  onPress={() => cancel(runId)}
                >
                  <Trans>Stop</Trans>
                </Button>
              ) : (
                <Button
                  variant="primary"
                  className={advisorSendButtonClass}
                  isDisabled={
                    !isOnline ||
                    !conversationId ||
                    !draft.trim() ||
                    submitMutation.isPending
                  }
                  onPress={submit}
                >
                  <SvgSend width={15} height={15} />
                  <Trans>Send</Trans>
                </Button>
              )}
            </div>
            <p
              className={advisorComposerHintClass}
              data-offline={!isOnline}
              role={isOnline ? undefined : 'status'}
            >
              {isOnline ? (
                <Trans>
                  Financial data is read-only. Memories and plans require your
                  confirmation.
                </Trans>
              ) : runId ? (
                <Trans>
                  A connection is required to stop the current response.
                </Trans>
              ) : (
                <Trans>The Assistant needs a connection to respond.</Trans>
              )}
            </p>
          </div>
        </section>
      </div>

      <AdvisorDrawer
        id="advisor-conversation-history"
        title={<Trans>Conversations</Trans>}
        subtitle={<Trans>Shared household history</Trans>}
        isOpen={isConversationListOpen}
        returnFocusId={historyTriggerId}
        onClose={() => setIsConversationListOpen(false)}
      >
        <Button
          variant="primary"
          className={advisorNewConversationClass}
          isDisabled={
            isCreatingInitial ||
            conversationMutation.isPending ||
            hasActiveResponse
          }
          onPress={() => {
            void createConversation().then(() =>
              setIsConversationListOpen(false),
            );
          }}
        >
          <SvgChatBubbleDots width={16} height={16} />
          <Trans>New conversation</Trans>
        </Button>
        {hasActiveResponse && (
          <output
            style={{
              display: 'block',
              margin: '0 16px 12px',
              color: nossoCaderninho.color.graphiteSubdued,
              fontSize: 11,
            }}
          >
            <Trans>
              Finish or stop the current response before changing conversations.
            </Trans>
          </output>
        )}
        <div className={advisorHistoryListClass}>
          {conversations.isLoading ? (
            <LoadingIndicator />
          ) : conversations.isError ? (
            <LoadingError />
          ) : (
            (conversations.data ?? []).map(item => (
              <div
                key={item.id}
                className={advisorHistoryRowClass}
                data-current={item.id === conversationId}
              >
                <button
                  type="button"
                  className={advisorHistorySelectClass}
                  aria-current={item.id === conversationId ? 'page' : undefined}
                  disabled={hasActiveResponse && item.id !== conversationId}
                  onClick={() => {
                    setConversationId(item.id);
                    setIsConversationListOpen(false);
                  }}
                >
                  <strong>{item.title}</strong>
                  <span>
                    {item.id === conversationId ? (
                      <Trans>Current conversation</Trans>
                    ) : (
                      <Trans>Open conversation</Trans>
                    )}
                  </span>
                </button>
                <Button
                  variant="bare"
                  aria-label={t('Delete "{{title}}"', { title: item.title })}
                  className={advisorHistoryDeleteClass}
                  isDisabled={
                    conversationMutation.isPending || hasActiveResponse
                  }
                  onPress={() => confirmDeleteConversation(item)}
                >
                  <SvgTrash width={15} height={15} />
                </Button>
              </div>
            ))
          )}
        </div>
      </AdvisorDrawer>

      <AdvisorDrawer
        id="advisor-context"
        title={<Trans>Assistant context</Trans>}
        subtitle={<Trans>Memory, goals, documents and plans</Trans>}
        isOpen={isContextOpen || tab !== 'conversation'}
        size="wide"
        returnFocusId={contextTriggerId}
        onClose={() => {
          setIsContextOpen(false);
          if (tab !== 'conversation') {
            setTab('conversation');
          }
        }}
      >
        <div className={advisorContextLayoutClass}>
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label={t('Assistant context sections')}
            className={advisorContextNavClass}
          >
            {contextSections.map(([value, label, count]) => (
              <button
                key={value}
                id={`advisor-context-tab-${value}`}
                type="button"
                role="tab"
                aria-label={label}
                aria-selected={contextSection === value}
                aria-controls={`advisor-context-panel-${value}`}
                className={advisorContextNavButtonClass}
                onClick={() => {
                  setIsContextOpen(false);
                  setTab(value);
                }}
                onKeyDown={event => {
                  const currentIndex = contextSections.findIndex(
                    ([section]) => section === value,
                  );
                  const nextIndex =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? contextSections.length - 1
                        : event.key === 'ArrowDown'
                          ? (currentIndex + 1) % contextSections.length
                          : event.key === 'ArrowUp'
                            ? (currentIndex - 1 + contextSections.length) %
                              contextSections.length
                            : null;
                  if (nextIndex == null) {
                    return;
                  }

                  event.preventDefault();
                  const nextSection = contextSections[nextIndex][0];
                  setIsContextOpen(false);
                  setTab(nextSection);
                  requestAnimationFrame(() =>
                    document
                      .getElementById(`advisor-context-tab-${nextSection}`)
                      ?.focus(),
                  );
                }}
              >
                <span>{label}</span>
                <span aria-hidden>{count}</span>
              </button>
            ))}
          </div>
          <div
            id={`advisor-context-panel-${contextSection}`}
            role="tabpanel"
            aria-labelledby={`advisor-context-tab-${contextSection}`}
            className={advisorContextPanelClass}
          >
            {contextPanel}
          </div>
        </div>
      </AdvisorDrawer>
    </Page>
  );
}

export function MobileAdvisorPage() {
  return <AdvisorPage isMobile />;
}
