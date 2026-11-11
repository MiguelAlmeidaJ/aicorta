const path = require("node:path");
const fs = require("node:fs");
const { parseEnv } = require("node:util");

const rootDir = __dirname;
const apiDir = path.join(rootDir, "apps", "api");
const webDir = path.join(rootDir, "apps", "web");
const envPath = path.join(rootDir, ".env");
// PM2 launches processes from apps/api and apps/web; the root .env must be
// explicitly propagated to the API. Never include API secrets in the web env.
const rootEnv = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, "utf8")) : {};
const apiKeys = [
  "DATABASE_URL", "JWT_SECRET", "API_PORT", "API_HOST", "WEB_ORIGIN",
  "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM",
  "CONTACT_TO_EMAIL", "GOOGLE_GEOCODING_API_KEY",
];
const apiEnvironment = Object.fromEntries(apiKeys.flatMap(key => {
  const value = process.env[key] ?? rootEnv[key];
  return value === undefined ? [] : [[key, value]];
}));

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
      env: { ...shared.env, ...apiEnvironment, API_PORT: apiEnvironment.API_PORT || "3001",
        API_HOST: apiEnvironment.API_HOST || "127.0.0.1" },
      env_production: { ...shared.env_production, ...apiEnvironment,
        API_PORT: apiEnvironment.API_PORT || "3001", API_HOST: apiEnvironment.API_HOST || "127.0.0.1" },
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
        PORT: process.env.WEB_PORT || rootEnv.WEB_PORT || "3000",
        HOSTNAME: process.env.WEB_HOST || rootEnv.WEB_HOST || "127.0.0.1",
        INTERNAL_API_URL: process.env.INTERNAL_API_URL || rootEnv.INTERNAL_API_URL || `http://127.0.0.1:${apiEnvironment.API_PORT || "3001"}/api`,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      env_production: {
        ...shared.env_production,
        PORT: process.env.WEB_PORT || rootEnv.WEB_PORT || "3000",
        HOSTNAME: process.env.WEB_HOST || rootEnv.WEB_HOST || "127.0.0.1",
        INTERNAL_API_URL: process.env.INTERNAL_API_URL || rootEnv.INTERNAL_API_URL || `http://127.0.0.1:${apiEnvironment.API_PORT || "3001"}/api`,
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
};
