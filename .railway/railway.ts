import {
  database,
  defineRailway,
  preserve,
  project,
  service,
  volume,
} from "railway/iac";

const REGION = "us-east4-eqdc4a";

// Restart a crashed container, but not forever.
const restart = {
  restartPolicyType: "ON_FAILURE",
  restartPolicyMaxRetries: 5,
} as const;

export default defineRailway(() => {
  const MySQL = database("MySQL", "mysql", {
    image: "mysql:8.4",
    output: "MYSQL_URL",
    defaultMountPath: "/var/lib/mysql",
    region: REGION,
  });
  MySQL.deploy = {
    multiRegionConfig: { [REGION]: { numReplicas: 1 } },
    startCommand:
      "docker-entrypoint.sh mysqld --innodb-use-native-aio=0 --disable-log-bin --performance_schema=0 --innodb-buffer-pool-size=1G",
  };
  MySQL.networking = { privateNetworkEndpoint: "mysql" };

  const mysqlVolume = volume("mysql-volume", {
    alerts: { usage: { "100": {}, "80": {}, "95": {} } },
    allowOnlineResize: true,
    region: REGION,
    sizeMB: 5000,
  });

  // The API: no public domain; only web reaches it, over the private network.
  // It waits for MySQL and applies the migrations on start.
  const api = service("api", {
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile.api",
      buildEnvironment: "V3",
      watchPatterns: [
        "src/**",
        "package.json",
        "package-lock.json",
        "Dockerfile.api",
      ],
    },
    deploy: {
      healthcheckPath: "/api/health",
      healthcheckTimeout: 120,
      ...restart,
    },
    replicas: { [REGION]: 1 },
    env: {
      DB_HOST: MySQL.env.MYSQLHOST,
      DB_PORT: MySQL.env.MYSQLPORT,
      DB_USER: "app",
      DB_PASSWORD: preserve(),
      DB_ADMIN_USER: MySQL.env.MYSQLUSER,
      DB_ADMIN_PASSWORD: MySQL.env.MYSQLPASSWORD,
      SESSION_SECRET: preserve(),
      DB_NAME: MySQL.env.MYSQLDATABASE,
      // "::" also covers IPv6-only private networks.
      HOST: "::",
      PORT: "3000",
      SESSION_COOKIE_SECURE: "true",
    },
  });

  // The web view, served by nginx, which forwards /api to the API. Its
  // generated *.up.railway.app domain is not part of this file.
  const web = service("web", {
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile.web",
      buildEnvironment: "V3",
      watchPatterns: [
        "apps/web/**",
        "Dockerfile.web",
        "deploy/nginx.conf.template",
      ],
    },
    deploy: { healthcheckPath: "/", ...restart },
    domains: ["naval.alejandroacosta.dev"],
    replicas: { [REGION]: 1 },
    env: {
      API_UPSTREAM: "${{api.RAILWAY_PRIVATE_DOMAIN}}:3000",
      PORT: "8080",
    },
  });

  return project("Mag - Sem 1 - Guerra naval", {
    ...({ variables: { managed: true } } as object),
    resources: [api, web, MySQL, mysqlVolume],
  });
});
