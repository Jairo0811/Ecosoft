export interface NotificationDeliveryEvent {
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
}

export interface NotificationPublisher {
  publish(event: NotificationDeliveryEvent): Promise<void>;
}

// Puertos deliberadamente desacoplados. Socket.IO y el proveedor transaccional de correo
// se conectarán sin alterar el dominio ni exponer notificaciones de otra organización.
export const realtimeNotificationPublisher: NotificationPublisher = {
  async publish(): Promise<void> {
    return Promise.resolve();
  },
};

export const emailNotificationPublisher: NotificationPublisher = {
  async publish(): Promise<void> {
    return Promise.resolve();
  },
};
