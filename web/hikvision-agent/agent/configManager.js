/**
 * Secure Configuration Manager
 * Uses electron-store with encryption for sensitive data
 */
const Store = require('electron-store');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

const store = new Store({
  name: 'hikvision-agent-config',
  encryptionKey: 'esa-hikvision-agent-secure-key-2024-v2',
});

const DEFAULT_CONFIG = {
  setupCompleted: false,
  currentStep: 0,
  // ESA Backend
  esa: {
    backendUrl: '',
    agentToken: '',
  },
  // Device (can come from ESA or be manually set)
  device: {
    host: '',
    port: 80,
    username: 'admin',
    password: '',
    source: 'manual', // 'manual' or 'esa'
  },
  // Polling intervals
  polling: {
    commandPollMs: 4000,
    eventPollMs: 4000,
    configRefreshMs: 60000,
  },
  // Runtime
  runtime: {
    startMinimized: false,
    minimizeToTray: true,
    autoStart: false,
    showNotifications: true,
  },
};

function getConfig() {
  const saved = {};
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    const val = store.get(key);
    if (val !== undefined) {
      saved[key] = val;
    } else {
      saved[key] = JSON.parse(JSON.stringify(DEFAULT_CONFIG[key]));
    }
  }
  return saved;
}

function setConfig(partial) {
  for (const [key, value] of Object.entries(partial)) {
    store.set(key, value);
  }
  logger.info('Configuration updated', { keys: Object.keys(partial) });
  return getConfig();
}

function getConfigValue(key, subKey) {
  if (subKey !== undefined) {
    return store.get(`${key}.${subKey}`, DEFAULT_CONFIG[key]?.[subKey]);
  }
  return store.get(key, DEFAULT_CONFIG[key]);
}

function setConfigValue(key, value) {
  store.set(key, value);
}

function isSetupComplete() {
  return store.get('setupCompleted', false);
}

function markSetupComplete() {
  store.set('setupCompleted', true);
  store.set('currentStep', 0);
  logger.success('Setup marked as complete');
}

function getEsaConfig() {
  return {
    backendUrl: store.get('esa.backendUrl', ''),
    agentToken: store.get('esa.agentToken', ''),
  };
}

function getDeviceConfig() {
  return {
    host: store.get('device.host', ''),
    port: store.get('device.port', 80),
    username: store.get('device.username', 'admin'),
    password: store.get('device.password', ''),
    source: store.get('device.source', 'manual'),
  };
}

function getPollingConfig() {
  return {
    commandPollMs: store.get('polling.commandPollMs', 4000),
    eventPollMs: store.get('polling.eventPollMs', 4000),
    configRefreshMs: store.get('polling.configRefreshMs', 60000),
  };
}

function getRuntimeConfig() {
  return {
    startMinimized: store.get('runtime.startMinimized', false),
    minimizeToTray: store.get('runtime.minimizeToTray', true),
    autoStart: store.get('runtime.autoStart', false),
    showNotifications: store.get('runtime.showNotifications', true),
  };
}

/**
 * Attempt to migrate from old config.js file if present
 */
function migrateOldConfig() {
  const configPaths = [
    path.join(__dirname, '../config.js'),
    path.join(process.cwd(), 'config.js'),
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const oldConfig = require(configPath);
        logger.info('Found old config.js, migrating...');

        const updates = {};
        if (oldConfig.backendUrl) {
          updates['esa.backendUrl'] = oldConfig.backendUrl;
        }
        if (oldConfig.agentToken) {
          updates['esa.agentToken'] = oldConfig.agentToken;
        }
        if (oldConfig.deviceCommandPollMs) {
          updates['polling.commandPollMs'] = oldConfig.deviceCommandPollMs;
        }
        if (oldConfig.eventPollMs) {
          updates['polling.eventPollMs'] = oldConfig.eventPollMs;
        }

        if (Object.keys(updates).length > 0) {
          for (const [k, v] of Object.entries(updates)) {
            store.set(k, v);
          }
          // If we have backend URL and token, mark ESA as configured
          if (oldConfig.backendUrl && oldConfig.agentToken) {
            store.set('setupCompleted', true);
            store.set('device.source', 'esa');
          }
          logger.success(`Migrated ${Object.keys(updates).length} settings from config.js`);
          return { migrated: true, count: Object.keys(updates).length };
        }
      } catch (err) {
        logger.warning('Could not migrate old config.js', { error: err.message });
      }
    }
  }
  return { migrated: false };
}

function resetConfig() {
  store.clear();
  logger.security('Configuration has been reset');
}

module.exports = {
  getConfig,
  setConfig,
  getConfigValue,
  setConfigValue,
  isSetupComplete,
  markSetupComplete,
  getEsaConfig,
  getDeviceConfig,
  getPollingConfig,
  getRuntimeConfig,
  migrateOldConfig,
  resetConfig,
  DEFAULT_CONFIG,
};
