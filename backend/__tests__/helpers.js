/**
 * Shared test helpers — JWT generation & cleanup utilities.
 *
 * Auth note: The backend routes use jwt.decode() (not jwt.verify()),
 * so we can sign tokens with any secret and they'll be accepted
 * as long as the `sub` claim is a valid Supabase user ID.
 */

"use strict";

const jwt = require("jsonwebtoken");

// Test user — must exist in Supabase Auth (email confirmation disabled)
const TEST_USER_EMAIL = "testuser2@gmail.com";
const TEST_USER_PASSWORD = "TestPassword123";

// We'll resolve the real user ID on first call via Supabase signIn
let cachedUserId = null;
let cachedAuthToken = null;

/**
 * Sign in as the test user via Supabase Auth and return a real JWT + userId.
 * Caches the result so we only sign in once per test run.
 */
async function getTestAuth() {
  if (cachedAuthToken && cachedUserId) {
    return { authToken: cachedAuthToken, userId: cachedUserId };
  }

  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });

  if (error) {
    throw new Error(`Test auth failed: ${error.message}`);
  }

  cachedAuthToken = data.session.access_token;
  cachedUserId = data.user.id;

  return { authToken: cachedAuthToken, userId: cachedUserId };
}

/**
 * Generate a fake JWT for a specific user ID.
 * Works because routes use jwt.decode() not jwt.verify().
 */
function makeToken(userId) {
  return jwt.sign(
    { sub: userId, role: "authenticated", iss: "test" },
    "test-secret",
    { expiresIn: "1h" }
  );
}

/**
 * Generate a JWT with an invalid/missing sub — should trigger 401.
 */
function makeBadToken() {
  return jwt.sign({ role: "anon" }, "test-secret", { expiresIn: "1h" });
}

module.exports = { getTestAuth, makeToken, makeBadToken };
