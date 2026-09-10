import assert from "node:assert/strict";
import test from "node:test";
import {
  pilotIssueNeedsReminder,
  pilotIssueReminderKey,
  pilotSmsMessage,
} from "../src/pilotNotifications.ts";

test("labels sample SMS and never adds an application link", () => {
  const message = pilotSmsMessage({
    sample: true,
    title: "Offer revised",
    detail: "Review the new quantity in the application",
  });
  assert.equal(
    message,
    "Sample: Offer revised. Review the new quantity in the application",
  );
  assert.doesNotMatch(message, /https?:\/\//);
});

test("deduplicates reminders by current issue state", () => {
  assert.equal(
    pilotIssueReminderKey({ issueId: "issue-1", version: 2, deadlineAt: 50 }),
    "pilot-issue-reminder:issue-1:v2:50",
  );
  assert.notEqual(
    pilotIssueReminderKey({ issueId: "issue-1", version: 2, deadlineAt: 50 }),
    pilotIssueReminderKey({ issueId: "issue-1", version: 3, deadlineAt: 50 }),
  );
});

test("resolved and closed issues never produce stale reminders", () => {
  assert.equal(
    pilotIssueNeedsReminder({ status: "open", deadlineAt: 10, cutoff: 10 }),
    true,
  );
  assert.equal(
    pilotIssueNeedsReminder({ status: "resolved", deadlineAt: 10, cutoff: 10 }),
    false,
  );
  assert.equal(
    pilotIssueNeedsReminder({ status: "closed", deadlineAt: 10, cutoff: 10 }),
    false,
  );
});
