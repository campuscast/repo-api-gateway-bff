# repo-api-gateway-bff

API Gateway / BFF — external REST + WSS entry point

## Local

- Install:       npm ci
- Build:       npm run build
- Test:       npm test -- --passWithNoTests

## Runtime

- Health:         GET /health
- Metrics:         GET /metrics
- BPMN-07 smoke:
  - `curl -i -X POST http://localhost/api/v1/zones -H "Authorization: Bearer $ADMIN_JWT" -H "Content-Type: application/json" -d '{"name":"zone-smoke","description":"smoke"}'`
  - `curl -i -X POST http://localhost/api/v1/policy/check -H "Authorization: Bearer $ADMIN_JWT" -H "Content-Type: application/json" -d '{"zone_id":"<zone_id>","action":"sync:ingest","resource_id":"schedule"}'`
