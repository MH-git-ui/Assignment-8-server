import { createRemoteJWKSet, jwtVerify } from "jose";
export function createTokenVerifier(config) {
  const jwks = createRemoteJWKSet(new URL(config.jwks));
  return (token) =>
    jwtVerify(token, jwks, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ["EdDSA"],
    });
}
export function requireAuth(verify) {
  return async (req, res, next) => {
    const header = req.get("authorization");
    if (!header?.startsWith("Bearer "))
      return res.status(401).json({ message: "Please log in to continue." });
    try {
      const { payload } = await verify(header.slice(7));
      if (
        !payload.sub ||
        typeof payload.email !== "string" ||
        typeof payload.name !== "string"
      )
        throw new Error("Invalid identity");
      req.user = { id: payload.sub, email: payload.email, name: payload.name };
      next();
    } catch {
      res
        .status(401)
        .json({ message: "Your session has expired. Please log in again." });
    }
  };
}
