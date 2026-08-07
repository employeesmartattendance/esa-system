/**
 * Copy this file to config.js and fill in your own values.
 * config.js is gitignored — never commit your real agent token.
 */
module.exports = {
  // Your Render backend's base URL — same one the ESA app itself uses,
  // WITHOUT the trailing /api (the agent adds that itself per-endpoint).
  // Example: 'https://esa-system.onrender.com'
  backendUrl: 'https://YOUR-BACKEND.onrender.com',

  // From ESA → Settings (school admin) → Fingerprint Device.
  // Shown once right after you save the device for the first time, or
  // after clicking "Regenerate Token".
  agentToken: 'PASTE_YOUR_AGENT_TOKEN_HERE',

  // How often (ms) this agent checks Render for new enroll/remove
  // commands from the dashboard. 4000 (4s) is a good default.
  deviceCommandPollMs: 4000,

  // How often (ms) this agent checks the device for new fingerprint
  // match events. 4000 (4s) is a good default — lower it for snappier
  // check-ins, at the cost of slightly more traffic to the device.
  eventPollMs: 4000,
};
