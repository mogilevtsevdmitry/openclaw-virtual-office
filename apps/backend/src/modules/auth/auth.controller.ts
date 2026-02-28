import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { LoginUserUseCase } from './application/use-cases/login-user.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { RegisterDto } from './application/dto/register.dto';
import { LoginDto } from './application/dto/login.dto';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const result = await this.registerUserUseCase.execute(dto);
    return {
      userId: result.userId,
      email: result.email,
      tenantId: result.tenantId,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.loginUserUseCase.execute(dto);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/auth/refresh',
    });

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken, // for localStorage clients
      expiresIn: 300, // 5 minutes in seconds
      userId: result.userId,
      tenantId: result.tenantId,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Accept refresh token from httpOnly cookie OR from request body
    const refreshToken: string | undefined =
      req.cookies?.refreshToken ?? (req.body as { refreshToken?: string })?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided');
    }

    const result = await this.refreshTokenUseCase.execute(refreshToken);

    // Always set updated cookie as well (dual-mode support)
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth/refresh',
    });

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken, // also return in body for localStorage clients
    };
  }
}
