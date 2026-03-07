import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private static readonly logger = new Logger(JwtStrategy.name);

  constructor(configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    // SECURITY: fail-fast if JWT_SECRET is not set or is the insecure default
    if (!jwtSecret) {
      throw new Error(
        '[SECURITY] JWT_SECRET environment variable is not set. ' +
          'Set a strong random secret (min 32 chars) before starting the application.',
      );
    }
    if (jwtSecret.length < 32) {
      throw new Error(
        '[SECURITY] JWT_SECRET is too short (min 32 characters required).',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });

    JwtStrategy.logger.log('JwtStrategy initialized with secure secret.');
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.sub || !payload.tenantId) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return payload;
  }
}
