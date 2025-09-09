import client from 'prom-client';

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const httpRequests = new client.Counter({
  name: 'http_requests_total', help: 'HTTP requests', labelNames: ['method', 'route', 'status']
});
export const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds', help: 'HTTP request durations', labelNames: ['method', 'route', 'status'], buckets: [0.01,0.05,0.1,0.2,0.5,1,2,5]
});
export const wsEvents = new client.Counter({
  name: 'ws_events_total', help: 'WebSocket events processed', labelNames: ['namespace', 'event']
});
export const wsConnections = new client.Gauge({
  name: 'ws_connections', help: 'WebSocket connections', labelNames: ['namespace']
});

registry.registerMetric(httpRequests);
registry.registerMetric(httpDuration);
registry.registerMetric(wsEvents);
registry.registerMetric(wsConnections);

export function timedRoute(route: string) {
  return function(req: any, res: any, next: any) {
    const end = httpDuration.startTimer({ method: req.method, route });
    res.on('finish', () => {
      httpRequests.inc({ method: req.method, route, status: String(res.statusCode) });
      end({ status: String(res.statusCode) });
    });
    next();
  };
}

