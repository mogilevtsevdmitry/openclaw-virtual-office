import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { IUserRepository } from '../domain/user.repository.interface';
import { User } from '../domain/user.entity';
import { Email } from '../domain/value-objects/email.vo';
import { PasswordHash } from '../domain/value-objects/password.vo';

@Injectable()
export class UserPrismaRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async save(user: User): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email.value,
        passwordHash: user.passwordHash.hash,
        tenantId: user.tenantId,
        role: user.role,
        version: user.version,
      },
      update: {
        role: user.role,
        version: user.version,
        updatedAt: new Date(),
      },
    });
  }

  private toDomain(record: {
    id: string;
    email: string;
    passwordHash: string;
    tenantId: string;
    role: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return User.reconstitute(record.id, {
      email: new Email(record.email),
      passwordHash: PasswordHash.fromHash(record.passwordHash),
      tenantId: record.tenantId,
      role: record.role as 'USER' | 'ADMIN',
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
