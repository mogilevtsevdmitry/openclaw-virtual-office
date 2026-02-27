import { Injectable, ConflictException, Inject } from '@nestjs/common';
import { IUserRepository, USER_REPOSITORY } from '../../domain/user.repository.interface';
import { User } from '../../domain/user.entity';
import { Email } from '../../domain/value-objects/email.vo';
import { PasswordHash } from '../../domain/value-objects/password.vo';
import { RegisterDto } from '../dto/register.dto';

export interface RegisterResult {
  userId: string;
  email: string;
  tenantId: string;
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(dto: RegisterDto): Promise<RegisterResult> {
    const email = new Email(dto.email);

    const existing = await this.userRepository.findByEmail(email.value);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await PasswordHash.fromPlaintext(dto.password);

    const user = User.create({
      email,
      passwordHash,
      tenantId: dto.tenantId,
      role: 'USER',
    });

    await this.userRepository.save(user);

    return {
      userId: user.id,
      email: user.email.value,
      tenantId: user.tenantId,
    };
  }
}
