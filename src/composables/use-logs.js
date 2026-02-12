import { useLogsStore } from '../stores/logs.js'

export function useLogs() {
  return useLogsStore()
}
