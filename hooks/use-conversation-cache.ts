import { useState, useEffect } from 'react'
import { offlineStorage } from '@/lib/offline-storage'

interface Message {
  id: string
  role: 'student' | 'ai'
  content: string
  timestamp: Date
  topic?: string
}

export function useConversationCache(conversationId: string) {
  const [cachedMessages, setCachedMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load cached conversation on mount
  useEffect(() => {
    loadFromCache()
  }, [conversationId])

  const loadFromCache = async () => {
    setIsLoading(true)
    try {
      const cached = await offlineStorage.getCachedConversation(conversationId)
      
      if (cached) {
        console.log(`[Cache] Loaded ${cached.messages.length} messages from IndexedDB`)
        setCachedMessages(cached.messages)
      }
    } catch (error) {
      console.error('[Cache Load Error]', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateCache = async (messages: Message[]) => {
    try {
      await offlineStorage.cacheConversation(conversationId, messages)
      setCachedMessages(messages)
      console.log(`[Cache] Saved ${messages.length} messages to IndexedDB`)
    } catch (error) {
      console.error('[Cache Update Error]', error)
    }
  }

  const clearCache = async () => {
    try {
      // Clear from IndexedDB by setting empty array
      await offlineStorage.cacheConversation(conversationId, [])
      setCachedMessages([])
      console.log('[Cache] Cleared conversation cache')
    } catch (error) {
      console.error('[Cache Clear Error]', error)
    }
  }

  return {
    cachedMessages,
    isLoading,
    updateCache,
    clearCache
  }
}

// Hook for managing response cache
export function useResponseCache() {
  const getCached = async (question: string, topic?: string): Promise<string | null> => {
    try {
      const cacheKey = generateCacheKey(question, topic)
      return await offlineStorage.getCachedResponseLocal(cacheKey)
    } catch (error) {
      console.error('[Response Cache Get Error]', error)
      return null
    }
  }

  const saveToCache = async (question: string, response: string, topic?: string): Promise<void> => {
    try {
      const cacheKey = generateCacheKey(question, topic)
      await offlineStorage.cacheResponseLocal(cacheKey, question, response, topic || 'General')
    } catch (error) {
      console.error('[Response Cache Save Error]', error)
    }
  }

  return {
    getCached,
    saveToCache
  }
}

function generateCacheKey(question: string, topic?: string): string {
  const normalized = question
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '_')
  
  const topicPart = topic ? topic.toLowerCase().replace(/\s+/g, '_') : 'general'
  return `${topicPart}_${normalized.substring(0, 50)}`
}

