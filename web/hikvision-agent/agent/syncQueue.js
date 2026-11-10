/**
 * Offline Event Sync Queue
 * Persists events to disk when ESA backend is unreachable, syncs when reconnected.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const logger = require('./logger');

const QUEUE_FILE = 'sync-queue.json';
const MAX_QUEUE_SIZE = 5000;

function getQueuePath() {
  const userDataPath = app ? app.getPath('userData') : path.join(__dirname, '../../data');
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
  return path.join(userDataPath, QUEUE_FILE);
}

function loadQueue() {
  try {
    const fp = getQueuePath();
    if (fs.existsSync(fp)) {
      const data = fs.readFileSync(fp, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    logger.warning('Could not load sync queue', { error: err.message });
  }
  return [];
}

function saveQueue(queue) {
  try {
    const fp = getQueuePath();
    fs.writeFileSync(fp, JSON.stringify(queue, null, 2));
  } catch (err) {
    logger.error('Could not save sync queue', { error: err.message });
  }
}

function push(event) {
  const queue = loadQueue();
  queue.push({
    ...event,
    queuedAt: new Date().toISOString(),
    retries: 0,
  });
  // Trim if too large
  if (queue.length > MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  }
  saveQueue(queue);
  logger.sync(`Event queued (${queue.length} pending)`);
  return queue.length;
}

function pop() {
  const queue = loadQueue();
  if (queue.length === 0) return null;
  const item = queue.shift();
  saveQueue(queue);
  return item;
}

function peekAll() {
  return loadQueue();
}

function markRetryFailed(eventId) {
  const queue = loadQueue();
  const item = queue.find(e => e.id === eventId);
  if (item) {
    item.retries = (item.retries || 0) + 1;
    if (item.retries >= 5) {
      // Remove events that failed too many times
      const idx = queue.indexOf(item);
      queue.splice(idx, 1);
      logger.warning(`Dropped event after 5 failed retries`, { eventId });
    }
    saveQueue(queue);
  }
}

function clear() {
  saveQueue([]);
  logger.sync('Sync queue cleared');
}

function getStats() {
  const queue = loadQueue();
  return {
    pending: queue.length,
    oldestItem: queue.length > 0 ? queue[0].queuedAt : null,
    newestItem: queue.length > 0 ? queue[queue.length - 1].queuedAt : null,
  totalRetries: queue.reduce((sum, e) => sum + (e.retries || 0), 0),
  };
}

module.exports = { push, pop, peekAll, markRetryFailed, clear, getStats, loadQueue, saveQueue };
