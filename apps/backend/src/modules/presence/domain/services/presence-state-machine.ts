import { DomainException } from '../../../../../../../libs/shared-kernel/src/domain/domain.exception';
import { PresenceStateValue } from '../value-objects/presence-state.vo';

type TransitionMatrix = Record<PresenceStateValue, PresenceStateValue[]>;

/**
 * State machine per DECISIONS.md Q6:
 * IDLE       → WORKING, CHATTING, RESTING, SMOKING
 * WORKING    → RESTING, SMOKING, CHATTING, IDLE
 * RESTING    → WORKING, CHATTING, IDLE
 * SMOKING    → WORKING, CHATTING, IDLE
 * CHATTING   → WORKING, RESTING, SMOKING, IDLE
 */
export const PRESENCE_TRANSITIONS: TransitionMatrix = {
  IDLE: ['WORKING', 'CHATTING', 'RESTING', 'SMOKING'],
  WORKING: ['RESTING', 'SMOKING', 'CHATTING', 'IDLE'],
  RESTING: ['WORKING', 'CHATTING', 'IDLE'],
  SMOKING: ['WORKING', 'CHATTING', 'IDLE'],
  CHATTING: ['WORKING', 'RESTING', 'SMOKING', 'IDLE'],
};

export class PresenceStateMachine {
  static validate(from: PresenceStateValue, to: PresenceStateValue): void {
    const allowed = PRESENCE_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new DomainException(
        `Invalid presence transition: ${from} → ${to}. Allowed from ${from}: ${allowed?.join(', ') ?? 'none'}`,
        'INVALID_PRESENCE_TRANSITION',
      );
    }
  }

  static canTransition(from: PresenceStateValue, to: PresenceStateValue): boolean {
    const allowed = PRESENCE_TRANSITIONS[from];
    return !!allowed && allowed.includes(to);
  }
}
