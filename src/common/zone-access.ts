import { ForbiddenException } from '@nestjs/common';

export type ZoneAwareUser = {
  roles?: string[];
  zone_ids?: string[];
};

export function hasFullZoneAccess(user?: ZoneAwareUser): boolean {
  const roles = user?.roles || [];
  return roles.includes('super_admin') || roles.includes('admin');
}

export function canAccessZone(user: ZoneAwareUser | undefined, zoneId: string | null | undefined): boolean {
  if (!zoneId) return true;
  if (hasFullZoneAccess(user)) return true;
  const allowedZones = new Set((user?.zone_ids || []).map(String));
  return allowedZones.has(String(zoneId));
}

export function assertZoneAccess(user: ZoneAwareUser | undefined, zoneId: string | null | undefined, context?: string): void {
  if (canAccessZone(user, zoneId)) return;
  const suffix = context ? ` (${context})` : '';
  throw new ForbiddenException(`Access denied for zone ${zoneId}${suffix}`);
}

export function filterByAssignedZones<T extends { zone_id: string }>(items: T[], user?: ZoneAwareUser): T[] {
  if (hasFullZoneAccess(user)) return items;
  const allowedZones = new Set((user?.zone_ids || []).map(String));
  return items.filter((item) => allowedZones.has(String(item.zone_id)));
}
