// Push notification helpers

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  const registration = await registerServiceWorker();
  if (!registration) return null;

  const permission = await requestNotificationPermission();
  if (!permission) return null;

  try {
    // For a real app, you'd use a VAPID key from your server
    // This is a placeholder - you need to generate your own
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    console.log('Push subscription:', subscription);
    return subscription;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return null;
  }
}

export function showLocalNotification(title: string, body: string, options?: NotificationOptions) {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  }
  return null;
}

// Schedule a reminder notification
export function scheduleReminder(recipeTitle: string, delayMs: number) {
  setTimeout(() => {
    showLocalNotification(
      'Time to cook!',
      `How about making "${recipeTitle}" today?`,
      {
        tag: 'cooking-reminder',
      }
    );
  }, delayMs);
}

// Check if we should remind about a recipe
export function shouldRemindAboutRecipe(lastCooked: string | null, reminderDays: number): boolean {
  if (!lastCooked) return true; // Never cooked, might want to try

  const daysSinceCooked = Math.floor(
    (Date.now() - new Date(lastCooked).getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSinceCooked >= reminderDays;
}
