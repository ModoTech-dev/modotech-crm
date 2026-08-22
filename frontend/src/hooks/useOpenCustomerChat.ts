import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'

/**
 * Resolves "I clicked a customer, take me to their chat" — used by both
 * the Customers tab and global search results, so the two stay
 * consistent rather than each inventing their own navigation logic.
 */
export function useOpenCustomerChat() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  return async function openCustomerChat(customerId: string) {
    try {
      const res = await api.get(`/customers/${customerId}/primary-conversation/`)
      if (res.data.conversation) {
        navigate(`/inbox?conversation=${res.data.conversation.id}`)
      } else {
        showToast('No active conversation yet — use "New contact" in Inbox to start one.', 'error')
      }
    } catch {
      showToast("Couldn't open that conversation.", 'error')
    }
  }
}
