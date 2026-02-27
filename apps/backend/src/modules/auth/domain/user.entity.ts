import { AggregateRoot } from '../../../../../../libs/shared-kernel/src/domain/aggregate-root.base';
import { Email } from './value-objects/email.vo';
import { PasswordHash } from './value-objects/password.vo';

export type UserRole = 'USER' | 'ADMIN';

export interface UserProps {
  email: Email;
  passwordHash: PasswordHash;
  tenantId: string;
  role: UserRole;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class User extends AggregateRoot<string> {
  private readonly _email: Email;
  private readonly _passwordHash: PasswordHash;
  private readonly _tenantId: string;
  private _role: UserRole;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(id: string, props: UserProps) {
    super(id);
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._tenantId = props.tenantId;
    this._role = props.role;
    this._version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(params: {
    id?: string;
    email: Email;
    passwordHash: PasswordHash;
    tenantId: string;
    role?: UserRole;
  }): User {
    const now = new Date();
    return new User(params.id ?? crypto.randomUUID(), {
      email: params.email,
      passwordHash: params.passwordHash,
      tenantId: params.tenantId,
      role: params.role ?? 'USER',
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: string, props: UserProps): User {
    return new User(id, props);
  }

  get email(): Email {
    return this._email;
  }

  get passwordHash(): PasswordHash {
    return this._passwordHash;
  }

  get tenantId(): string {
    return this._tenantId;
  }

  get role(): UserRole {
    return this._role;
  }

  async verifyPassword(plaintext: string): Promise<boolean> {
    return this._passwordHash.verify(plaintext);
  }
}
