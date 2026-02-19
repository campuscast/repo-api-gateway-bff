import { Controller, Post, Body, HttpCode } from '@nestjs/common';

@Controller('api/v1/auth')
export class AuthProxyController {
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string }) {
    // Proxy to repo-auth-iam via gRPC/HTTP
    // Stub: return mock tokens
    return {
      access_token: 'stub.jwt.token',
      refresh_token: 'stub.refresh.token',
      expires_in: 3600,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: { refresh_token: string }) {
    return {
      access_token: 'stub.new.jwt.token',
      refresh_token: 'stub.new.refresh.token',
      expires_in: 3600,
    };
  }
}
