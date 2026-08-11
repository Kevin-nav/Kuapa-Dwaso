declare const process: { env: Record<string, string | undefined> };

export function assertNotificationServiceSecret(value: string): void {
  const configured = process.env.NOTIFICATION_DELIVERY_SECRET;
  if (configured === undefined || configured.length < 16 || value !== configured) {
    throw new Error("Notification service authorization failed.");
  }
}
