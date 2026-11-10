/**
 * System Tray Management
 */
const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let tray = null;

function createTrayIcon() {
  // Create a 16x16 tray icon programmatically (no external assets needed)
  const size = 16;
  const canvas = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="3" fill="#1a1a2e"/>
  <circle cx="8" cy="6" r="2.5" fill="#e94560"/>
  <rect x="4" y="9" width="8" height="5" rx="1.5" fill="#e94560"/>
</svg>`;
  return nativeImage.createFromBuffer(Buffer.from(canvas));
}

function createTray(mainWindow) {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('ESA Hikvision Agent');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Window', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { mainWindow.destroy(); } },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}

function updateTrayStatus(status) {
  if (!tray) return;
  const label = status?.running ? 'ESA Agent (Running)' : 'ESA Agent (Stopped)';
  tray.setToolTip(label);
}

module.exports = { createTray, updateTrayStatus };
