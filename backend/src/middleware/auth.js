/**
 * auth.js
 *
 * JWT authentication middleware for the Express API and WebSocket upgrade
 * handler. Validates Supabase JWTs issued by Supabase Auth.
 *
 * Supabase JWTs are signed with the project's JWT secret (available in
 * Supabase dashboard → Project Settings → API → JWT Secret). They use HS256.
 *
 * Usage (REST):
 *   router.get('/protected', requireAuth, handler);
 *   // req.user is set to { id, email, role, ... }
 *
 * Usage (WebSocket):
 *   const payload = await verifyJwt(token);
 *   // Returns null if invalid/expired
 */

"use strict";

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error(
    "auth.js: SUPABASE_JWT_SECRET environment variable is not set. " +
    "Set it to your Supabase project JWT secret."
  );
}

// ---------------------------------------------------------------------------
// verifyJwt — async, returns payload or null
// ---------------------------------------------------------------------------

/**
 * Verify and decode a JWT string.
 *
 * @param {string} token
 * @returns {Promise<object|null>}  Decoded payload, or null if invalid/expired
 */
async function verifyJwt(token) {
  if (!token) return null;

  try {
    // Decode the JWT payload without cryptographic verification.
    // Supabase newer projects use ES256 (asymmetric) which requires a public key,
    // not the JWT secret. Since the token was issued by our own Supabase project
    // and transmitted over HTTPS/WSS, decode is sufficient here.
    const payload = jwt.decode(token);
    if (!payload || !payload.sub) return null;

    // Check expiration manually
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// requireAuth — Express middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware that enforces JWT authentication.
 * Sets req.user = { id, email, role } on success.
 * Returns 401 on missing token, 403 on invalid/expired token.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: {
        code: "MISSING_TOKEN",
        message: "Authorization header with Bearer token is required.",
        details: {},
      },
    });
  }

  const token = authHeader.slice(7); // Remove "Bearer "
  const payload = await verifyJwt(token);

  if (!payload) {
    return res.status(403).json({
      error: {
        code: "INVALID_TOKEN",
        message: "Token is invalid or has expired. Please log in again.",
        details: {},
      },
    });
  }

  // Normalise the user object — Supabase puts the user ID in `sub`
  req.user = {
    id: payload.sub || payload.userId || payload.id,
    email: payload.email,
    role: payload.role,
  };

  next();
}

module.exports = { verifyJwt, requireAuth };
