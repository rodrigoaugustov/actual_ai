import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
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

import { Page } from '#components/Page';

import { AdvisorMessage } from './AdvisorMessage';

type Tab = 'conversation' | 'profile' | 'goals' | 'documents' | 'plan';
const panel = {
  border: `1px solid ${theme.pillBorderDark}`,
  borderRadius: 6,
  padding: 12,
  gap: 8,
};

function Profile({
  memories,
  refresh,
}: {
  memories: AiMemoryFactEntity[];
  refresh: () => void;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState('');
  const [value, setValue] = useState('');
  const [isSensitive, setIsSensitive] = useState(false);
  const candidates = memories.filter(item => item.status === 'candidate');
  const confirmed = memories.filter(item => item.status === 'confirmed');
  const resolve = async (id: string, action: 'confirm' | 'reject') => {
    await send('ai/advisor/resolve-memory', { id, action });
    refresh();
  };
  const add = async () => {
    if (!kind.trim() || !value.trim()) return;
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
        {candidates.length === 0 && (
          <Text>
            <Trans>No pending memories.</Trans>
          </Text>
        )}
        {candidates.map(item => (
          <View key={item.id} style={panel}>
            <Text style={{ fontWeight: 600 }}>{item.kind}</Text>
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
            {item.originalText && <Text>"{item.originalText}"</Text>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                variant="primary"
                onPress={() => resolve(item.id, 'confirm')}
              >
                <Trans>Confirm</Trans>
              </Button>
              <Button onPress={() => resolve(item.id, 'reject')}>
                <Trans>Reject</Trans>
              </Button>
            </View>
          </View>
        ))}
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
        <Button variant="primary" onPress={add}>
          <Trans>Add for confirmation</Trans>
        </Button>
      </View>
      <View style={panel}>
        <Text style={{ fontWeight: 600 }}>
          <Trans>Confirmed profile</Trans>
        </Text>
        {confirmed.map(item => (
          <View key={item.id} style={{ padding: 8 }}>
            <Text style={{ fontWeight: 600 }}>{item.kind}</Text>
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
              onPress={async () => {
                await send('ai/advisor/delete-memory', { id: item.id });
                refresh();
              }}
            >
              <Trans>Delete</Trans>
            </Button>
          </View>
        ))}
      </View>
    </View>
  );
}

function Goals({
  goals,
  refresh,
}: {
  goals: AiGoalEntity[];
  refresh: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const add = async () => {
    if (!title.trim() || !description.trim()) return;
    await send('ai/advisor/create-goal', {
      title: title.trim(),
      description: description.trim(),
    });
    setTitle('');
    setDescription('');
    refresh();
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
        <Button variant="primary" onPress={add}>
          <Trans>Add goal</Trans>
        </Button>
      </View>
      {goals.map(goal => (
        <View key={goal.id} style={panel}>
          <Text style={{ fontWeight: 600 }}>{goal.title}</Text>
          <Text>{goal.description}</Text>
          <Text style={{ color: theme.pageTextSubdued }}>
            {t('Priority {{priority}} · {{status}}', goal)}
          </Text>
          <Button
            variant="bare"
            onPress={async () => {
              await send('ai/advisor/delete-goal', { id: goal.id });
              refresh();
            }}
          >
            <Trans>Delete</Trans>
          </Button>
        </View>
      ))}
    </View>
  );
}

function Documents({
  documents,
  refresh,
}: {
  documents: AiDocumentEntity[];
  refresh: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const add = async () => {
    if (!title.trim() || !content.trim()) return;
    await send('ai/advisor/create-document', {
      title: title.trim(),
      kind: 'user-note',
      content: content.trim(),
    });
    setTitle('');
    setContent('');
    refresh();
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
        <Button variant="primary" onPress={add}>
          <Trans>Save document</Trans>
        </Button>
      </View>
      {documents.map(document => (
        <View key={document.id} style={panel}>
          <Text style={{ fontWeight: 600 }}>{document.title}</Text>
          <Text style={{ color: theme.pageTextSubdued }}>{document.kind}</Text>
          <Text>{document.content.slice(0, 300)}</Text>
          <Button
            variant="bare"
            onPress={async () => {
              await send('ai/advisor/delete-document', { id: document.id });
              refresh();
            }}
          >
            <Trans>Delete</Trans>
          </Button>
        </View>
      ))}
    </View>
  );
}

function Plan({
  advice,
  refresh,
}: {
  advice: AiAdviceRecordEntity[];
  refresh: () => void;
}) {
  const update = async (
    id: string,
    status: 'accepted' | 'rejected' | 'completed',
  ) => {
    await send('ai/advisor/update-advice', { id, status });
    refresh();
  };
  return (
    <View style={{ gap: 12 }}>
      {advice.length === 0 && (
        <Text>
          <Trans>Recommendations proposed in conversations appear here.</Trans>
        </Text>
      )}
      {advice.map(item => (
        <View key={item.id} style={panel}>
          <Text style={{ fontWeight: 600 }}>{item.title}</Text>
          <Text>{item.recommendation}</Text>
          <Text style={{ color: theme.pageTextSubdued }}>{item.status}</Text>
          {item.status === 'proposed' && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                variant="primary"
                onPress={() => update(item.id, 'accepted')}
              >
                <Trans>Accept plan</Trans>
              </Button>
              <Button onPress={() => update(item.id, 'rejected')}>
                <Trans>Reject</Trans>
              </Button>
            </View>
          )}
          {item.status === 'accepted' && (
            <Button onPress={() => update(item.id, 'completed')}>
              <Trans>Mark completed</Trans>
            </Button>
          )}
        </View>
      ))}
    </View>
  );
}

export function AdvisorPage() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>('conversation');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [streamed, setStreamed] = useState('');
  const [liveTrace, setLiveTrace] = useState<AiTracePart[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const createdInitial = useRef(false);
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
    if (!conversationId && conversations.data?.[0]) {
      setConversationId(conversations.data[0].id);
    }
  }, [conversationId, conversations.data]);
  useEffect(() => {
    if (
      conversations.isSuccess &&
      conversations.data?.length === 0 &&
      !createdInitial.current
    ) {
      createdInitial.current = true;
      void send('ai/advisor/create-conversation', {}).then(item => {
        setConversationId(item.id);
        void client.invalidateQueries({ queryKey: ['advisor-conversations'] });
      });
    }
  }, [client, conversations.data?.length, conversations.isSuccess]);
  useEffect(
    () =>
      listen('ai-advisor-event', (event: AiAdvisorEvent) => {
        if (event.conversationId !== conversationId) return;
        if (event.type === 'text-delta') {
          setStreamed(value => value + event.text);
        } else if (event.type === 'started') {
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
    const item = await send('ai/advisor/create-conversation', {});
    setConversationId(item.id);
    await client.invalidateQueries({ queryKey: ['advisor-conversations'] });
  };
  const submit = async () => {
    if (!conversationId || !draft.trim() || runId) return;
    const message = draft.trim();
    setDraft('');
    setError('');
    setStreamed('');
    setLiveTrace([]);
    const result = await send('ai/advisor/start', { conversationId, message });
    if (result.status === 'completed') {
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
  };
  const refresh = (key: string) => () => {
    void client.invalidateQueries({ queryKey: [key] });
  };

  return (
    <Page header={t('Financial advisor')}>
      <View style={{ flex: 1, minHeight: 0, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {(
            [
              ['conversation', t('Conversation')],
              ['profile', t('Profile & memory')],
              ['goals', t('Goals')],
              ['documents', t('Documents')],
              ['plan', t('Plan')],
            ] as Array<[Tab, string]>
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={tab === value ? 'primary' : 'normal'}
              onPress={() => setTab(value)}
            >
              {label}
            </Button>
          ))}
        </View>
        {tab === 'conversation' && (
          <View
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
              <Button variant="primary" onPress={createConversation}>
                <Trans>New conversation</Trans>
              </Button>
              {(conversations.data ?? []).map((item: AiConversationEntity) => (
                <View key={item.id} style={{ gap: 2 }}>
                  <Button
                    variant={item.id === conversationId ? 'bare' : 'normal'}
                    onPress={() => setConversationId(item.id)}
                  >
                    {item.title}
                  </Button>
                  <Button
                    variant="bare"
                    onPress={async () => {
                      await send('ai/advisor/delete-conversation', {
                        id: item.id,
                      });
                      if (conversationId === item.id) setConversationId(null);
                      await client.invalidateQueries({
                        queryKey: ['advisor-conversations'],
                      });
                    }}
                  >
                    <Trans>Delete</Trans>
                  </Button>
                </View>
              ))}
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
                {(messages.data ?? []).map(item => (
                  <AdvisorMessage key={item.id} message={item} />
                ))}
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
                  <Button onPress={() => send('ai/advisor/cancel', { runId })}>
                    <Trans>Stop</Trans>
                  </Button>
                ) : (
                  <Button variant="primary" onPress={submit}>
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
          <Profile
            memories={memory.data ?? []}
            refresh={refresh('advisor-memory')}
          />
        )}
        {tab === 'goals' && (
          <Goals goals={goals.data ?? []} refresh={refresh('advisor-goals')} />
        )}
        {tab === 'documents' && (
          <Documents
            documents={documents.data ?? []}
            refresh={refresh('advisor-documents')}
          />
        )}
        {tab === 'plan' && (
          <Plan
            advice={advice.data ?? []}
            refresh={refresh('advisor-advice')}
          />
        )}
      </View>
    </Page>
  );
}
