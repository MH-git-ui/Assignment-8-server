export function readConfig(env = process.env) {
  for (const key of [
    "MONGODB_URI",
    "CLIENT_ORIGIN",
    "AUTH_ISSUER",
    "JWKS_URL",
  ]) {
    if (!env[key])
      throw new Error(`Missing required environment variable: ${key}`);
  }
  return {
    port: Number(env.PORT || 4000),
    uri: env.MONGODB_URI,
    database: env.MONGODB_DB || "booknook",
    origin: env.CLIENT_ORIGIN,
    issuer: env.AUTH_ISSUER,
    audience: env.AUTH_AUDIENCE || "booknook-api",
    jwks: env.JWKS_URL,
  };
}
