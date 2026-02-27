import { DomainException } from '../../../../../../../libs/shared-kernel/src/domain/domain.exception';
import { ValueObject } from '../../../../../../../libs/shared-kernel/src/domain/value-object.base';

export type DepartmentTypeValue = 'WORK' | 'REST' | 'SMOKING' | 'FINANCE';

const VALID_TYPES: DepartmentTypeValue[] = ['WORK', 'REST', 'SMOKING', 'FINANCE'];

interface DepartmentTypeProps {
  value: DepartmentTypeValue;
}

export class DepartmentType extends ValueObject<DepartmentTypeProps> {
  constructor(value: string) {
    super({ value: value as DepartmentTypeValue });
  }

  protected validate(props: DepartmentTypeProps): void {
    if (!VALID_TYPES.includes(props.value)) {
      throw new DomainException(
        `Invalid department type: ${props.value}. Valid: ${VALID_TYPES.join(', ')}`,
        'DEPARTMENT_TYPE_INVALID',
      );
    }
  }

  get value(): DepartmentTypeValue {
    return this.props.value;
  }
}
