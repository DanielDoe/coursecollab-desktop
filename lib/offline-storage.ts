// IndexedDB wrapper for offline conversation storage
// Provides client-side caching and offline queue management

const DB_NAME = 'ai-tutor-offline'
const DB_VERSION = 1

interface OfflineMessage {
  id?: number
  message: string
  studentId?: string
  context?: any
  timestamp: number
  synced: boolean
}

interface CachedConversation {
  id: string
  messages: any[]
  timestamp: number
  lastAccessed: number
}

class OfflineStorage {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    if (typeof window === 'undefined') return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result

        // Store for offline queue
        if (!db.objectStoreNames.contains('offlineQueue')) {
          const offlineStore = db.createObjectStore('offlineQueue', {
            keyPath: 'id',
            autoIncrement: true
          })
          offlineStore.createIndex('timestamp', 'timestamp', { unique: false })
          offlineStore.createIndex('synced', 'synced', { unique: false })
        }

        // Store for cached conversations
        if (!db.objectStoreNames.contains('conversations')) {
          const conversationStore = db.createObjectStore('conversations', {
            keyPath: 'id'
          })
          conversationStore.createIndex('timestamp', 'timestamp', { unique: false })
          conversationStore.createIndex('lastAccessed', 'lastAccessed', { unique: false })
        }

        // Store for response cache
        if (!db.objectStoreNames.contains('responseCache')) {
          const cacheStore = db.createObjectStore('responseCache', {
            keyPath: 'cacheKey'
          })
          cacheStore.createIndex('topic', 'topic', { unique: false })
          cacheStore.createIndex('hitCount', 'hitCount', { unique: false })
        }
      }
    })
  }

  // Offline Queue Management
  async queueMessage(message: OfflineMessage): Promise<number> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineQueue'], 'readwrite')
      const store = transaction.objectStore('offlineQueue')
      const request = store.add({
        ...message,
        synced: false
      })

      request.onsuccess = () => resolve(request.result as number)
      request.onerror = () => reject(request.error)
    })
  }

  async getUnsynced(): Promise<OfflineMessage[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineQueue'], 'readonly')
      const store = transaction.objectStore('offlineQueue')
      const index = store.index('synced')
      const request = index.getAll(false)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async markSynced(id: number): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineQueue'], 'readwrite')
      const store = transaction.objectStore('offlineQueue')
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Conversation Caching
  async cacheConversation(id: string, messages: any[]): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readwrite')
      const store = transaction.objectStore('conversations')
      const request = store.put({
        id,
        messages,
        timestamp: Date.now(),
        lastAccessed: Date.now()
      })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getCachedConversation(id: string): Promise<CachedConversation | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readwrite')
      const store = transaction.objectStore('conversations')
      const request = store.get(id)

      request.onsuccess = () => {
        const result = request.result
        
        if (result) {
          // Update last accessed
          store.put({
            ...result,
            lastAccessed: Date.now()
          })
        }
        
        resolve(result || null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getAllConversations(): Promise<CachedConversation[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readonly')
      const store = transaction.objectStore('conversations')
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // Response Cache
  async cacheResponseLocal(cacheKey: string, question: string, response: string, topic: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['responseCache'], 'readwrite')
      const store = transaction.objectStore('responseCache')
      
      const existingRequest = store.get(cacheKey)
      
      existingRequest.onsuccess = () => {
        const existing = existingRequest.result
        
        const data = {
          cacheKey,
          question,
          response,
          topic,
          hitCount: existing ? existing.hitCount + 1 : 1,
          lastUsed: Date.now(),
          createdAt: existing ? existing.createdAt : Date.now()
        }
        
        const putRequest = store.put(data)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      }
      
      existingRequest.onerror = () => reject(existingRequest.error)
    })
  }

  async getCachedResponseLocal(cacheKey: string): Promise<string | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['responseCache'], 'readwrite')
      const store = transaction.objectStore('responseCache')
      const request = store.get(cacheKey)

      request.onsuccess = () => {
        const result = request.result
        
        if (result) {
          // Update hit count and last used
          store.put({
            ...result,
            hitCount: result.hitCount + 1,
            lastUsed: Date.now()
          })
          
          resolve(result.response)
        } else {
          resolve(null)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Cleanup old data
  async cleanup(daysToKeep: number = 30): Promise<void> {
    if (!this.db) await this.init()

    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations', 'responseCache'], 'readwrite')
      
      // Clean conversations
      const conversationStore = transaction.objectStore('conversations')
      const conversationIndex = conversationStore.index('lastAccessed')
      const conversationRequest = conversationIndex.openCursor(IDBKeyRange.upperBound(cutoffTime))
      
      conversationRequest.onsuccess = (event: any) => {
        const cursor = event.target.result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }
}

// Singleton instance
export const offlineStorage = new OfflineStorage()

// Auto-initialize on import (client-side only)
if (typeof window !== 'undefined') {
  offlineStorage.init().catch(console.error)
}

