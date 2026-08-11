import assert from "node:assert/strict";
import test from "node:test";
import {
  getAuthErrorCode,
  getAuthErrorMessage,
  shouldCreateInvitedEmailAccountAfterSignInFailure,
} from "../src/index.ts";

test("extracts Firebase error codes without depending on the Firebase SDK", () => {
  assert.equal(getAuthErrorCode({ code: "auth/invalid-phone-number" }), "auth/invalid-phone-number");
  assert.equal(
    getAuthErrorCode({ cause: { code: "auth/network-request-failed" } }),
    "auth/network-request-failed",
  );
  assert.equal(getAuthErrorCode(new Error("Firebase: raw provider text")), undefined);
  assert.equal(
    getAuthErrorCode(new Error("Firebase: Hostname match not found (auth/captcha-check-failed).")),
    "auth/captcha-check-failed",
  );

  const circularError = {};
  const circularCause = { cause: circularError };
  circularError.cause = circularCause;
  assert.equal(getAuthErrorCode(circularError), undefined);
});

test("maps phone challenge failures to actionable safe messages", () => {
  assert.equal(
    getAuthErrorMessage({ code: "auth/invalid-phone-number" }, "send-phone-code"),
    "Enter a complete, valid phone number and try again.",
  );
  assert.equal(
    getAuthErrorMessage({ code: "auth/captcha-check-failed" }, "send-phone-code"),
    "The security check could not be completed. Refresh the page and try again.",
  );
  assert.equal(
    getAuthErrorMessage({ code: "auth/invalid-verification-code" }, "verify-phone-code"),
    "That verification code is incorrect. Check the code and try again.",
  );
  assert.equal(
    getAuthErrorMessage({ code: "auth/code-expired" }, "verify-phone-code"),
    "That verification code has expired. Request a new code and try again.",
  );
});

test("maps throttling, network, account, and credential errors", () => {
  assert.match(
    getAuthErrorMessage({ code: "auth/too-many-requests" }, "send-phone-code"),
    /Too many attempts/,
  );
  assert.match(
    getAuthErrorMessage({ code: "auth/quota-exceeded" }, "send-mfa-code"),
    /SMS sending limit/,
  );
  assert.match(
    getAuthErrorMessage({ code: "auth/network-request-failed" }, "sign-in"),
    /internet connection/,
  );
  assert.match(
    getAuthErrorMessage({ code: "auth/user-disabled" }, "sign-in"),
    /disabled/,
  );
  assert.equal(
    getAuthErrorMessage({ code: "auth/invalid-credential" }, "sign-in"),
    "The email or password is incorrect.",
  );
});

test("creates an invited account after Firebase's ambiguous missing-user errors", () => {
  assert.equal(
    shouldCreateInvitedEmailAccountAfterSignInFailure({ code: "auth/invalid-credential" }),
    true,
  );
  assert.equal(
    shouldCreateInvitedEmailAccountAfterSignInFailure({ code: "auth/user-not-found" }),
    true,
  );
  assert.equal(
    shouldCreateInvitedEmailAccountAfterSignInFailure({ code: "auth/network-request-failed" }),
    false,
  );
  assert.equal(
    shouldCreateInvitedEmailAccountAfterSignInFailure({ code: "auth/too-many-requests" }),
    false,
  );
});

test("uses operation-specific fallbacks without leaking raw provider messages", () => {
  const rawError = new Error("Firebase: Hostname match not found (auth/captcha-check-failed).");
  assert.equal(
    getAuthErrorMessage(rawError, "send-phone-code"),
    "The security check could not be completed. Refresh the page and try again.",
  );
  assert.equal(
    getAuthErrorMessage(rawError, "verify-mfa-code"),
    "The security check could not be completed. Refresh the page and try again.",
  );
  assert.doesNotMatch(getAuthErrorMessage(rawError, "sign-in"), /Firebase|captcha/i);
});
