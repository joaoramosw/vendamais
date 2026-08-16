import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { EmpresarioUser } from './empresario-auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): EmpresarioUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as EmpresarioUser;
  },
);
