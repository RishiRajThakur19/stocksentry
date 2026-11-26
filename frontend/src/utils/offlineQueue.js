import api from '../api/client';

const QUEUE_KEY = 'stocksentry_offline_queue';
const ASSETS_CACHE_KEY = 'stocksentry_cached_my_assets';

export function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function enqueueOfflineAction(method, url, data) {
  const queue = getOfflineQueue();
  const idempotencyKey = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  queue.push({ id: idempotencyKey, method, url, data, createdAt: new Date().toISOString() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return idempotencyKey;
}

export async function flushOfflineQueue() {
  if (!navigator.onLine) return 0;
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  const remaining = [];
  let flushed = 0;
  for (const item of queue) {
    try {
      await api.request({
        method: item.method,
        url: item.url,
        data: item.data,
        headers: { 'Idempotency-Key': item.id },
      });
      flushed += 1;
    } catch {
      remaining.push(item);
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return flushed;
}

export function cacheMyAssets(assets) {
  try {
    localStorage.setItem(ASSETS_CACHE_KEY, JSON.stringify(assets || []));
  } catch {
    // ignore quota errors
  }
}

export function getCachedMyAssets() {
  try {
    return JSON.parse(localStorage.getItem(ASSETS_CACHE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearOfflineCache() {
  localStorage.removeItem(QUEUE_KEY);
  localStorage.removeItem(ASSETS_CACHE_KEY);
}
