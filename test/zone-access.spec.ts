import { ForbiddenException } from '@nestjs/common';
import {
  assertZoneAccess,
  canAccessZone,
  filterByAssignedZones,
  hasFullZoneAccess,
} from '../src/common/zone-access';

describe('zone-access', () => {
  it('grants full access to admin/super_admin', () => {
    expect(hasFullZoneAccess({ roles: ['admin'] })).toBe(true);
    expect(hasFullZoneAccess({ roles: ['super_admin'] })).toBe(true);
    expect(hasFullZoneAccess({ roles: ['operator'] })).toBe(false);
  });

  it('enforces assigned zone for non-admin roles', () => {
    expect(canAccessZone({ roles: ['operator'], zone_ids: ['zone-a'] }, 'zone-a')).toBe(true);
    expect(canAccessZone({ roles: ['operator'], zone_ids: ['zone-a'] }, 'zone-b')).toBe(false);
  });

  it('filters collections by assigned zones', () => {
    const items = [
      { zone_id: 'zone-a', name: 'A' },
      { zone_id: 'zone-b', name: 'B' },
    ];
    expect(filterByAssignedZones(items, { roles: ['operator'], zone_ids: ['zone-b'] })).toEqual([
      { zone_id: 'zone-b', name: 'B' },
    ]);
    expect(filterByAssignedZones(items, { roles: ['admin'], zone_ids: [] })).toEqual(items);
  });

  it('throws ForbiddenException for denied zone', () => {
    expect(() => assertZoneAccess({ roles: ['viewer'], zone_ids: ['zone-a'] }, 'zone-b', 'schedule')).toThrow(
      ForbiddenException,
    );
  });
});
