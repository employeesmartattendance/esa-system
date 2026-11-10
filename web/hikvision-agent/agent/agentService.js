/**
 * Core Agent Service
 * Manages the agent loop: commands, events, device config refresh, health.
 * Extracted and enhanced from the original index.js main loop.
 */
const deviceClient = require('./deviceClient');
const { createEsaClient } = require('./esaClient');
const configManager = require('./configManager');
const logger = require('./logger');
const syncQueue = require('./syncQueue');

class AgentService {
  constructor() {
    this.running = false;
    this.cachedDevice = null;
    this.deviceCursor = new Date(Date.now() - 60 * 1000).toISOString().slice(0, 19);
    this.commandsInFlight = false;
    this.esaClient = null;
    this.intervals = [];
    this.stats = {
      commandsProcessed: 0,
      eventsReported: 0,
      errors: 0,
      lastCommandAt: null,
      lastEventAt: null,
      lastConfigRefresh: null,
      lastErrorAt: null,
      uptimeStart: null,
      consecutiveErrors: 0,
    };
    this.enrollments = []; // Track active enrollments
    this.eventListeners = new Map();
  }

  on(event, fn) {
    if (!this.eventListeners.has(event)) this.eventListeners.set(event, []);
    this.eventListeners.get(event).push(fn);
  }

