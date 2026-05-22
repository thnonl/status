"use client";

import { useEffect, useState } from "react";

export function useServiceWorker(projectId: string) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(() => (typeof Notification === "undefined" ? "default" : Notification.permission));
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let ignore = false;

    async function registerSW() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        if (ignore) return;
        setRegistration(reg);

        const sub = await reg.pushManager.getSubscription();
        if (ignore) return;
        setSubscription(sub);
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : String(err));
      }
    }

    registerSW();

    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "NAVIGATE" && event.data.url) {
        window.location.href = event.data.url;
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  async function requestPermission() {
    if (typeof Notification === "undefined") return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result === "granted";
  }

  async function subscribe() {
    if (!registration || permission !== "granted") return false;

    try {
      const vapidRes = await fetch("/api/push/vapid-key");
      const { publicKey } = await vapidRes.json();
      if (!publicKey) {
        setError("VAPID key not configured");
        return false;
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const subJSON = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJSON.endpoint,
          keys: subJSON.keys,
          projectId,
        }),
      });

      setSubscription(sub);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  async function unsubscribe() {
    if (!subscription) return;

    try {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      await subscription.unsubscribe();
      setSubscription(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    registration,
    subscription,
    permission,
    error,
    requestPermission,
    subscribe,
    unsubscribe,
    isSubscribed: Boolean(subscription),
  };
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
