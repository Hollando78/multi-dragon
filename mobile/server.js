import express from 'express';
import compression from 'compression';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = parseInt(process.env.MOBILE_PORT || process.env.PORT || '3010', 10);

// Support both Docker internal networking and external access
const API_BASE = process.env.API_BASE || 
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3004' : 'http://api:3004');

app.use(compression());

// Proxy API and socket.io to backend API BEFORE static middleware
app.use('/api', createProxyMiddleware({ 
  target: API_BASE, 
  changeOrigin: true, 
  pathRewrite: { '^/api': '' },
  onError: (err, req, res) => {
    console.error('API Proxy Error:', err.message);
    res.status(500).json({ error: 'API proxy failed' });
  }
}));

// Explicitly handle Socket.IO paths
app.use('/socket.io/*', createProxyMiddleware({ 
  target: API_BASE, 
  changeOrigin: true, 
  ws: true,
  onError: (err, req, res) => {
    console.error('Socket.IO Proxy Error:', err.message);
    res.status(500).json({ error: 'Socket.IO proxy failed' });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[SOCKET.IO PROXY] ${req.method} ${req.url} -> ${API_BASE}${req.url}`);
  }
}));

// Proxy WS namespaces to API (e.g., /world/:seed)
app.use('/world', createProxyMiddleware({ 
  target: API_BASE, 
  changeOrigin: true, 
  ws: true,
  onError: (err, req, res) => {
    console.error('World Proxy Error:', err.message);
    res.status(500).json({ error: 'World proxy failed' });
  }
}));

// Serve static files (public directory)
app.use(express.static('public', { 
  maxAge: '1h', 
  extensions: ['html'],
  index: ['index.html']
}));

app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mobile client running on http://0.0.0.0:${PORT}`);
  console.log(`API proxy target: ${API_BASE}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
