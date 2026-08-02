import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useReport, useReportPair } from './useReport';

const spreadsheetMock = vi.hoisted(() => ({ id: 'stable-spreadsheet' }));

vi.mock('#hooks/useSpreadsheet', () => ({
  useSpreadsheet: vi.fn(() => spreadsheetMock),
}));

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('useReport factory invalidation', () => {
  it('shows the new result and ignores a late result from the old preference', async () => {
    const oldRequest = deferred();
    const newRequest = deferred();
    const oldFactory = vi.fn(async (_spreadsheet, setData) => {
      await oldRequest.promise;
      setData('old-result');
    });
    const newFactory = vi.fn(async (_spreadsheet, setData) => {
      await newRequest.promise;
      setData('new-result');
    });

    const { result, rerender } = renderHook(
      ({ factory }) => useReport('report', factory),
      { initialProps: { factory: oldFactory } },
    );

    rerender({ factory: newFactory });
    expect(result.current).toBeNull();

    newRequest.resolve();
    await waitFor(() => expect(result.current).toBe('new-result'));

    oldRequest.resolve();
    await waitFor(() => expect(oldFactory).toHaveBeenCalledOnce());
    expect(result.current).toBe('new-result');
  });
});

describe('useReportPair atomic reconciliation', () => {
  it.each([
    ['graph first', 'first'],
    ['grouped first', 'second'],
  ] as const)(
    'publishes only the complete current pair when %s',
    async (_, firstToResolve) => {
      const firstRequest = deferred();
      const secondRequest = deferred();
      const firstFactory = vi.fn(async (_spreadsheet, setData) => {
        await firstRequest.promise;
        setData('graph');
      });
      const secondFactory = vi.fn(async (_spreadsheet, setData) => {
        await secondRequest.promise;
        setData('grouped');
      });

      const { result } = renderHook(() =>
        useReportPair(firstFactory, secondFactory),
      );

      if (firstToResolve === 'first') {
        firstRequest.resolve();
      } else {
        secondRequest.resolve();
      }
      await waitFor(() => {
        expect(firstFactory).toHaveBeenCalledOnce();
        expect(secondFactory).toHaveBeenCalledOnce();
      });
      expect(result.current).toEqual({ status: 'loading', data: null });

      if (firstToResolve === 'first') {
        secondRequest.resolve();
      } else {
        firstRequest.resolve();
      }
      await waitFor(() =>
        expect(result.current).toEqual({
          status: 'ready',
          data: { first: 'graph', second: 'grouped' },
        }),
      );
    },
  );

  it('ignores a late complete pair from the previous generation', async () => {
    const oldFirstRequest = deferred();
    const oldSecondRequest = deferred();
    const newFirstRequest = deferred();
    const newSecondRequest = deferred();
    const oldFirstFactory = vi.fn(async (_spreadsheet, setData) => {
      await oldFirstRequest.promise;
      setData('old-graph');
    });
    const oldSecondFactory = vi.fn(async (_spreadsheet, setData) => {
      await oldSecondRequest.promise;
      setData('old-grouped');
    });
    const newFirstFactory = vi.fn(async (_spreadsheet, setData) => {
      await newFirstRequest.promise;
      setData('new-graph');
    });
    const newSecondFactory = vi.fn(async (_spreadsheet, setData) => {
      await newSecondRequest.promise;
      setData('new-grouped');
    });

    const { result, rerender } = renderHook(
      ({ firstFactory, secondFactory }) =>
        useReportPair(firstFactory, secondFactory),
      {
        initialProps: {
          firstFactory: oldFirstFactory,
          secondFactory: oldSecondFactory,
        },
      },
    );

    rerender({
      firstFactory: newFirstFactory,
      secondFactory: newSecondFactory,
    });
    newFirstRequest.resolve();
    newSecondRequest.resolve();
    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'ready',
        data: { first: 'new-graph', second: 'new-grouped' },
      }),
    );

    oldFirstRequest.resolve();
    oldSecondRequest.resolve();
    await waitFor(() => expect(oldFirstFactory).toHaveBeenCalledOnce());
    expect(result.current).toEqual({
      status: 'ready',
      data: { first: 'new-graph', second: 'new-grouped' },
    });
  });

  it('returns an explicit error when either request rejects', async () => {
    const firstFactory = vi.fn(async () => {
      throw new Error('graph failed');
    });
    const secondFactory = vi.fn(async (_spreadsheet, setData) => {
      setData('grouped');
    });

    const { result } = renderHook(() =>
      useReportPair(firstFactory, secondFactory),
    );

    expect(result.current).toEqual({ status: 'loading', data: null });
    await waitFor(() =>
      expect(result.current).toEqual({ status: 'error', data: null }),
    );
  });

  it('returns an explicit error when either request completes without data', async () => {
    const firstFactory = vi.fn(async () => undefined);
    const secondFactory = vi.fn(async (_spreadsheet, setData) => {
      setData('grouped');
    });

    const { result } = renderHook(() =>
      useReportPair(firstFactory, secondFactory),
    );

    expect(result.current).toEqual({ status: 'loading', data: null });
    await waitFor(() =>
      expect(result.current).toEqual({ status: 'error', data: null }),
    );
  });
});
