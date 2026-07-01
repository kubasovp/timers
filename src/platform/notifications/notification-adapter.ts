export interface NotificationRequest {
  id: string;
  title: string;
  body?: string;
  urgency?: "normal" | "high";
}

export interface SoundRequest {
  soundId?: string;
  volume?: number;
}

export interface NotificationAdapter {
  sendNotification(request: NotificationRequest): Promise<void>;
  playSound(request: SoundRequest): Promise<void>;
}
