/**
 * Secure Preload Script
 * Exposes only controlled IPC methods via contextBridge.
 * No direct Node.js or Electron access in the renderer.
 */
const { contextBridge, ipcRenderer } = require('electron');

const api = {
  // ── Window controls ──
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximizedChange: (callback) => {
      const handler = (_e, val) => callback(val);
      ipcRenderer.on('window:maximized-changed', handler);
      return () => ipcRenderer.removeListener('window:maximized-changed', handler);
    },
  },

  // ── Config ──
  config: {
    get: () => ipcRenderer.invoke('config:get-config'),
    set: (partial) => ipcRenderer.invoke('config:set-config', partial),
    migrateOld: () => ipcRenderer.invoke('config:migrate-old-config'),
  },

  // ── Device ──
  device: {
    testConnection: (override) => ipcRenderer.invoke('device:test-connection', override),
    getDeviceInfo: (override) => ipcRenderer.invoke('device:get-device-info', override),
    setNetwork: (config) => ipcRenderer.invoke('device:set-network', config),
  },

  // ── Agent ──
  agent: {
    start: () => ipcRenderer.invoke('agent:start'),
    stop: () => ipcRenderer.invoke('agent:stop'),
    getStatus: () => ipcRenderer.invoke('agent:get-status'),
    restart: () => ipcRenderer.invoke('agent:restart'),
    onStatusPush: (callback) => {
      const handler = (_e, status) => callback(status);
      ipcRenderer.on('agent:status-push', handler);
      return () => ipcRenderer.removeListener('agent:status-push', handler);
    },
  },

  // ── ESA ──
  esa: {
    test: () => ipcRenderer.invoke('esa:test'),
    register: (config) => ipcRenderer.invoke('esa:register', config),
    getStatus: () => ipcRenderer.invoke('esa:get-status'),
  },

  // ── Fingerprint ──
  fingerprint: {
    getEnrollments: () => ipcRenderer.invoke('fingerprint:get-enrollments'),
    startEnrollment: (data) => ipcRenderer.invoke('fingerprint:start-enrollment', data),
    onEnrollmentPush: (callback) => {
      const handler = (_e, enrollments) => callback(enrollments);
      ipcRenderer.on('fingerprint:enrollment-push', handler);
      return () => ipcRenderer.removeListener('fingerprint:enrollment-push', handler);
    },
  },

  // ── Logs ──
  logs: {
    get: (filter) => ipcRenderer.invoke('logs:get', filter),
    clear: () => ipcRenderer.invoke('logs:clear'),
    export: () => ipcRenderer.invoke('logs:export'),
  },

  // ── Events ──
  events: {
    get: () => ipcRenderer.invoke('events:get'),
    clear: () => ipcRenderer.invoke('events:clear'),
    onMatchPush: (callback) => {
      const handler = (_e, ev) => callback(ev);
      ipcRenderer.on('events:match-push', handler);
      return () => ipcRenderer.removeListener('events:match-push', handler);
    },
  },

  // ── Settings ──
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (partial) => ipcRenderer.invoke('settings:set', partial),
  },
};

contextBridge.exposeInMainWorld('agentAPI', api);
