import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: { roles?: string[] } }>();
    const roles = request.user?.roles || [];
    if (roles.includes('admin')) return true;
    throw new ForbiddenException('Admin role required');
  }
}
