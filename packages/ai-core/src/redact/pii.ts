// Order matters: CNPJ (14 digits) must run before the generic card-number
// pattern (13-19 raw digits), otherwise an unpunctuated CNPJ would also
// satisfy the card pattern and get double-processed harmlessly but
// wastefully. CPF (11 digits) never overlaps the card range (13-19) so its
// position relative to the card pattern doesn't matter.
const CNPJ_RE = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
// Each optional separator must be followed by another digit, so a trailing
// space (not part of the number) can never be swallowed into the match.
const CARD_RE = /\b\d(?:[ -]?\d){12,18}\b/g;
const CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
// A PIX random key is a bare UUID; PIX email/phone keys are already covered
// by EMAIL_RE and the long-digit-run cases above.
const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export function redactPii(text: string): string {
  return text
    .replace(CNPJ_RE, '[cnpj]')
    .replace(CARD_RE, '[card]')
    .replace(CPF_RE, '[cpf]')
    .replace(UUID_RE, '[pix-key]')
    .replace(EMAIL_RE, '[email]');
}
