import * as db from '#server/db';

import {
  appendConversationMessage,
  createAdviceRecord,
  createConversation,
  createDocument,
  createGoal,
  createMemoryCandidate,
  deleteConversation,
  deleteDocument,
  listAdviceRecords,
  listConversationMessages,
  listConversations,
  listGoals,
  listMemoryFacts,
  resolveMemoryFact,
  searchAdvisorContext,
} from './advisor-memory';

beforeEach(global.emptyDatabase());

describe('advisor conversations', () => {
  it('persists messages and deletes a conversation as tombstones', async () => {
    const conversation = await createConversation('Planejamento');
    await appendConversationMessage({
      conversationId: conversation.id,
      role: 'user',
      content: 'Quero planejar minha aposentadoria.',
      parts: [{ type: 'text', text: 'Quero planejar minha aposentadoria.' }],
    });

    expect(await listConversations()).toMatchObject([
      { id: conversation.id, title: 'Planejamento', status: 'active' },
    ]);
    expect(await listConversationMessages(conversation.id)).toMatchObject([
      {
        conversationId: conversation.id,
        role: 'user',
        content: 'Quero planejar minha aposentadoria.',
      },
    ]);

    await deleteConversation(conversation.id);

    expect(await listConversations()).toEqual([]);
    expect(await listConversationMessages(conversation.id)).toEqual([]);
  });
});

describe('advisor memory', () => {
  it('requires confirmation and supersedes an older fact of the same kind', async () => {
    const first = await createMemoryCandidate({
      kind: 'monthly_income',
      value: { amount: 1000000, currency: 'BRL' },
      originalText: 'Minha renda é dez mil reais.',
    });
    await resolveMemoryFact({ id: first.id, action: 'confirm' });

    const second = await createMemoryCandidate({
      kind: 'monthly_income',
      value: { amount: 1200000, currency: 'BRL' },
      originalText: 'Recebi uma promoção e agora ganho doze mil.',
    });
    await resolveMemoryFact({ id: second.id, action: 'confirm' });

    expect(await listMemoryFacts('confirmed')).toMatchObject([
      {
        id: second.id,
        value: { amount: 1200000, currency: 'BRL' },
        supersedesId: first.id,
      },
    ]);
    expect(await listMemoryFacts('superseded')).toMatchObject([
      { id: first.id, status: 'superseded' },
    ]);
  });

  it('rejects a candidate without exposing it as confirmed context', async () => {
    const candidate = await createMemoryCandidate({
      kind: 'risk_preference',
      value: 'conservative',
    });

    await resolveMemoryFact({ id: candidate.id, action: 'reject' });

    expect(await listMemoryFacts('confirmed')).toEqual([]);
    expect(await listMemoryFacts('rejected')).toHaveLength(1);
  });

  it('keeps sensitive memories out of retrieval unless explicitly allowed', async () => {
    const candidate = await createMemoryCandidate({
      kind: 'health_context',
      value: 'Tratamento médico em andamento',
      sensitivity: 'sensitive',
    });
    await resolveMemoryFact({ id: candidate.id, action: 'confirm' });

    expect(await searchAdvisorContext('tratamento médico')).toEqual([]);
    expect(await searchAdvisorContext('tratamento médico', 8, true)).toEqual([
      expect.objectContaining({ sourceId: candidate.id, sourceType: 'memory' }),
    ]);
  });

  it('does not retrieve facts outside their validity window', async () => {
    const candidate = await createMemoryCandidate({
      kind: 'temporary_income',
      value: 'Contrato encerrado',
      validTo: Date.now() - 1,
    });
    await resolveMemoryFact({ id: candidate.id, action: 'confirm' });

    expect(await searchAdvisorContext('contrato encerrado')).toEqual([]);
  });
});

describe('advisor goals, advice, and documents', () => {
  it('retrieves relevant structured and unstructured context', async () => {
    const goal = await createGoal({
      title: 'Comprar imóvel',
      description: 'Dar entrada em um apartamento em cinco anos.',
      priority: 1,
    });
    const fact = await createMemoryCandidate({
      kind: 'family_context',
      value: 'Pretende ter filhos antes da compra do imóvel.',
      originalText: 'Queremos ter filhos antes de comprar o apartamento.',
    });
    await resolveMemoryFact({ id: fact.id, action: 'confirm' });
    const document = await createDocument({
      title: 'Política de bônus',
      kind: 'employment',
      content:
        'O bônus anual depende das metas da empresa e não é renda garantida para financiar o imóvel.',
    });
    await createAdviceRecord({
      title: 'Reserva para entrada',
      recommendation: 'Separar a renda variável da capacidade mensal.',
      assumptions: ['Bônus não garantido'],
    });

    expect(await listGoals()).toMatchObject([{ id: goal.id }]);
    expect(await listAdviceRecords()).toHaveLength(1);
    expect(await searchAdvisorContext('renda para comprar imóvel')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: 'goal', sourceId: goal.id }),
        expect.objectContaining({
          sourceType: 'document',
          sourceId: document.id,
        }),
      ]),
    );

    await deleteDocument(document.id);
    expect(
      await db.first<{ count: number }>(
        'SELECT COUNT(*) AS count FROM ai_document_chunks WHERE document_id = ?',
        [document.id],
      ),
    ).toEqual({ count: 0 });
  });

  it('rebuilds derived chunks after a document arrives or changes through sync', async () => {
    const document = await createDocument({
      title: 'Benefício',
      kind: 'employment',
      content: 'Plano de saúde empresarial.',
    });
    await db.run('DELETE FROM ai_document_chunks WHERE document_id = ?', [
      document.id,
    ]);
    await db.run(
      `UPDATE ai_documents
          SET content = ?, updated_at = ?
        WHERE id = ?`,
      ['Auxílio creche para dependentes.', Date.now() + 1, document.id],
    );

    expect(await searchAdvisorContext('auxílio creche')).toEqual([
      expect.objectContaining({
        sourceType: 'document',
        sourceId: document.id,
        content: 'Auxílio creche para dependentes.',
      }),
    ]);
  });
});
