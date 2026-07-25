import { installmentPreviewRows } from './CreateInstallmentPurchaseModal';

describe('installmentPreviewRows', () => {
  const preview = Array.from({ length: 36 }, (_, index) => -(index + 1));

  it('keeps a long preview compact while preserving the final installment', () => {
    expect(installmentPreviewRows(preview, false)).toEqual([
      { position: 1, amount: -1 },
      { position: 2, amount: -2 },
      { position: 3, amount: -3 },
      { position: 36, amount: -36 },
    ]);
  });

  it('returns every installment when expanded', () => {
    expect(installmentPreviewRows(preview, true)).toHaveLength(36);
  });
});
