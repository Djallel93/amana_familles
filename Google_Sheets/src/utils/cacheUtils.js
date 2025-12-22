/**
 * @file src/utils/cacheUtils.js (NEW)
 * @description Cache wrapper functions with consistent error handling
 */

/**
 * Get value from cache with error handling
 * @param {string} key - Cache key
 * @returns {string|null} Cached value or null
 */
function getCached(key) {
    try {
        const cache = CacheService.getScriptCache();
        return cache.get(key);
    } catch (error) {
        logWarning(`Cache get failed for key: ${key}`, error);
        return null;
    }
}

/**
 * Set value in cache with error handling
 * @param {string} key - Cache key
 * @param {string} value - Value to cache
 * @param {number} ttl - Time to live in seconds
 * @returns {boolean} Success status
 */
function setCached(key, value, ttl) {
    try {
        const cache = CacheService.getScriptCache();
        cache.put(key, value, ttl);
        return true;
    } catch (error) {
        logWarning(`Cache set failed for key: ${key}`, error);
        return false;
    }
}

/**
 * Remove value from cache with error handling
 * @param {string} key - Cache key
 * @returns {boolean} Success status
 */
function removeCached(key) {
    try {
        const cache = CacheService.getScriptCache();
        cache.remove(key);
        return true;
    } catch (error) {
        logWarning(`Cache remove failed for key: ${key}`, error);
        return false;
    }
}

/**
 * Remove multiple keys from cache
 * @param {string[]} keys - Array of cache keys
 * @returns {boolean} Success status
 */
function removeCachedMultiple(keys) {
    try {
        const cache = CacheService.getScriptCache();
        keys.forEach(key => cache.remove(key));
        return true;
    } catch (error) {
        logWarning(`Cache remove multiple failed`, error);
        return false;
    }
}

/**
 * Clear all cache entries
 * @returns {boolean} Success status
 */
function clearAllCache() {
    try {
        const cache = CacheService.getScriptCache();
        cache.removeAll([]);
        return true;
    } catch (error) {
        logError('Failed to clear cache', error);
        return false;
    }
}