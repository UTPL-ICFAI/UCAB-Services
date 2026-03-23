/**
 * utils/caching.js
 * Simple in-memory caching for API responses to improve performance
 */

const cache = new Map();
const CACHE_DURATION = 60000; // 1 minute

export const getCachedAPI = (key) => {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_DURATION) {
    cache.delete(key);
    return null;
  }
  return cached.data;
};

export const setCachedAPI = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

export const clearCache = (pattern) => {
  if (!pattern) {
    cache.clear();
    return;
  }
  const regex = new RegExp(pattern);
  for (const key of cache.keys()) {
    if (regex.test(key)) cache.delete(key);
  }
};

/**
 * Debounce function to prevent excessive function calls
 */
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Throttle function to limit function calls
 */
export const throttle = (func, limit) => {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      func(...args);
    }
  };
};

/**
 * Retry logic for failed API calls
 */
export const retryWithBackoff = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
};
