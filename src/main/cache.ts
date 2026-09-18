export interface CacheOptions {
  ttl: number // 缓存过期时间，单位为毫秒
  refreshFallbackToCache?: boolean // 如果刷新时获取新值失败，是否从缓存中继续使用过期的旧值
  cleanupInterval?: number // 清理过期条目的间隔（毫秒），0 或 undefined 表示禁用
}

// In-memory cache store
interface CacheItem<T> {
  value: T
  expireAt: number
}
const memoryCache = new Map<string, CacheItem<any>>()
let cleanupTimer: ReturnType<typeof setInterval> | undefined

export function cleanup(): void {
  const now = Date.now()
  for (const [key, item] of memoryCache) {
    if (item.expireAt <= now) memoryCache.delete(key)
  }
}

export function startCacheCleanup(intervalMs: number = 60_000): void {
  if (cleanupTimer) clearInterval(cleanupTimer)
  cleanupTimer = setInterval(cleanup, intervalMs)
}

export async function cache<T>(
  key: string,
  getter: () => Promise<T>,
  options: CacheOptions
): Promise<T> {
  let cache = memoryCache.get(key) as CacheItem<T> | undefined

  if (cache && cache.expireAt > Date.now()) {
    return cache.value
  }

  try {
    const newValue = await getter()
    cache = {
      value: newValue,
      expireAt: Date.now() + options.ttl,
    }
    memoryCache.set(key, cache)
    return newValue
  } catch (e) {
    if (options.refreshFallbackToCache && cache) {
      return cache.value
    }
    throw e
  }
}
