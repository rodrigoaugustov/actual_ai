import { Trans, useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import type { AiMessageEntity } from '@actual-app/core/types/models';
import { css } from '@emotion/css';
import rehypeExternalLinks from 'rehype-external-links';
import remarkGfm from 'remark-gfm';

import { nossoCaderninho } from '#style/nossoCaderninho';
import { markdownBaseStyles, remarkBreaks } from '#util/markdown';

import { AdvisorTrace, toolLabel } from './AdvisorTrace';

const remarkPlugins = [remarkGfm, remarkBreaks];

const assistantMarkdownStyles = css(markdownBaseStyles, {
  display: 'block',
  width: '100%',
  minWidth: 0,
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
  '& p': {
    margin: '0 0 0.75rem',
    '&:last-child': {
      marginBottom: 0,
    },
  },
  '& h1, & h2, & h3, & h4': {
    lineHeight: 1.25,
    margin: '1rem 0 0.5rem',
    '&:first-child': {
      marginTop: 0,
    },
  },
  '& h1': {
    fontSize: '1.25rem',
  },
  '& h2': {
    fontSize: '1.125rem',
  },
  '& h3, & h4': {
    fontSize: '1rem',
  },
  '& ul, & ol': {
    listStylePosition: 'outside',
    margin: '0.5rem 0 0.75rem',
    paddingLeft: '1.5rem',
  },
  '& li': {
    marginTop: '0.25rem',
  },
  '& table': {
    display: 'block',
    maxWidth: '100%',
    margin: '0.75rem 0',
    overflowX: 'auto',
    borderCollapse: 'collapse',
    borderTop: `1px solid ${nossoCaderninho.color.rail}`,
    fontVariantNumeric: 'tabular-nums',
  },
  '& th, & td': {
    padding: '0.4rem 0.6rem',
    textAlign: 'left',
    verticalAlign: 'top',
    borderBottom: `1px solid ${nossoCaderninho.color.railSoft}`,
  },
  '& th': {
    color: nossoCaderninho.color.graphiteSubdued,
    backgroundColor: nossoCaderninho.color.signalSoft,
    fontWeight: 600,
  },
  '& a': {
    color: nossoCaderninho.color.partnership,
  },
});

function MessageMetadata({
  tools,
  sources,
}: {
  tools: string[];
  sources: string[];
}) {
  if (tools.length === 0 && sources.length === 0) {
    return null;
  }

  return (
    <View
      style={{
        gap: 4,
        marginTop: 10,
        paddingTop: 8,
        borderTop: `1px solid ${nossoCaderninho.color.railSoft}`,
        color: nossoCaderninho.color.graphiteSubdued,
        fontSize: 11,
      }}
    >
      {tools.length > 0 && (
        <Text>
          <Trans>Consulted tools:</Trans> {tools.join(' · ')}
        </Text>
      )}
      {sources.length > 0 && (
        <Text>
          <Trans>Context sources:</Trans> {sources.join(' · ')}
        </Text>
      )}
    </View>
  );
}

export function AdvisorMessage({
  message,
  isStreaming = false,
}: {
  message: AiMessageEntity;
  isStreaming?: boolean;
}) {
  const { t } = useTranslation();
  const isUser = message.role === 'user';
  const trace = message.parts.filter(part => part.type === 'trace');
  const tracedTools = new Set(
    trace.flatMap(part => (part.toolName ? [part.toolName] : [])),
  );
  const tools = [
    ...new Set(
      message.parts
        .filter(part => part.type === 'tool' && part.state === 'result')
        .flatMap(part =>
          part.type === 'tool' && !tracedTools.has(part.toolName)
            ? [toolLabel(part.toolName, t)]
            : [],
        ),
    ),
  ];
  const sources = message.parts
    .filter(part => part.type === 'source')
    .map(source => (source.type === 'source' ? source.title : ''));

  return (
    <View
      data-testid={`advisor-message-${message.role}`}
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        flexShrink: 0,
        minWidth: 0,
        width: isUser ? 'auto' : '100%',
        maxWidth: isUser ? 'min(680px, 88%)' : '100%',
        borderRadius: isUser ? nossoCaderninho.radius.panel : 0,
        padding: isUser ? '10px 12px' : 0,
        overflow: 'hidden',
        overflowWrap: 'anywhere',
        backgroundColor: isUser
          ? nossoCaderninho.color.partnershipSoft
          : nossoCaderninho.color.plate,
        color: nossoCaderninho.color.graphite,
        border: isUser
          ? `1px solid ${nossoCaderninho.color.railSoft}`
          : undefined,
        fontFamily: nossoCaderninho.font.family,
      }}
    >
      {isUser ? (
        <Text className={css({ whiteSpace: 'pre-wrap', lineHeight: 1.5 })}>
          {message.content}
        </Text>
      ) : (
        <>
          {isStreaming && (
            <AdvisorTrace trace={trace} isRunning={isStreaming} />
          )}
          {message.content && (
            <View className={assistantMarkdownStyles}>
              <ReactMarkdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={[
                  [
                    rehypeExternalLinks,
                    { target: '_blank', rel: ['noopener', 'noreferrer'] },
                  ],
                ]}
                allowedElements={[
                  'a',
                  'blockquote',
                  'br',
                  'code',
                  'del',
                  'em',
                  'h1',
                  'h2',
                  'h3',
                  'h4',
                  'hr',
                  'li',
                  'ol',
                  'p',
                  'pre',
                  'strong',
                  'table',
                  'tbody',
                  'td',
                  'th',
                  'thead',
                  'tr',
                  'ul',
                ]}
              >
                {message.content}
              </ReactMarkdown>
            </View>
          )}
          {!isStreaming && (
            <AdvisorTrace trace={trace} isRunning={isStreaming} />
          )}
        </>
      )}
      {!isUser && <MessageMetadata tools={tools} sources={sources} />}
    </View>
  );
}
