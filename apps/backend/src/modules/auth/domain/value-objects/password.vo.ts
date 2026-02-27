import * as bcrypt from 'bcrypt';
import { DomainException } from '../../../../../../../libs/shared-kernel/src/domain/domain.exception';
import { ValueObject } from '../../../../../../../libs/shared-kernel/src/domain/value-object.base';

interface PasswordHashProps {
  hash: string;
}

export class PasswordHash extends ValueObject<PasswordHashProps> {
  private static readonly BCRYPT_ROUNDS = 12;

  private constructor(hash: string) {
    super({ hash });
  }

  protected validate(_props: PasswordHashProps): void {
    // hash is always valid after creation
  }

  static async fromPlaintext(password: string): Promise<PasswordHash> {
    if (!password || password.length < 8) {
      throw new DomainException('Password must be at least 8 characters', 'PASSWORD_TOO_SHORT');
    }
    if (password.length > 128) {
      throw new DomainException('Password too long', 'PASSWORD_TOO_LONG');
    }
    const hash = await bcrypt.hash(password, PasswordHash.BCRYPT_ROUNDS);
    return new PasswordHash(hash);
  }

  static fromHash(hash: string): PasswordHash {
    return new PasswordHash(hash);
  }

  async verify(plaintext: string): Promise<boolean> {
    return bcrypt.compare(plaintext, this.props.hash);
  }

  get hash(): string {
    return this.props.hash;
  }
}
