import { DomainException } from '../../../../../../../libs/shared-kernel/src/domain/domain.exception';
import { ValueObject } from '../../../../../../../libs/shared-kernel/src/domain/value-object.base';

interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(value: string) {
    super({ value: value.toLowerCase().trim() });
  }

  protected validate(props: EmailProps): void {
    if (!props.value || props.value.length === 0) {
      throw new DomainException('Email cannot be empty', 'EMAIL_EMPTY');
    }
    if (!Email.EMAIL_REGEX.test(props.value)) {
      throw new DomainException(`Invalid email format: ${props.value}`, 'EMAIL_INVALID');
    }
    if (props.value.length > 254) {
      throw new DomainException('Email too long', 'EMAIL_TOO_LONG');
    }
  }

  get value(): string {
    return this.props.value;
  }
}
