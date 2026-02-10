import { useEndpointsStore } from '../stores/endpoints.js'

export function useEndpoints() {
  return useEndpointsStore()
}
