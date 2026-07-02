import type {
  NotificationAdapter,
  NotificationRequest,
  SoundRequest
} from "./notification-adapter";

export class BrowserNotificationAdapter implements NotificationAdapter {
  private userGesturePrimingInstalled = false;

  constructor() {
    this.installUserGesturePriming();
  }

  async sendNotification(request: NotificationRequest): Promise<void> {
    if (!("Notification" in globalThis)) {
      console.info(`[notification:${request.id}] ${request.title}`, request.body ?? "");
      return;
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

    if (context.state === "suspended") {
      await context.resume().catch(() => undefined);
    }

    if (context.state !== "running") {
      await context.close().catch(() => undefined);
      return;
    }

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
      const timeoutId = setTimeout(() => {
        void context.close().finally(resolve);
      }, 350);

      oscillator.addEventListener("ended", () => {
        clearTimeout(timeoutId);
        void context.close().finally(resolve);
      });
    });
  }

  private installUserGesturePriming(): void {
    if (this.userGesturePrimingInstalled || !("window" in globalThis)) {
      return;
    }

    this.userGesturePrimingInstalled = true;
    const prime = (): void => {
      if ("Notification" in globalThis && Notification.permission === "default") {
        void Notification.requestPermission().catch(() => undefined);
      }

      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };

    window.addEventListener("pointerdown", prime, { once: true });
    window.addEventListener("keydown", prime, { once: true });
  }
}
