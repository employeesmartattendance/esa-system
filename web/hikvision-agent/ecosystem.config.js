/**
 * Keeps the ESA Hikvision bridge agent running permanently and restarts it
 * automatically if it crashes or the machine reboots (once PM2 itself is
 * set to start on boot — see step 3 in HIKVISION_SETUP_GUIDE.md).
 *
 * Usage (from inside this hikvision-agent folder):
 *   npm install -g pm2
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup      (then run the one command it prints)
 */
module.exports = {
  apps: [
    {
      name: 'esa-hikvision-agent',
      script: 'index.js',
      cwd: __dirname,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      restart_delay: 3000,
    },
  ],
};