  off(event, fn) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    }
  }

  emit(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const fn of listeners) {
        try { fn(data); } catch (err) { logger.error('Event listener error', { event, error: err.message }); }
      }
    }
  }

  getDevice() {
    // If device source is 'esa', use cached device config from ESA
    if (this.cachedDevice && configManager.getConfigValue('device', 'source') === 'esa') {
      return this.cachedDevice;
    }
    // Otherwise use manual device config
    return configManager.getDeviceConfig();
  }

  rebuildEsaClient() {
    const esaConfig = configManager.getEsaConfig();
    if (esaConfig.backendUrl && esaConfig.agentToken) {
      this.esaClient = createEsaClient(esaConfig);
      return true;
    }
    this.esaClient = null;
    return false;
  }

  async start() {
    if (this.running) {
      logger.warning('Agent is already running');
      return { ok: false, message: 'Agent is already running' };
    }

    logger.info('Starting ESA Hikvision Bridge Agent...');

    if (!this.rebuildEsaClient()) {
      logger.error('Cannot start agent: ESA backend not configured');
      return { ok: false, message: 'ESA backend not configured. Please complete setup first.' };
    }

    this.running = true;
    this.stats.uptimeStart = new Date().toISOString();
    this.stats.consecutiveErrors = 0;
    this.emit('status-change', this.getStatus());

    // Initial device config refresh and test
    try {
      await this.refreshDeviceConfig();
      await this.testConnectionOnce();
    } catch (err) {
      logger.warning('Initial connection test failed (will retry on loop)', { error: err.message });
    }

    // Start polling loops
    const polling = configManager.getPollingConfig();

    const cmdInterval = setInterval(() => {
      this.processCommands().catch(err => {
        logger.error('Command loop error', { error: err.message });
        this.recordError(err);
      });
    }, polling.commandPollMs);

    const evtInterval = setInterval(() => {
      this.pollMatchEvents().catch(err => {
        logger.error('Match-event loop error', { error: err.message });
        this.recordError(err);
      });
    }, polling.eventPollMs);

    const cfgInterval = setInterval(() => {
      this.refreshDeviceConfig().catch(err => {
        logger.error('Config refresh error', { error: err.message });
      });
    }, polling.configRefreshMs);

    this.intervals = [cmdInterval, evtInterval, cfgInterval];

    // Sync offline queue
    this.syncOfflineQueue();

    logger.success('Bridge agent is now running');
    this.emit('status-change', this.getStatus());
    return { ok: true, message: 'Agent started successfully' };
  }

  async stop() {
    if (!this.running) return { ok: true, message: 'Agent not running' };

    logger.info('Stopping agent...');
    this.running = false;

    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];

    this.cachedDevice = null;
    this.esaClient = null;

    this.emit('status-change', this.getStatus());
    logger.info('Agent stopped');
    return { ok: true, message: 'Agent stopped' };
  }

  async restart() {
    await this.stop();
    await new Promise(r => setTimeout(r, 500));
    return this.start();
  }

  recordError(err) {
    this.stats.errors++;
    this.stats.lastErrorAt = new Date().toISOString();
    this.stats.consecutiveErrors++;
    this.emit('status-change', this.getStatus());
  }

  async refreshDeviceConfig() {
    if (!this.esaClient) return null;
    try {
      this.cachedDevice = await this.esaClient.getDeviceConfig();
      this.stats.lastConfigRefresh = new Date().toISOString();
      this.stats.consecutiveErrors = 0;
      logger.device('Device config refreshed from ESA', {
        host: this.cachedDevice?.host,
      });
      this.emit('status-change', this.getStatus());
      return this.cachedDevice;
    } catch (err) {
      this.recordError(err);
      return null;
    }
  }

  async testConnectionOnce() {
    const device = this.getDevice();
    if (!device || !device.host) {
      logger.warning('Cannot test connection: no device configured');
      return;
    }
    try {
      const result = await deviceClient.testConnection(device);
      if (this.esaClient) {
        await this.esaClient.reportTestResult({ ok: result.ok, message: result.message });
      }
      if (result.ok) {
        logger.success(`Connected to device: ${result.deviceName || 'Hikvision terminal'} (${result.model || 'unknown model'})`);
        this.stats.consecutiveErrors = 0;
      } else {
        logger.warning(`Could not reach device: ${result.message}`);
      }
      this.emit('device-test', result);
      this.emit('status-change', this.getStatus());
      return result;
    } catch (err) {
      logger.error('Startup connection test failed', { error: err.message });
      this.emit('device-test', { ok: false, message: err.message });
      this.recordError(err);
      return { ok: false, message: err.message };
    }
  }

  async testDeviceConnection(deviceOverride) {
    const device = deviceOverride || this.getDevice();
    if (!device || !device.host) {
      return { ok: false, message: 'No device configured (host missing)' };
    }
    try {
      const result = await deviceClient.testConnection(device);
      this.emit('device-test', result);
      return result;
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }

  async getDeviceInfo(deviceOverride) {
    const device = deviceOverride || this.getDevice();
    if (!device || !device.host) {
      return { ok: false, message: 'No device configured' };
    }
    return this.testDeviceConnection(device);
  }

  async processCommands() {
    if (!this.cachedDevice || this.commandsInFlight) return;
    if (!this.esaClient) return;

    let commands = [];
    try {
      commands = await this.esaClient.getCommands();
    } catch (err) {
      logger.error('Could not fetch commands', { error: err.message });
      return;
    }

    if (!Array.isArray(commands) || !commands.length) return;

    this.commandsInFlight = true;
    logger.info(`Processing ${commands.length} command(s)`);

    try {
      for (const cmd of commands) {
        try {
          if (cmd.type === 'start_capture') {
            await this.handleStartCapture(cmd);
          } else if (cmd.type === 'delete_user') {
            await this.handleDeleteUser(cmd);
          }
        } catch (err) {
          logger.error(`Command ${cmd.type} for ${cmd.employee_no} failed`, { error: err.message });
          try {
            await this.esaClient.reportEnrollmentResult({
              command_id: cmd.id,
              employee_no: cmd.employee_no,
              status: 'failed',
            });
          } catch {}
        }
      }
    } finally {
      this.commandsInFlight = false;
    }
  }

  async handleStartCapture(cmd) {
    logger.info(`Starting fingerprint capture for employee ${cmd.employee_no} (finger ${cmd.finger_no})`);

    const enrollment = {
      employeeNo: cmd.employee_no,
      fingerNo: cmd.finger_no,
      status: 'registering',
      startedAt: new Date().toISOString(),
      commandId: cmd.id,
    };
    this.enrollments = this.enrollments.filter(e => e.employeeNo !== cmd.employee_no);
    this.enrollments.push(enrollment);
    this.emit('enrollment-update', [...this.enrollments]);

    const userResult = await deviceClient.ensureUserOnDevice(this.cachedDevice, {
      employeeNo: cmd.employee_no,
      name: `Employee ${cmd.employee_no}`,
    });

    if (!userResult.ok) {
      throw new Error(userResult.message || 'Could not register user on device');
    }

    await this.esaClient.reportEnrollmentResult({
      command_id: cmd.id,
      employee_no: cmd.employee_no,
      status: 'capturing',
    });

    enrollment.status = 'waiting_scan';
    this.emit('enrollment-update', [...this.enrollments]);

    logger.info(`Employee ${cmd.employee_no} - waiting for finger scan (up to ~60s)...`);

    const captureResult = await deviceClient.startFingerprintCapture(this.cachedDevice, {
      employeeNo: cmd.employee_no,
      fingerNo: cmd.finger_no,
    });

    if (captureResult.ok) {
      logger.success(`Fingerprint enrolled for employee ${cmd.employee_no}`);
      enrollment.status = 'enrolled';
      await this.esaClient.reportEnrollmentResult({
        employee_no: cmd.employee_no,
        status: 'enrolled',
      });
    } else {
      logger.warning(`Fingerprint capture failed for employee ${cmd.employee_no}: ${captureResult.message}`);
      enrollment.status = 'failed';
      enrollment.error = captureResult.message;
      await this.esaClient.reportEnrollmentResult({
        employee_no: cmd.employee_no,
        status: 'failed',
      });
    }

    enrollment.completedAt = new Date().toISOString();
    this.stats.commandsProcessed++;
    this.stats.lastCommandAt = new Date().toISOString();
    this.emit('enrollment-update', [...this.enrollments]);
    this.emit('status-change', this.getStatus());
  }

  async handleDeleteUser(cmd) {
    logger.info(`Removing employee ${cmd.employee_no} from device`);
    await deviceClient.deleteUserFromDevice(this.cachedDevice, {
      employeeNo: cmd.employee_no,
    });
    try {
      await this.esaClient.reportEnrollmentResult({
        command_id: cmd.id,
        employee_no: cmd.employee_no,
        status: 'removed',
      });
    } catch {}
    this.stats.commandsProcessed++;
    this.stats.lastCommandAt = new Date().toISOString();
    this.emit('status-change', this.getStatus());
  }

  async pollMatchEvents() {
    if (!this.cachedDevice) return;
    try {
      const result = await deviceClient.fetchRecentMatchEvents(this.cachedDevice, {
        sinceIso: this.deviceCursor,
      });
      if (!result.ok) return;

      this.deviceCursor = new Date().toISOString().slice(0, 19);

      for (const ev of result.events) {
        try {
          if (this.esaClient) {
            const res = await this.esaClient.reportMatchEvent({
              employee_no: ev.employeeNo,
              matched_at: ev.time,
            });
            if (res?.accepted) {
              logger.device(`Fingerprint match: employee ${ev.employeeNo} - sent to ESA`);
            }
          }
          this.stats.eventsReported++;
          this.stats.lastEventAt = new Date().toISOString();
          this.stats.consecutiveErrors = 0;
          this.emit('match-event', ev);
        } catch (err) {
          logger.error('Could not report match event', { error: err.message, employeeNo: ev.employeeNo });
          // Queue for offline sync
          syncQueue.push({
            id: `match-${ev.employeeNo}-${ev.time}`,
            type: 'match-event',
            data: { employee_no: ev.employeeNo, matched_at: ev.time },
          });
        }
      }
      this.emit('status-change', this.getStatus());
    } catch (err) {
      this.recordError(err);
    }
  }

  async syncOfflineQueue() {
    const queue = syncQueue.loadQueue();
    if (queue.length === 0 || !this.esaClient) return;

    logger.sync(`Syncing ${queue.length} offline event(s)...`);
    let synced = 0;
    let failed = 0;

    while (queue.length > 0) {
      const item = queue[0];
      try {
        if (item.type === 'match-event') {
          await this.esaClient.reportMatchEvent(item.data);
        }
        queue.shift();
        synced++;
      } catch {
        syncQueue.markRetryFailed(item.id);
        failed++;
        break; // Stop on first failure to avoid hammering
      }
    }
    syncQueue.saveQueue(queue);
    if (synced > 0) logger.sync(`Synced ${synced} offline event(s)`);
  }

  getStatus() {
    const deviceSource = configManager.getConfigValue('device', 'source');
    let deviceStatus = 'disconnected';
    if (this.running && this.cachedDevice) {
      deviceStatus = this.stats.consecutiveErrors === 0 ? 'connected' : 'error';
    } else if (this.running && deviceSource === 'manual') {
      const manual = configManager.getDeviceConfig();
      deviceStatus = manual.host ? 'configured' : 'disconnected';
    }

    let esaStatus = 'disconnected';
    if (this.esaClient) {
      esaStatus = this.running ? (this.stats.consecutiveErrors < 3 ? 'connected' : 'error') : 'configured';
    }

    return {
      running: this.running,
      deviceStatus,
      esaStatus,
      commandsInFlight: this.commandsInFlight,
      stats: { ...this.stats },
      syncQueue: syncQueue.getStats(),
      enrollments: [...this.enrollments],
      deviceSource,
      cachedDeviceHost: this.cachedDevice?.host || null,
    };
  }

  getEnrollments() {
    return [...this.enrollments];
  }
}

// Singleton
const agentService = new AgentService();
module.exports = agentService;
