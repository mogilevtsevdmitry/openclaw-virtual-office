import { DomainException } from '../../../../../../../libs/shared-kernel/src/domain/domain.exception';
import { ValueObject } from '../../../../../../../libs/shared-kernel/src/domain/value-object.base';

export type AgentRoleType = 'WORKER' | 'MANAGER' | 'ARCHIVIST' | 'FINANCIER' | 'DIRECTOR';

const VALID_ROLES: AgentRoleType[] = ['WORKER', 'MANAGER', 'ARCHIVIST', 'FINANCIER', 'DIRECTOR'];

interface AgentRoleProps {
  value: AgentRoleType;
}

export class AgentRole extends ValueObject<AgentRoleProps> {
  constructor(value: string) {
    super({ value: value as AgentRoleType });
  }

  protected validate(props: AgentRoleProps): void {
    if (!VALID_ROLES.includes(props.value)) {
      throw new DomainException(
        `Invalid agent role: ${props.value}. Valid: ${VALID_ROLES.join(', ')}`,
        'AGENT_ROLE_INVALID',
      );
    }
  }

  get value(): AgentRoleType {
    return this.props.value;
  }
}
