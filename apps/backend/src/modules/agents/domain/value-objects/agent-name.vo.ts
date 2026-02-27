import { DomainException } from '../../../../../../../libs/shared-kernel/src/domain/domain.exception';
import { ValueObject } from '../../../../../../../libs/shared-kernel/src/domain/value-object.base';

interface AgentNameProps {
  value: string;
}

export class AgentName extends ValueObject<AgentNameProps> {
  constructor(value: string) {
    super({ value: value.trim() });
  }

  protected validate(props: AgentNameProps): void {
    if (!props.value || props.value.length === 0) {
      throw new DomainException('Agent name cannot be empty', 'AGENT_NAME_EMPTY');
    }
    if (props.value.length < 2) {
      throw new DomainException('Agent name too short (min 2 chars)', 'AGENT_NAME_TOO_SHORT');
    }
    if (props.value.length > 100) {
      throw new DomainException('Agent name too long (max 100 chars)', 'AGENT_NAME_TOO_LONG');
    }
  }

  get value(): string {
    return this.props.value;
  }
}
