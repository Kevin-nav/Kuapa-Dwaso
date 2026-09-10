export function pilotSmsMessage(input: {
  sample: boolean;
  title: string;
  detail: string;
  maxLength?: number;
}): string {
  const prefix = input.sample ? "Sample: " : "";
  return `${prefix}${input.title.trim()}. ${input.detail.trim()}`.slice(
    0,
    input.maxLength ?? 300,
  );
}

export function pilotIssueReminderKey(input: {
  issueId: string;
  version: number;
  deadlineAt: number;
}): string {
  return `pilot-issue-reminder:${input.issueId}:v${input.version}:${input.deadlineAt}`;
}

export function pilotIssueNeedsReminder(input: {
  status: string;
  deadlineAt?: number;
  cutoff: number;
}): boolean {
  return (
    !["resolved", "closed"].includes(input.status) &&
    input.deadlineAt !== undefined &&
    input.deadlineAt <= input.cutoff
  );
}
