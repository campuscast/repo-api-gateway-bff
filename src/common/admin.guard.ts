import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { hasFullZoneAccess } from './zone-access';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: { roles?: string[] } }>();
    if (hasFullZoneAccess(request.user)) return true;
    throw new ForbiddenException('Admin role required');
  }
}
