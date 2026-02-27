import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../infrastructure/jwt.strategy';

export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    return user?.tenantId;
  },
);
