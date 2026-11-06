const path = require("node:path");

const rootDir = __dirname;
const apiDir = path.join(rootDir, "apps", "api");
const webDir = path.join(rootDir, "apps", "web");

const shared = {
  namespace: "aicorta",
  instances: 1,
  exec_mode: "fork",
  autorestart: true,
  watch: false,
  min_uptime: "10s",
  max_restarts: 10,
  restart_delay: 2_000,
  kill_timeout: 5_000,
  time: true,
  env: {
    NODE_ENV: "production",
  },
  env_production: {
    NODE_ENV: "production",
  },
};

module.exports = {
  apps: [
    {
      ...shared,
      name: "aicorta-api",
      cwd: apiDir,
      script: path.join(apiDir, "dist", "main.js"),
      interpreter: process.execPath,
      max_memory_restart: "512M",
    },
    {
      ...shared,
      name: "aicorta-web",
      cwd: webDir,
      script: require.resolve("next/dist/bin/next", { paths: [webDir] }),
      args: "start",
      interpreter: process.execPath,
      max_memory_restart: "768M",
      env: {
        ...shared.env,
        PORT: process.env.WEB_PORT || "3000",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      env_production: {
        ...shared.env_production,
        PORT: process.env.WEB_PORT || "3000",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
};
