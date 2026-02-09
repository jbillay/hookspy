import { useAuthStore } from '../stores/auth.js'

export function useAuth() {
  return useAuthStore()
}
