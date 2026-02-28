import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IUserRepository, USER_REPOSITORY } from '../../domain/user.repository.interface';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { LoginDto } from '../dto/login.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  userId: string;
  tenantId: string;
}

@Injectable()
export class LoginUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: LoginDto): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await user.verifyPassword(dto.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email.value,
      tenantId: user.tenantId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '5m',
    });

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      userId: user.id,
      tenantId: user.tenantId,
    };
  }
}
