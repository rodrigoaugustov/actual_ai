import { useMemo } from 'react';
import { Provider } from 'react-redux';

import { QueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleGlobalEvents } from './global-events';
import { useSyncedPref } from './hooks/useSyncedPref';
import type * as PrefsSliceModule from './prefs/prefsSlice';
import { loadPrefs } from './prefs/prefsSlice';
import { configureAppStore } from './redux/store';

const connectionMocks = vi.hoisted(() => {
  return {
    listeners: new Map<string, (payload?: unknown) => void>(),
    syncedPreference: 'false',
  };
});

vi.mock('@actual-app/core/platform/client/connection', () => ({
  listen: vi.fn((name: string, callback: (payload?: unknown) => void) => {
    connectionMocks.listeners.set(name, callback);
    return () => connectionMocks.listeners.delete(name);
  }),
  send: vi.fn(),
}));

vi.mock('./prefs/prefsSlice', async importOriginal => {
  const actual = await importOriginal<typeof PrefsSliceModule>();
  return {
    ...actual,
    loadPrefs: vi.fn(() => (dispatch: (action: unknown) => void) => {
      dispatch(
        actual.mergeSyncedPrefs({
          separateTransfersFromSpending: connectionMocks.syncedPreference,
        }),
      );
    }),
  };
});

vi.mock('@actual-app/core/platform/client/undo', () => ({
  getTaggedState: vi.fn(() => null),
  setUndoState: vi.fn(),
}));

vi.mock('./sync-events', () => ({
  listenForSyncEvent: vi.fn(() => vi.fn()),
}));

function ActiveReport({
  createFactory,
}: {
  createFactory: (preference: string | undefined) => string;
}) {
  const [preference] = useSyncedPref('separateTransfersFromSpending');
  const result = useMemo(
    () => createFactory(preference),
    [createFactory, preference],
  );

  return <div data-testid="report-result">{result}</div>;
}

describe('global synced preference integration', () => {
  afterEach(() => {
    connectionMocks.listeners.clear();
    connectionMocks.syncedPreference = 'false';
  });

  it('updates Redux and an active report factory while Settings is unmounted', async () => {
    const queryClient = new QueryClient();
    const store = configureAppStore({ queryClient });
    const createFactory = vi.fn(preference => preference ?? 'missing');

    await store.dispatch(loadPrefs());
    const cleanup = handleGlobalEvents(store, queryClient);

    render(
      <Provider store={store}>
        <ActiveReport createFactory={createFactory} />
      </Provider>,
    );

    expect(screen.getByTestId('report-result')).toHaveTextContent('false');

    connectionMocks.syncedPreference = 'true';
    const onPrefsUpdated = connectionMocks.listeners.get('prefs-updated');
    expect(onPrefsUpdated).toBeTypeOf('function');
    await act(async () => {
      onPrefsUpdated?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(store.getState().prefs.synced.separateTransfersFromSpending).toBe(
      'true',
    );
    expect(screen.getByTestId('report-result')).toHaveTextContent('true');
    expect(createFactory).toHaveBeenLastCalledWith('true');

    cleanup();
    queryClient.clear();
  });
});
