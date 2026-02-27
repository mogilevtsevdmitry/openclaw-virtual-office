import { DomainException } from '../../../../../../../libs/shared-kernel/src/domain/domain.exception';
import { ValueObject } from '../../../../../../../libs/shared-kernel/src/domain/value-object.base';

export type AgentRoleType = 'FRONTEND' | 'BACKEND' | 'DEVOPS' | 'FINANCIER' | 'DIRECTOR' | 'ARCHITECT';

const VALID_ROLES: AgentRoleType[] = ['FRONTEND', 'BACKEND', 'DEVOPS', 'FINANCIER', 'DIRECTOR', 'ARCHITECT'];

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
