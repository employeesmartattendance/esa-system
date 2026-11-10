/**
 * Electron Main Process
 * Secure BrowserWindow with contextIsolation, IPC handlers, system tray
 */
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const configManager = require('../agent/configManager');
const agentService = require('../agent/agentService');
const logger = require('../agent/logger');
const syncQueue = require('../agent/syncQueue');
const { createTray } = require('./tray');

const isDev = !app.isPackaged;
const VITE_DEV_SERVER = 'http://localhost:5173';

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 650,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#f5f5f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    logger.info('Main window shown');
  });

  mainWindow.on('close', (e) => {
    if (configManager.getConfigValue('runtime', 'minimizeToTray') !== false) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER);
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  tray = createTray(mainWindow);
}

// ── IPC Handlers: Config ──
ipcMain.handle('config:get-config', () => {
  return configManager.getConfig();
});

ipcMain.handle('config:set-config', (_e, partial) => {
  return configManager.setConfig(partial);
});

ipcMain.handle('config:migrate-old-config', () => {
  return configManager.migrateOldConfig();
});

// ── IPC Handlers: Device ──
ipcMain.handle('device:test-connection', async (_e, deviceOverride) => {
  return agentService.testDeviceConnection(deviceOverride);
});

ipcMain.handle('device:get-device-info', async (_e, deviceOverride) => {
  return agentService.getDeviceInfo(deviceOverride);
});

ipcMain.handle('device:set-network', async (_e, { host, port }) => {
  configManager.setConfigValue('device.host', host);
  if (port) configManager.setConfigValue('device.port', port);
  configManager.setConfigValue('device.source', 'manual');
  return { ok: true };
});

// ── IPC Handlers: Agent ──
ipcMain.handle('agent:start', async () => {
  return agentService.start();
});

ipcMain.handle('agent:stop', async () => {
  return agentService.stop();
});

ipcMain.handle('agent:get-status', () => {
  return agentService.getStatus();
});

ipcMain.handle('agent:restart', async () => {
  return agentService.restart();
});

// ── IPC Handlers: ESA ──
ipcMain.handle('esa:test', async () => {
  const esaConfig = configManager.getEsaConfig();
  if (!esaConfig.backendUrl || !esaConfig.agentToken) {
    return { ok: false, message: 'Backend URL and Agent Token are required' };
  }
  const { createEsaClient } = require('../agent/esaClient');
  const client = createEsaClient(esaConfig);
  if (!client) return { ok: false, message: 'Could not create ESA client' };
  return client.testConnection();
});

ipcMain.handle('esa:register', async (_e, { backendUrl, agentToken }) => {
  configManager.setConfigValue('esa.backendUrl', backendUrl);
  configManager.setConfigValue('esa.agentToken', agentToken);
  logger.esa('ESA connection configured');
  return { ok: true };
});

ipcMain.handle('esa:get-status', () => {
  const esaConfig = configManager.getEsaConfig();
  const status = agentService.getStatus();
  return {
    configured: !!(esaConfig.backendUrl && esaConfig.agentToken),
    backendUrl: esaConfig.backendUrl,
    connected: status.esaStatus === 'connected',
    esaStatus: status.esaStatus,
  };
});

// ── IPC Handlers: Fingerprint ──
ipcMain.handle('fingerprint:get-enrollments', () => {
  return agentService.getEnrollments();
});

ipcMain.handle('fingerprint:start-enrollment', async (_e, { employeeNo, fingerNo }) => {
  // This triggers through the agent command flow.
  // For manual enrollment testing, we can directly invoke.
  const device = agentService.getDevice();
  if (!device || !device.host) {
    return { ok: false, message: 'No device configured' };
  }
  try {
    const userResult = await require('../agent/deviceClient').ensureUserOnDevice(device, {
      employeeNo,
      name: `Employee ${employeeNo}`,
    });
    if (!userResult.ok) return { ok: false, message: userResult.message };

    const captureResult = await require('../agent/deviceClient').startFingerprintCapture(device, {
      employeeNo,
      fingerNo: fingerNo || 1,
    });
    return captureResult;
  } catch (err) {
    return { ok: false, message: err.message };
  }
});

// ── IPC Handlers: Logs ──
ipcMain.handle('logs:get', (_e, filter) => {
  return logger.getLogs(filter || {});
});

ipcMain.handle('logs:clear', () => {
  logger.clearLogs();
  return { ok: true };
});

ipcMain.handle('logs:export', async () => {
  const content = logger.exportLogs();
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `hikvision-agent-logs-${new Date().toISOString().slice(0, 10)}.txt`,
    filters: [{ name: 'Text Files', extensions: ['txt'] }],
  });
  if (!canceled && filePath) {
    const fs = require('fs');
    fs.writeFileSync(filePath, content, 'utf8');
    return { ok: true, path: filePath };
  }
  return { ok: false };
});

// ── IPC Handlers: Events ──
ipcMain.handle('events:get', () => {
  // Match events are transient; return recent ones from logs
  const logs = logger.getLogs({ category: 'DEVICE' });
  const matchEvents = logs
    .filter(l => l.message.includes('Fingerprint match'))
    .map(l => ({
      id: l.id,
      timestamp: l.timestamp,
      type: 'match',
      message: l.message,
    }));
  return matchEvents;
});

ipcMain.handle('events:clear', () => {
  return { ok: true };
});

// ── IPC Handlers: Settings ──
ipcMain.handle('settings:get', () => {
  return configManager.getConfig();
});

ipcMain.handle('settings:set', (_e, partial) => {
  return configManager.setConfig(partial);
});

// ── Window control IPC ──
ipcMain.handle('window:minimize', () => { mainWindow?.minimize(); });
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window:close', () => { mainWindow?.close(); });
ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() || false);

// ── App Lifecycle ──
app.whenReady().then(() => {
  configManager.migrateOldConfig();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    agentService.stop();
    app.quit();
  }
});

app.on('before-quit', async () => {
  await agentService.stop();
});

// Push agent status to renderer periodically
setInterval(() => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent:status-push', agentService.getStatus());
  }
}, 2000);

// Push enrollment updates to renderer
agentService.on('enrollment-update', (enrollments) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('fingerprint:enrollment-push', enrollments);
  }
});

agentService.on('match-event', (ev) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('events:match-push', ev);
  }
});
