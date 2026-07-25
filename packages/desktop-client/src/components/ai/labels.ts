import type {
  AiAdviceRecordEntity,
  AiGoalEntity,
  AiRuleMetaEntity,
  AiRunEntity,
} from '@actual-app/core/types/models';
import type { TFunction } from 'i18next';

function humanizeIdentifier(value: string): string {
  const words = value.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : value;
}

function unreachable(value: never): never {
  throw new Error(`Unknown AI label value: ${String(value)}`);
}

export function aiAgentLabel(agent: string, t: TFunction): string {
  switch (agent) {
    case 'classifier':
      return t('Transaction classifier');
    case 'rule-miner':
      return t('Rule miner');
    case 'auditor':
      return t('Rule auditor');
    case 'advisor':
      return t('Financial advisor');
    default:
      return humanizeIdentifier(agent);
  }
}

export function aiTierLabel(tier: AiRunEntity['tier'], t: TFunction): string {
  switch (tier) {
    case 'fast':
      return t('Fast');
    case 'standard':
      return t('Standard');
    case 'frontier':
      return t('Frontier');
    default:
      return unreachable(tier);
  }
}

export function aiRunStatusLabel(
  status: AiRunEntity['status'],
  t: TFunction,
): string {
  switch (status) {
    case 'ok':
      return t('Completed');
    case 'error':
      return t('Error');
    default:
      return unreachable(status);
  }
}

export function ruleOperatorLabel(
  operator: AiRuleMetaEntity['op'],
  t: TFunction,
): string {
  switch (operator) {
    case 'contains':
      return t('contains');
    case 'matches':
      return t('matches');
    case 'oneOf':
      return t('is one of');
    default:
      return unreachable(operator);
  }
}

export function memoryKindLabel(kind: string, t: TFunction): string {
  switch (kind) {
    case 'life_stage':
      return t('Life stage');
    case 'monthly_income':
      return t('Monthly income');
    case 'risk_preference':
      return t('Risk preference');
    case 'health_context':
      return t('Health context');
    case 'temporary_income':
      return t('Temporary income');
    case 'family_context':
      return t('Family context');
    case 'employment':
      return t('Employment');
    default:
      return humanizeIdentifier(kind);
  }
}

export function goalStatusLabel(
  status: AiGoalEntity['status'],
  t: TFunction,
): string {
  switch (status) {
    case 'active':
      return t('Active');
    case 'paused':
      return t('Paused');
    case 'completed':
      return t('Completed');
    case 'cancelled':
      return t('Cancelled');
    default:
      return unreachable(status);
  }
}

export function documentKindLabel(kind: string, t: TFunction): string {
  switch (kind) {
    case 'user-note':
      return t('User note');
    default:
      return humanizeIdentifier(kind);
  }
}

export function adviceStatusLabel(
  status: AiAdviceRecordEntity['status'],
  t: TFunction,
): string {
  switch (status) {
    case 'proposed':
      return t('Proposed');
    case 'accepted':
      return t('Accepted');
    case 'rejected':
      return t('Rejected');
    case 'completed':
      return t('Completed');
    default:
      return unreachable(status);
  }
}
