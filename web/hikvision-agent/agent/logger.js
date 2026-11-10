/**
 * Professional Logging System
 * Categories: INFO, SUCCESS, WARNING, ERROR, DEVICE, ESA, SYNC, SECURITY
 */
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG_CATEGORIES = {
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  DEVICE: 'DEVICE',
  ESA: 'ESA',
  SYNC: 'SYNC',
  SECURITY: 'SECURITY',
};

const MAX_LOG_ENTRIES = 2000;
const MAX_LOG_FILE_SIZE = 5 * 1024 * 1024; // 5MB

let inMemoryLogs = [];
let logFilePath = null;
let logStream = null;

function getLogFilePath() {
  if (logFilePath) return logFilePath;
  const userDataPath = app ? app.getPath('userData') : path.join(__dirname, '../../logs');
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
  logFilePath = path.join(userDataPath, 'agent.log');
  return logFilePath;
}

function ensureLogStream() {
  if (logStream) return;
  try {
    const fp = getLogFilePath();
    logStream = fs.createWriteStream(fp, { flags: 'a' });
    logStream.on('error', () => { logStream = null; });
  } catch {
    logStream = null;
  }
}

function formatTimestamp() {
  return new Date().toISOString();
}

function createLogEntry(category, message, meta = null) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: formatTimestamp(),
    category: category || LOG_CATEGORIES.INFO,
    message,
    meta,
  };
}

function writeToFile(entry) {
  ensureLogStream();
  if (!logStream) return;
  const line = `[${entry.timestamp}] [${entry.category}] ${entry.message}${entry.meta ? ' ' + JSON.stringify(entry.meta) : ''}\n`;
  logStream.write(line);
}

function log(category, message, meta = null) {
  const entry = createLogEntry(category, message, meta);
  inMemoryLogs.push(entry);
  if (inMemoryLogs.length > MAX_LOG_ENTRIES) {
    inMemoryLogs = inMemoryLogs.slice(-MAX_LOG_ENTRIES);
  }
  writeToFile(entry);
  // Also output to console for dev debugging
  const prefix = { ERROR: '\u274c', SUCCESS: '\u2705', WARNING: '\u26a0\ufe0f' }[category] || '\u2139\ufe0f';
  console.log(`${prefix} [${entry.category}] ${entry.message}`);
  return entry;
}

function info(message, meta) { return log(LOG_CATEGORIES.INFO, message, meta); }
function success(message, meta) { return log(LOG_CATEGORIES.SUCCESS, message, meta); }
function warning(message, meta) { return log(LOG_CATEGORIES.WARNING, message, meta); }
function error(message, meta) { return log(LOG_CATEGORIES.ERROR, message, meta); }
function device(message, meta) { return log(LOG_CATEGORIES.DEVICE, message, meta); }
function esa(message, meta) { return log(LOG_CATEGORIES.ESA, message, meta); }
function sync(message, meta) { return log(LOG_CATEGORIES.SYNC, message, meta); }
function security(message, meta) { return log(LOG_CATEGORIES.SECURITY, message, meta); }

function getLogs(filter = {}) {
  let logs = [...inMemoryLogs];
  if (filter.category) {
    logs = logs.filter(l => l.category === filter.category);
  }
  if (filter.search) {
    const s = filter.search.toLowerCase();
    logs = logs.filter(l => l.message.toLowerCase().includes(s));
  }
  if (filter.since) {
    logs = logs.filter(l => l.timestamp >= filter.since);
  }
  if (filter.until) {
    logs = logs.filter(l => l.timestamp <= filter.until);
  }
  logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  if (filter.limit) logs = logs.slice(0, filter.limit);
  return logs;
}

function clearLogs() {
  inMemoryLogs = [];
  try {
    if (logStream) {
      logStream.end();
      logStream = null;
    }
    const fp = getLogFilePath();
    if (fs.existsSync(fp)) fs.writeFileSync(fp, '');
  } catch {}
}

function exportLogs() {
  const header = 'ESA Hikvision Agent - Log Export\nExported: ' + new Date().toISOString() + '\n' + '='.repeat(80) + '\n\n';
  const lines = inMemoryLogs.map(l => `[${l.timestamp}] [${l.category}] ${l.message}${l.meta ? ' ' + JSON.stringify(l.meta) : ''}`);
  return header + lines.join('\n');
}

module.exports = {
  log, info, success, warning, error, device, esa, sync, security,
  getLogs, clearLogs, exportLogs,
  LOG_CATEGORIES,
};
