import assert from "node:assert/strict";
import test from "node:test";
import { onboardingIntentDestination, onboardingIntentHref, onboardingIntentRole, parseOnboardingIntent } from "../src/index.ts";

test("keeps only the two public maize onboarding intents", () => {
  assert.equal(parseOnboardingIntent("request_maize_supply"), "request_maize_supply");
  assert.equal(parseOnboardingIntent("sell_maize"), "sell_maize");
  assert.equal(parseOnboardingIntent("https://evil.example/account"), undefined);
  assert.equal(parseOnboardingIntent("admin"), undefined);
});

test("intent suggests a profile and an internal next action without granting a role", () => {
  assert.equal(onboardingIntentRole("request_maize_supply"), "buyer");
  assert.equal(onboardingIntentDestination("request_maize_supply"), "/buyer/requests/new");
  assert.equal(onboardingIntentRole("sell_maize"), "farmer");
  assert.equal(onboardingIntentDestination("sell_maize"), "/farmer/supply");
});

test("public CTA construction pins signup to the configured app origin", () => {
  assert.equal(onboardingIntentHref("https://app.kuapadwaso.com/anything", "sell_maize"), "https://app.kuapadwaso.com/signup?intent=sell_maize");
});
