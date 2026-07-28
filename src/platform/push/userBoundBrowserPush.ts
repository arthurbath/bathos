export async function getExistingUserBoundBrowserPushSubscription(): Promise<PushSubscription | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  const registration = await navigator.serviceWorker.getRegistration('/');
  const pushManager = registration?.pushManager;
  if (!pushManager || typeof pushManager.getSubscription !== 'function') {
    return null;
  }

  return pushManager.getSubscription();
}

export async function unsubscribeUserBoundBrowserPush(): Promise<boolean> {
  const subscription = await getExistingUserBoundBrowserPushSubscription();
  return subscription ? subscription.unsubscribe() : false;
}
