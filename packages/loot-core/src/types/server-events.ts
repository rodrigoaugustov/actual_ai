import type { Backup } from '#server/budgetfiles/backups';
import type { UndoState } from '#server/undo';

import type { AiTracePart } from './models/ai';

type SyncSubtype =
  | 'out-of-sync'
  | 'apply-failure'
  | 'decrypt-failure'
  | 'encrypt-failure'
  | 'invalid-schema'
  | 'network'
  | 'file-old-version'
  | 'file-key-mismatch'
  | 'file-not-found'
  | 'file-needs-upload'
  | 'file-has-reset'
  | 'file-has-new-key'
  | 'token-expired'
  | string;

type SyncEvent = {
  meta?: Record<string, unknown>;
} & (
  | {
      type: 'applied';
      tables: string[];
      data?: Map<string, unknown>;
      prevData?: Map<string, unknown>;
    }
  | {
      type: 'success';
      tables: string[];
      syncDisabled?: boolean;
    }
  | {
      type: 'error';
      subtype?: SyncSubtype;
    }
  | {
      type: 'start';
    }
  | {
      type: 'unauthorized';
    }
);

type BackupUpdatedEvent = Backup[];

type CellsChangedEvent = Array<{
  name: string;
  value: string | number | boolean;
}>;

type FallbackWriteErrorEvent = undefined;
type FinishImportEvent = undefined;
type FinishLoadEvent = undefined;
type IndexeddbQuotaErrorEvent = undefined;

type OrphanedPayeesEvent = {
  orphanedIds: string[];
  updatedPayeeIds: string[];
};

type AiClassificationEvent = {
  // Absent for the manual "classify now" trigger, which can span accounts.
  accountId?: string;
  autoApplied: number;
  pendingReview: number;
};

type AiClassificationStartedEvent = {
  // Absent for the manual "classify now" trigger, which can span accounts.
  accountId?: string;
  count: number;
};

export type AiAdvisorEvent =
  | {
      type: 'started';
      runId: string;
      conversationId: string;
    }
  | {
      type: 'text-delta';
      runId: string;
      conversationId: string;
      text: string;
    }
  | {
      type: 'tool-call' | 'tool-result';
      runId: string;
      conversationId: string;
      toolName: string;
    }
  | {
      type: 'trace';
      runId: string;
      conversationId: string;
      trace: AiTracePart;
    }
  | {
      type: 'memory-candidate';
      runId: string;
      conversationId: string;
      candidateId: string;
    }
  | {
      type: 'completed';
      runId: string;
      conversationId: string;
      messageId: string;
    }
  | {
      type: 'cancelled' | 'error';
      runId: string;
      conversationId: string;
      message?: string;
    };

type PrefsUpdatedEvent = undefined;
type SchedulesOfflineEvent = undefined;
type ServerErrorEvent = undefined;
type ShowBudgetsEvent = undefined;
type StartImportEvent = { budgetName: string };
type StartLoadEvent = undefined;
type ApiFetchRedirectedEvent = undefined;

export type ServerEvents = {
  'ai-advisor-event': AiAdvisorEvent;
  'ai-classification-event': AiClassificationEvent;
  'ai-classification-started': AiClassificationStartedEvent;
  'backups-updated': BackupUpdatedEvent;
  'cells-changed': CellsChangedEvent;
  'fallback-write-error': FallbackWriteErrorEvent;
  'finish-import': FinishImportEvent;
  'finish-load': FinishLoadEvent;
  'indexeddb-quota-error': IndexeddbQuotaErrorEvent;
  'orphaned-payees': OrphanedPayeesEvent;
  'prefs-updated': PrefsUpdatedEvent;
  'schedules-offline': SchedulesOfflineEvent;
  'server-error': ServerErrorEvent;
  'show-budgets': ShowBudgetsEvent;
  'start-import': StartImportEvent;
  'start-load': StartLoadEvent;
  'sync-event': SyncEvent;
  'undo-event': UndoState;
  'api-fetch-redirected': ApiFetchRedirectedEvent;
};
