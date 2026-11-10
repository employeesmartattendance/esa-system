/**
 * ESA Backend HTTP Client
 * Extracted from the original index.js backendRequest function.
 * Talks to the ESA cloud backend over HTTPS.
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');
const logger = require('./logger');

function createEsaClient(config) {
  const { backendUrl, agentToken } = config;

  if (!backendUrl || !agentToken) {
    return null;
  }

  function request(method, path, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, backendUrl);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;
      const payload = body ? JSON.stringify(body) : null;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agentToken}`,
      };
      if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

      const req = lib.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
        timeout: 15000,
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch { /* non-JSON response */ }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json?.data !== undefined ? json.data : json);
          } else {
            const errMsg = json?.message || `Backend responded HTTP ${res.statusCode}`;
            logger.esa(`${method} ${path} failed: ${errMsg}`);
            reject(new Error(errMsg));
          }
        });
      });
      req.on('timeout', () => {
        req.destroy(new Error('Backend request timed out'));
      });
      req.on('error', (err) => {
        logger.esa(`Request error: ${err.message}`);
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  }

  return {
    getDeviceConfig() {
      return request('GET', '/api/hikvision/agent/device-config');
    },
    reportTestResult(result) {
      return request('POST', '/api/hikvision/agent/test-result', { ok: result.ok, message: result.message });
    },
    getCommands() {
      return request('GET', '/api/hikvision/agent/commands');
    },
    reportEnrollmentResult(data) {
      return request('POST', '/api/hikvision/agent/enrollment-result', data);
    },
    reportMatchEvent(data) {
      return request('POST', '/api/hikvision/agent/match-event', data);
    },
    testConnection() {
      return request('GET', '/api/hikvision/agent/device-config').then(data => {
        return { ok: true, message: 'Connected to ESA backend', data };
      }).catch(err => {
        return { ok: false, message: err.message };
      });
    },
  };
}

module.exports = { createEsaClient };
