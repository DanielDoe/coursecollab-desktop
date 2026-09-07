import { useState, useEffect } from 'react'
import { offlineStorage } from '@/lib/offline-storage'
import { useToast } from './use-toast'

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true)
  const [queuedCount, setQueuedCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const { toast } = useToast()

  // Check online status
  useEffect(() => {
    if (typeof window === 'undefined') return

    setIsOnline(navigator.onLine)

    const handleOnline = async () => {
      setIsOnline(true)
      toast({
        title: "Back online! 🌐",
        description: "Syncing your offline messages..."
      })
      await syncOfflineMessages()
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast({
        title: "Offline mode 📴",
        description: "Your messages will sync when you reconnect",
        variant: "default"
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial sync check
    updateQueueCount()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const updateQueueCount = async () => {
    try {
      const unsynced = await offlineStorage.getUnsynced()
      setQueuedCount(unsynced.length)
    } catch (error) {
      console.error('Failed to get queue count:', error)
    }
  }

  const syncOfflineMessages = async () => {
    if (isSyncing) return

    setIsSyncing(true)
    
    try {
      const unsynced = await offlineStorage.getUnsynced()
      
      if (unsynced.length === 0) {
        setIsSyncing(false)
        return
      }

      console.log(`[Offline Sync] Syncing ${unsynced.length} messages`)

      let successCount = 0
      
      for (const item of unsynced) {
        try {
          // Send to server
          const response = await fetch('/api/ai-tutor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: item.message,
              studentId: item.studentId,
              context: item.context,
              offline: true
            })
          })

          if (response.ok) {
            // Mark as synced (delete from queue)
            await offlineStorage.markSynced(item.id!)
            successCount++
          }
        } catch (error) {
          console.error(`Failed to sync message ${item.id}:`, error)
          // Keep in queue for next sync attempt
        }
      }

      await updateQueueCount()

      if (successCount > 0) {
        toast({
          title: "Sync Complete ✅",
          description: `${successCount} message(s) synced successfully`
        })
      }

    } catch (error) {
      console.error('[Sync Error]', error)
      toast({
        title: "Sync failed",
        description: "Will retry automatically",
        variant: "destructive"
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const queueMessage = async (message: string, studentId?: string, context?: any) => {
    try {
      await offlineStorage.queueMessage({
        message,
        studentId,
        context,
        timestamp: Date.now(),
        synced: false
      })
      
      await updateQueueCount()
      
      toast({
        title: "Message queued 📥",
        description: "Will send when you're back online"
      })
    } catch (error) {
      console.error('Failed to queue message:', error)
      toast({
        title: "Failed to queue",
        description: "Please try again",
        variant: "destructive"
      })
    }
  }

  return {
    isOnline,
    queuedCount,
    isSyncing,
    queueMessage,
    syncOfflineMessages,
    updateQueueCount
  }
}

