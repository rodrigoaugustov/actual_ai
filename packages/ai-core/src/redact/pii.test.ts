import { describe, expect, it } from 'vitest';

import { redactPii } from './pii';

describe('redactPii', () => {
  it('redacts a punctuated CPF', () => {
    expect(redactPii('Pagamento para CPF 123.456.789-09')).toBe(
      'Pagamento para CPF [cpf]',
    );
  });

  it('redacts an unpunctuated CPF', () => {
    expect(redactPii('doc 12345678909 confirmado')).toBe(
      'doc [cpf] confirmado',
    );
  });

  it('redacts a punctuated CNPJ', () => {
    expect(redactPii('Empresa CNPJ 12.345.678/0001-95 Ltda')).toBe(
      'Empresa CNPJ [cnpj] Ltda',
    );
  });

  it('redacts an unpunctuated CNPJ (14 digits) as cnpj, not card', () => {
    expect(redactPii('cnpj 12345678000195 ok')).toBe('cnpj [cnpj] ok');
  });

  it('redacts a 16-digit card number with dashes', () => {
    expect(redactPii('cartao 4111-1111-1111-1111 final')).toBe(
      'cartao [card] final',
    );
  });

  it('redacts an email (e.g. a PIX email key)', () => {
    expect(redactPii('chave pix fulano@example.com aqui')).toBe(
      'chave pix [email] aqui',
    );
  });

  it('redacts a UUID-shaped PIX random key', () => {
    expect(
      redactPii('chave 550e8400-e29b-41d4-a716-446655440000 registrada'),
    ).toBe('chave [pix-key] registrada');
  });

  it('leaves ordinary transaction text untouched', () => {
    const text = 'Compra Supermercado Extra parcela 2/6';
    expect(redactPii(text)).toBe(text);
  });
});
