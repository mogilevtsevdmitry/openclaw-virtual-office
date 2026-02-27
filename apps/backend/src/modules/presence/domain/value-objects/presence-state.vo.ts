import { DomainException } from '../../../../../../../libs/shared-kernel/src/domain/domain.exception';
import { ValueObject } from '../../../../../../../libs/shared-kernel/src/domain/value-object.base';

export type PresenceStateValue = 'IDLE' | 'WORKING' | 'RESTING' | 'SMOKING' | 'CHATTING';

const VALID_STATES: PresenceStateValue[] = ['IDLE', 'WORKING', 'RESTING', 'SMOKING', 'CHATTING'];

interface PresenceStateProps {
  value: PresenceStateValue;
}

export class PresenceState extends ValueObject<PresenceStateProps> {
  constructor(value: string) {
    super({ value: value as PresenceStateValue });
  }

  protected validate(props: PresenceStateProps): void {
    if (!VALID_STATES.includes(props.value)) {
      throw new DomainException(
        `Invalid presence state: ${props.value}. Valid: ${VALID_STATES.join(', ')}`,
        'PRESENCE_STATE_INVALID',
      );
    }
  }

  get value(): PresenceStateValue {
    return this.props.value;
  }

  static idle(): PresenceState {
    return new PresenceState('IDLE');
  }
}
