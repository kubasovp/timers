import type {
  NotificationAdapter,
  NotificationRequest,
  SoundRequest
} from "./notification-adapter";

export class BrowserNotificationAdapter implements NotificationAdapter {
  async sendNotification(request: NotificationRequest): Promise<void> {
    if (!("Notification" in globalThis)) {
      console.info(`[notification:${request.id}] ${request.title}`, request.body ?? "");
      return;
    }

    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }

    if (Notification.permission === "granted") {
      new Notification(request.title, {
        body: request.body,
        tag: request.id,
        requireInteraction: request.urgency === "high"
      });
      return;
    }

    console.info(`[notification:${request.id}] ${request.title}`, request.body ?? "");
  }

  async playSound(request: SoundRequest): Promise<void> {
    const AudioContextCtor = globalThis.AudioContext;

    if (!AudioContextCtor) {
      return;
    }

    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = request.soundId === "timer-end" ? 880 : 660;
    gain.gain.value = Math.max(0, Math.min(1, request.volume ?? 0.45));

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);

    await new Promise<void>((resolve) => {
      oscillator.addEventListener("ended", () => {
        void context.close().finally(resolve);
      });
    });
  }
}
