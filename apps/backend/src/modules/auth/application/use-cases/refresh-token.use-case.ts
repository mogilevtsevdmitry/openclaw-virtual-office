import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IUserRepository, USER_REPOSITORY } from '../../domain/user.repository.interface';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(incomingToken: string): Promise<RefreshResult> {
    // Find all non-revoked, non-expired tokens and check hash
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let matchedToken: (typeof tokens)[0] | null = null;
    for (const token of tokens) {
      const isMatch = await bcrypt.compare(incomingToken, token.tokenHash);
      if (isMatch) {
        matchedToken = token;
        break;
      }
    }

    if (!matchedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: revoke old token
    await this.prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.userRepository.findById(matchedToken.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Issue new tokens
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

    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = await bcrypt.hash(newRefreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: newRefreshToken };
  }
}
