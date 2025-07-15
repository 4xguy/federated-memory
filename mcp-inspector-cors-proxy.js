const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 6275; // Different port from MCP Inspector

// Enable CORS for all origins
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-mcp-proxy-auth', 'mcp-session-id']
}));

// Proxy all requests to MCP Inspector
app.use('/', createProxyMiddleware({
  target: 'http://127.0.0.1:6274',
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    console.log(`Proxying ${req.method} ${req.path} to MCP Inspector`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Add CORS headers to the response
    proxyRes.headers['access-control-allow-origin'] = '*';
    proxyRes.headers['access-control-allow-credentials'] = 'true';
  }
}));

app.listen(PORT, () => {
  console.log(`CORS proxy for MCP Inspector running on http://localhost:${PORT}`);
  console.log('Use this URL in MCP Inspector instead of localhost:6274');
});