import { sql } from "@/lib/db"
import crypto from "crypto"

/**
 * Normalize a question for cache key generation
 * Removes punctuation, extra spaces, converts to lowercase
 */
export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ')      // Normalize spaces
    .replace(/whats/g, 'what is')
    .replace(/hows/g, 'how is')
    .replace(/cant/g, 'cannot')
    .replace(/dont/g, 'do not')
    .replace(/im/g, 'i am')
}

/**
 * Generate a unique cache key for a question + context
 */
export function getCacheKey(question: string, topic?: string): string {
  const normalized = normalizeQuestion(question)
  const topicPart = topic || 'general'
  const hash = crypto.createHash('md5').update(normalized).digest('hex').substring(0, 16)
  return `${topicPart}_${hash}`
}

/**
 * Check if a cached response exists
 */
export async function getCachedResponse(question: string, topic?: string): Promise<string | null> {
  try {
    const cacheKey = getCacheKey(question, topic)
    
    const cached = await sql`
      SELECT response, hit_count 
      FROM ai_response_cache 
      WHERE cache_key = ${cacheKey}
        AND expires_at > NOW()
    `
    
    if (cached.length > 0) {
      // Update hit count and last used time
      await sql`
        UPDATE ai_response_cache 
        SET 
          hit_count = hit_count + 1,
          last_used = NOW()
        WHERE cache_key = ${cacheKey}
      `
      
      console.log(`[Cache HIT] Key: ${cacheKey}, Hits: ${cached[0].hit_count + 1}`)
      return cached[0].response
    }
    
    console.log(`[Cache MISS] Key: ${cacheKey}`)
    return null
  } catch (error) {
    console.error('[Cache Error]', error)
    return null
  }
}

/**
 * Store a response in the cache
 */
export async function cacheResponse(
  question: string, 
  response: string, 
  topic?: string,
  expiryDays: number = 30
): Promise<void> {
  try {
    const cacheKey = getCacheKey(question, topic)
    const normalized = normalizeQuestion(question)
    
    await sql`
      INSERT INTO ai_response_cache (
        cache_key, 
        question_normalized, 
        response, 
        topic,
        expires_at
      ) VALUES (
        ${cacheKey},
        ${normalized},
        ${response},
        ${topic || 'General'},
        NOW() + INTERVAL '${expiryDays} days'
      )
      ON CONFLICT (cache_key) 
      DO UPDATE SET
        response = EXCLUDED.response,
        hit_count = ai_response_cache.hit_count + 1,
        last_used = NOW(),
        expires_at = NOW() + INTERVAL '${expiryDays} days'
    `
    
    console.log(`[Cache STORE] Key: ${cacheKey}`)
  } catch (error) {
    console.error('[Cache Store Error]', error)
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  try {
    const stats = await sql`
      SELECT 
        COUNT(*) as total_cached,
        SUM(hit_count) as total_hits,
        AVG(hit_count) as avg_hits_per_entry,
        MAX(hit_count) as max_hits,
        COUNT(DISTINCT topic) as topics_cached
      FROM ai_response_cache
      WHERE expires_at > NOW()
    `
    
    const topQuestions = await sql`
      SELECT 
        question_normalized,
        topic,
        hit_count,
        last_used
      FROM ai_response_cache
      WHERE expires_at > NOW()
      ORDER BY hit_count DESC
      LIMIT 10
    `
    
    return {
      totalCached: parseInt(stats[0]?.total_cached || 0),
      totalHits: parseInt(stats[0]?.total_hits || 0),
      avgHitsPerEntry: parseFloat(stats[0]?.avg_hits_per_entry || 0).toFixed(2),
      maxHits: parseInt(stats[0]?.max_hits || 0),
      topicsCached: parseInt(stats[0]?.topics_cached || 0),
      topQuestions
    }
  } catch (error) {
    console.error('[Cache Stats Error]', error)
    return null
  }
}

/**
 * Clean up expired cache entries
 */
export async function cleanupCache(): Promise<number> {
  try {
    const result = await sql`
      DELETE FROM ai_response_cache
      WHERE expires_at < NOW()
         OR (hit_count = 1 AND created_at < NOW() - INTERVAL '7 days')
      RETURNING id
    `
    
    console.log(`[Cache Cleanup] Removed ${result.length} entries`)
    return result.length
  } catch (error) {
    console.error('[Cache Cleanup Error]', error)
    return 0
  }
}

