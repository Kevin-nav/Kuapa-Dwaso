import assert from "node:assert/strict";
import test from "node:test";
import { isApprovedWebPushEndpoint, isValidPushSubscriptionInput } from "./index.ts";

test("accepts known browser push services and rejects arbitrary HTTPS endpoints", () => {
  assert.equal(isApprovedWebPushEndpoint("https://fcm.googleapis.com/fcm/send/example"), true);
  assert.equal(isApprovedWebPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/example"), true);
  assert.equal(isApprovedWebPushEndpoint("https://web.push.apple.com/example"), true);
  assert.equal(isApprovedWebPushEndpoint("https://attacker.example/push"), false);
  assert.equal(isApprovedWebPushEndpoint("http://fcm.googleapis.com/fcm/send/example"), false);
});

test("validates subscription shape and browser encryption keys", () => {
  assert.equal(isValidPushSubscriptionInput({ surface: "app", endpoint: "https://fcm.googleapis.com/fcm/send/example", keys: { p256dh: "a".repeat(64), auth: "b".repeat(16) } }), true);
  assert.equal(isValidPushSubscriptionInput({ surface: "app", endpoint: "https://fcm.googleapis.com/fcm/send/example", keys: { p256dh: "short", auth: "bad key" } }), false);
});
