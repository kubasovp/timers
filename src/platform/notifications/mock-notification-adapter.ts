import type {
  NotificationAdapter,
  NotificationRequest,
  SoundRequest
} from "./notification-adapter";

export class MockNotificationAdapter implements NotificationAdapter {
  readonly notifications: NotificationRequest[] = [];
  readonly sounds: SoundRequest[] = [];

  async sendNotification(request: NotificationRequest): Promise<void> {
    this.notifications.push(request);
  }

  async playSound(request: SoundRequest): Promise<void> {
    this.sounds.push(request);
  }
}
