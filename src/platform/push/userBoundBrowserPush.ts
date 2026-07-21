export async function getExistingUserBoundBrowserPushSubscription(): Promise<PushSubscription | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  const registration = await navigator.serviceWorker.getRegistration('/');
  return registration?.pushManager.getSubscription() ?? null;
}

export async function unsubscribeUserBoundBrowserPush(): Promise<boolean> {
  const subscription = await getExistingUserBoundBrowserPushSubscription();
  return subscription ? subscription.unsubscribe() : false;
}
