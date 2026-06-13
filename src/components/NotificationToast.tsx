interface NotificationToastProps {
  message: string | null;
}

export function NotificationToast({ message }: NotificationToastProps) {
  if (!message) return null;

  return (
    <div className="notification-toast">
      <span className="codicon codicon-check" style={{ marginRight: 8 }} /> {message}
    </div>
  );
}
