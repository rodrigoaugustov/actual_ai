import type { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleGlobalEvents } from './global-events';
import type { AppStore } from './redux/store';

const connectionMocks = vi.hoisted(() => {
  return {
    listeners: new Map<string, (payload?: unknown) => void>(),
    unlisteners: new Map<string, ReturnType<typeof vi.fn>>(),
  };
});

const loadPrefsMock = vi.hoisted(() => vi.fn(() => ({ type: 'prefs/load' })));
const unlistenSyncMock = vi.hoisted(() => vi.fn());

vi.mock('@actual-app/core/platform/client/connection', () => ({
  listen: vi.fn((name: string, callback: (payload?: unknown) => void) => {
    connectionMocks.listeners.set(name, callback);
    const unlisten = vi.fn(() => connectionMocks.listeners.delete(name));
    connectionMocks.unlisteners.set(name, unlisten);
    return unlisten;
  }),
}));

vi.mock('@actual-app/core/platform/client/undo', () => ({
  getTaggedState: vi.fn(() => null),
  setUndoState: vi.fn(),
}));

vi.mock('./prefs/prefsSlice', () => ({
  loadPrefs: loadPrefsMock,
}));

vi.mock('./sync-events', () => ({
  listenForSyncEvent: vi.fn(() => unlistenSyncMock),
}));

describe('global preference events', () => {
  beforeEach(() => {
    connectionMocks.listeners.clear();
    connectionMocks.unlisteners.clear();
    loadPrefsMock.mockClear();
    unlistenSyncMock.mockClear();
  });

  it('reloads synced preferences globally and cleans up one listener', () => {
    const dispatch = vi.fn();
    const store = {
      dispatch,
      getState: vi.fn(() => ({ modals: { modalStack: [] } })),
    } as unknown as AppStore;
    const queryClient = {
      invalidateQueries: vi.fn(),
    } as unknown as QueryClient;

    const cleanup = handleGlobalEvents(store, queryClient);
    const prefsUpdated = connectionMocks.listeners.get('prefs-updated');

    expect(prefsUpdated).toBeDefined();
    expect(
      [...connectionMocks.listeners.keys()].filter(
        eventName => eventName === 'prefs-updated',
      ),
    ).toHaveLength(1);

    prefsUpdated?.();

    expect(loadPrefsMock).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: 'prefs/load' });

    cleanup();

    expect(connectionMocks.unlisteners.get('prefs-updated')).toHaveBeenCalled();
    expect(connectionMocks.listeners.has('prefs-updated')).toBe(false);
  });
});
