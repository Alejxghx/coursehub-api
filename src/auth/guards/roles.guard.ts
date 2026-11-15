import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { UserRole } from '../../users/user-role.enum.js';
import type { AuthenticatedUser } from '../types/jwt-payload.type.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles) return true;
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    return !!user && roles.includes(user.role);
  }
}
