import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions, ZoneScopeGuard } from '@campuscast/shared-libs';
import { assertZoneAccess, type ZoneAwareUser } from '../common/zone-access';
import { PublicationsEventsService } from './publications-events.service';

type AuthenticatedRequest = Request & {
  user?: ZoneAwareUser;
};

@Controller('api/v1/publications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PublicationsProxyController {
  private readonly contentServiceUrl = process.env.CONTENT_SERVICE_URL || 'http://localhost:3004';

  constructor(private readonly publicationsEvents: PublicationsEventsService) {}

  private async proxy(
    path: string,
    req: Request,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    body?: Record<string, unknown>,
  ) {
    const res = await fetch(`${this.contentServiceUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(req.headers['authorization'] ? { authorization: String(req.headers['authorization']) } : {}),
        ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(5000),
    });

    const text = await res.text();
    const payload = text ? JSON.parse(text) : {};
    if (!res.ok) throw new HttpException(payload as Record<string, any>, res.status);
    return payload;
  }

  private async ensurePublicationZoneAccess(publicationId: string, req: AuthenticatedRequest) {
    const publication = await this.proxy(`/content/publications/${encodeURIComponent(publicationId)}`, req, 'GET') as {
      zone_id?: string;
    };
    assertZoneAccess(req.user, publication?.zone_id, `publication:${publicationId}`);
  }

  @Get()
  @RequirePermissions('content.read')
  @UseGuards(ZoneScopeGuard)
  async list(
    @Query('zone_id') zoneId: string,
    @Query('page') page = 1,
    @Query('page_size') pageSize = 20,
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
  ) {
    const params = new URLSearchParams({
      zone_id: zoneId || '',
      page: String(page || 1),
      page_size: String(pageSize || 20),
    });
    if (status) params.set('status', status);
    return this.proxy(`/content/publications?${params.toString()}`, req, 'GET');
  }

  @Get(':publicationId')
  @RequirePermissions('content.read')
  async getById(@Param('publicationId') publicationId: string, @Req() req: AuthenticatedRequest) {
    await this.ensurePublicationZoneAccess(publicationId, req);
    return this.proxy(`/content/publications/${encodeURIComponent(publicationId)}`, req, 'GET');
  }

  @Post(':publicationId/copy')
  @RequirePermissions('content.write')
  @UseGuards(ZoneScopeGuard)
  async copy(
    @Param('publicationId') publicationId: string,
    @Body() body: { zone_id: string; title: string },
    @Req() req: AuthenticatedRequest,
  ) {
    await this.ensurePublicationZoneAccess(publicationId, req);
    const publication = await this.proxy(
      `/content/publications/${encodeURIComponent(publicationId)}/copy`,
      req,
      'POST',
      body,
    ) as { publication_id?: string; zone_id?: string };
    if (publication.publication_id && publication.zone_id) {
      this.publicationsEvents.publishChange({
        action: 'created',
        publication_id: publication.publication_id,
        zone_id: publication.zone_id,
      });
    }
    return publication;
  }

  @Patch(':publicationId')
  @RequirePermissions('content.write')
  async update(
    @Param('publicationId') publicationId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.ensurePublicationZoneAccess(publicationId, req);
    const publication = await this.proxy(
      `/content/publications/${encodeURIComponent(publicationId)}`,
      req,
      'PATCH',
      body,
    ) as { publication_id?: string; zone_id?: string };
    if (publication.publication_id && publication.zone_id) {
      this.publicationsEvents.publishChange({
        action: 'updated',
        publication_id: publication.publication_id,
        zone_id: publication.zone_id,
      });
    }
    return publication;
  }

  @Delete(':publicationId')
  @RequirePermissions('content.write')
  async archive(@Param('publicationId') publicationId: string, @Req() req: AuthenticatedRequest) {
    await this.ensurePublicationZoneAccess(publicationId, req);
    const publication = await this.proxy(
      `/content/publications/${encodeURIComponent(publicationId)}`,
      req,
      'DELETE',
    ) as { publication_id?: string; zone_id?: string };
    if (publication.publication_id && publication.zone_id) {
      this.publicationsEvents.publishChange({
        action: 'archived',
        publication_id: publication.publication_id,
        zone_id: publication.zone_id,
      });
    }
    return publication;
  }

  @Post()
  @RequirePermissions('content.write')
  @UseGuards(ZoneScopeGuard)
  async create(
    @Body() body: {
      zone_id: string;
      title: string;
      type?: string;
      status?: string;
      items?: Array<Record<string, unknown>>;
      metadata?: Record<string, unknown>;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    const publication = await this.proxy('/content/publications', req, 'POST', body) as {
      publication_id?: string;
      zone_id?: string;
    };
    if (publication.publication_id && publication.zone_id) {
      this.publicationsEvents.publishChange({
        action: 'created',
        publication_id: publication.publication_id,
        zone_id: publication.zone_id,
      });
    }
    return publication;
  }
}
