import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock channel instance
function createMockChannel() {
  const listeners = {}
  return {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn((cb) => {
      listeners._statusCb = cb
      // Simulate immediate subscription success
      setTimeout(() => cb('SUBSCRIBED'), 0)
      return { unsubscribe: vi.fn() }
    }),
    _triggerStatus: (status) => listeners._statusCb?.(status),
    listeners,
  }
}

const mockRemoveChannel = vi.fn()
let mockChannels = {}

vi.mock('../../../src/composables/use-supabase.js', () => ({
  useSupabase: () => ({
    client: {
      channel: (name) => {
        const ch = createMockChannel()
        mockChannels[name] = ch
        return ch
      },
      removeChannel: mockRemoveChannel,
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'test-token' } },
        }),
      },
    },
  }),
}))

// Must import after mocks
let useRealtimeTransport

describe('useRealtimeTransport', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockChannels = {}
    mockRemoveChannel.mockReset()
    // Reset module to clear singleton state
    vi.resetModules()
    const mod =
      await import('../../../src/composables/use-realtime-transport.js')
    useRealtimeTransport = mod.useRealtimeTransport
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns reactive refs and functions', () => {
    const transport = useRealtimeTransport()
    expect(transport.transportMode).toBeDefined()
    expect(transport.isConnected).toBeDefined()
    expect(typeof transport.subscribe).toBe('function')
    expect(typeof transport.unsubscribe).toBe('function')
    expect(typeof transport.updateSubscription).toBe('function')
    expect(typeof transport.seedSeenIds).toBe('function')
    expect(typeof transport.destroy).toBe('function')
  })

  it('starts in connecting mode', () => {
    const transport = useRealtimeTransport()
    expect(transport.transportMode.value).toBe('connecting')
    expect(transport.isConnected.value).toBe(false)
  })

  describe('subscribe', () => {
    it('registers a subscription and creates WS channel', async () => {
      const transport = useRealtimeTransport()
      const callback = vi.fn()

      transport.subscribe(
        'test-channel',
        { table: 'webhook_logs', events: ['INSERT'], endpointIds: ['ep-1'] },
        callback,
      )

      expect(mockChannels['test-channel']).toBeDefined()
      expect(mockChannels['test-channel'].on).toHaveBeenCalled()

      // Wait for subscribe callback
      await vi.advanceTimersByTimeAsync(10)
      expect(transport.transportMode.value).toBe('ws')
      expect(transport.isConnected.value).toBe(true)
    })

    it('does not create channel when endpointIds is empty', () => {
      const transport = useRealtimeTransport()
      const callback = vi.fn()

      transport.subscribe(
        'empty-channel',
        { table: 'webhook_logs', events: ['INSERT'], endpointIds: [] },
        callback,
      )

      expect(mockChannels['empty-channel']).toBeUndefined()
    })

    it('re-subscribes by unsubscribing first', async () => {
      const transport = useRealtimeTransport()
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      transport.subscribe(
        'test-channel',
        { table: 'webhook_logs', events: ['INSERT'], endpointIds: ['ep-1'] },
        callback1,
      )

      await vi.advanceTimersByTimeAsync(10)

      // Re-subscribe
      transport.subscribe(
        'test-channel',
        {
          table: 'webhook_logs',
          events: ['INSERT', 'UPDATE'],
          endpointIds: ['ep-1', 'ep-2'],
        },
        callback2,
      )

      expect(mockRemoveChannel).toHaveBeenCalled()
    })
  })

  describe('unsubscribe', () => {
    it('removes channel and cleans up', async () => {
      const transport = useRealtimeTransport()
      transport.subscribe(
        'test-channel',
        { table: 'webhook_logs', events: ['INSERT'], endpointIds: ['ep-1'] },
        vi.fn(),
      )

      await vi.advanceTimersByTimeAsync(10)

      transport.unsubscribe('test-channel')
      expect(mockRemoveChannel).toHaveBeenCalled()
      expect(transport.isConnected.value).toBe(false)
    })

    it('handles unsubscribing non-existent channel', () => {
      const transport = useRealtimeTransport()
      // Should not throw
      transport.unsubscribe('non-existent')
    })
  })

  describe('updateSubscription', () => {
    it('updates config and recreates WS channel', async () => {
      const transport = useRealtimeTransport()
      const callback = vi.fn()

      transport.subscribe(
        'test-channel',
        { table: 'webhook_logs', events: ['INSERT'], endpointIds: ['ep-1'] },
        callback,
      )

      await vi.advanceTimersByTimeAsync(10)

      transport.updateSubscription('test-channel', {
        table: 'webhook_logs',
        events: ['INSERT'],
        endpointIds: ['ep-1', 'ep-2'],
      })

      expect(mockRemoveChannel).toHaveBeenCalled()
    })

    it('does nothing for non-existent subscription', () => {
      const transport = useRealtimeTransport()
      // Should not throw
      transport.updateSubscription('non-existent', {
        table: 'webhook_logs',
        events: ['INSERT'],
        endpointIds: [],
      })
    })

    it('does not recreate channel when endpointIds is empty', async () => {
      const transport = useRealtimeTransport()
      const callback = vi.fn()

      transport.subscribe(
        'test-channel',
        { table: 'webhook_logs', events: ['INSERT'], endpointIds: ['ep-1'] },
        callback,
      )

      await vi.advanceTimersByTimeAsync(10)

      mockRemoveChannel.mockClear()

      transport.updateSubscription('test-channel', {
        table: 'webhook_logs',
        events: ['INSERT'],
        endpointIds: [],
      })

      // Old channel removed, no new channel created
      expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
    })
  })

  describe('seedSeenIds', () => {
    it('does not throw on non-array input', () => {
      const transport = useRealtimeTransport()
      transport.seedSeenIds(null)
      transport.seedSeenIds(undefined)
      transport.seedSeenIds('string')
    })

    it('accepts array of IDs', () => {
      const transport = useRealtimeTransport()
      transport.seedSeenIds(['id-1', 'id-2', 'id-3'])
      // No way to inspect directly, but it should not throw
    })

    it('handles exceeding MAX_SEEN_IDS', () => {
      const transport = useRealtimeTransport()
      const ids = Array.from({ length: 150 }, (_, i) => `id-${i}`)
      transport.seedSeenIds(ids)
      // Should trim to 100
    })
  })

  describe('destroy', () => {
    it('cleans up all subscriptions and resets state', async () => {
      const transport = useRealtimeTransport()

      transport.subscribe(
        'ch1',
        { table: 'webhook_logs', events: ['INSERT'], endpointIds: ['ep-1'] },
        vi.fn(),
      )
      transport.subscribe(
        'ch2',
        { table: 'webhook_logs', events: ['UPDATE'], endpointIds: ['ep-2'] },
        vi.fn(),
      )

      await vi.advanceTimersByTimeAsync(10)

      transport.destroy()

      expect(transport.transportMode.value).toBe('connecting')
      expect(transport.isConnected.value).toBe(false)
      expect(mockRemoveChannel).toHaveBeenCalled()
    })
  })

  describe('failure detection and polling fallback', () => {
    async function setupWithFailures(transport, config, callback) {
      // Mock fetch for polling
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            inserts: [],
            updates: [],
            server_time: new Date().toISOString(),
          }),
      })

      transport.subscribe('test-ch', config, callback)

      const ch = mockChannels['test-ch']
      expect(ch).toBeDefined()

      // Flush the auto-SUBSCRIBED timer first
      await vi.advanceTimersByTimeAsync(10)
      expect(transport.transportMode.value).toBe('ws')

      return ch.subscribe.mock.calls[0][0]
    }

    it('switches to polling after 3 consecutive failures', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()
      const callback = vi.fn()

      const statusCb = await setupWithFailures(
        transport,
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        callback,
      )

      // Trigger 3 failures
      statusCb('CHANNEL_ERROR', null)
      statusCb('CHANNEL_ERROR', null)
      statusCb('CHANNEL_ERROR', null)

      // Should have switched to polling
      expect(transport.transportMode.value).toBe('poll')

      consoleSpy.mockRestore()
    })

    it('resets failure count on SUBSCRIBED', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()

      const statusCb = await setupWithFailures(
        transport,
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        vi.fn(),
      )

      // 2 failures then success
      statusCb('CHANNEL_ERROR', null)
      statusCb('TIMED_OUT', null)
      statusCb('SUBSCRIBED', null)

      // Should stay in ws mode, not switch to polling
      expect(transport.transportMode.value).toBe('ws')
      expect(transport.isConnected.value).toBe(true)

      consoleSpy.mockRestore()
    })

    it('starts new failure window when window expires', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()

      const statusCb = await setupWithFailures(
        transport,
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        vi.fn(),
      )

      // 2 failures
      statusCb('CHANNEL_ERROR', null)
      statusCb('CLOSED', null)

      // Advance past the 30s window
      await vi.advanceTimersByTimeAsync(31000)

      // 1 more failure - should start new window, not trigger switch
      statusCb('CHANNEL_ERROR', null)

      expect(transport.transportMode.value).not.toBe('poll')

      consoleSpy.mockRestore()
    })
  })

  describe('polling mode', () => {
    // Helper: subscribe, flush auto-SUBSCRIBED, then trigger 3 failures to switch to poll mode
    async function switchToPollMode(transport, config, callback, fetchMock) {
      transport.subscribe('test-ch', config, callback)

      const ch = mockChannels['test-ch']
      // Flush auto-SUBSCRIBED timer
      await vi.advanceTimersByTimeAsync(10)
      expect(transport.transportMode.value).toBe('ws')

      const statusCb = ch.subscribe.mock.calls[0][0]

      // Set up fetch mock before triggering polling
      if (fetchMock) {
        globalThis.fetch = fetchMock
      }

      // Trigger 3 failures to switch to poll
      statusCb('CHANNEL_ERROR', null)
      statusCb('CHANNEL_ERROR', null)
      statusCb('CHANNEL_ERROR', null)

      expect(transport.transportMode.value).toBe('poll')
    }

    it('poll tick dispatches INSERT events to callbacks', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()
      const callback = vi.fn()

      await switchToPollMode(
        transport,
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        callback,
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              inserts: [{ id: 'log-new', endpoint_id: 'ep-1' }],
              updates: [],
              server_time: new Date().toISOString(),
            }),
        }),
      )

      // Wait for first poll tick to complete
      await vi.advanceTimersByTimeAsync(100)

      expect(callback).toHaveBeenCalledWith('INSERT', {
        id: 'log-new',
        endpoint_id: 'ep-1',
      })

      consoleSpy.mockRestore()
    })

    it('poll tick dispatches UPDATE events', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()
      const callback = vi.fn()

      await switchToPollMode(
        transport,
        {
          table: 'webhook_logs',
          events: ['UPDATE'],
          endpointIds: ['ep-1'],
        },
        callback,
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              inserts: [],
              updates: [{ id: 'log-upd', endpoint_id: 'ep-1' }],
              server_time: new Date().toISOString(),
            }),
        }),
      )

      await vi.advanceTimersByTimeAsync(100)

      expect(callback).toHaveBeenCalledWith('UPDATE', {
        id: 'log-upd',
        endpoint_id: 'ep-1',
      })

      consoleSpy.mockRestore()
    })

    it('poll tick handles 401 and attempts session refresh', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()

      await switchToPollMode(
        transport,
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        vi.fn(),
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
        }),
      )

      await vi.advanceTimersByTimeAsync(100)

      // Should still be in poll mode
      expect(transport.transportMode.value).toBe('poll')

      consoleSpy.mockRestore()
    })

    it('poll tick handles non-ok response', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()

      await switchToPollMode(
        transport,
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        vi.fn(),
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
        }),
      )

      await vi.advanceTimersByTimeAsync(100)

      expect(transport.isConnected.value).toBe(false)

      consoleSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })

    it('poll tick handles fetch error', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()

      await switchToPollMode(
        transport,
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        vi.fn(),
        vi.fn().mockRejectedValue(new Error('Network down')),
      )

      await vi.advanceTimersByTimeAsync(100)

      expect(transport.isConnected.value).toBe(false)

      consoleSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })

    it('poll tick skips duplicate IDs', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()
      const callback = vi.fn()

      await switchToPollMode(
        transport,
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        callback,
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              inserts: [{ id: 'same-id', endpoint_id: 'ep-1' }],
              updates: [],
              server_time: new Date().toISOString(),
            }),
        }),
      )

      // First poll
      await vi.advanceTimersByTimeAsync(100)

      // Second poll (2s later)
      await vi.advanceTimersByTimeAsync(2100)

      // Callback should only be called once (dedup)
      const insertCalls = callback.mock.calls.filter((c) => c[0] === 'INSERT')
      expect(insertCalls.length).toBe(1)

      consoleSpy.mockRestore()
    })

    it('does not dispatch to callbacks that do not match event type', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()
      const insertCallback = vi.fn()

      await switchToPollMode(
        transport,
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        insertCallback,
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              inserts: [],
              updates: [{ id: 'upd-1', endpoint_id: 'ep-1' }],
              server_time: new Date().toISOString(),
            }),
        }),
      )

      await vi.advanceTimersByTimeAsync(100)

      // Should not receive UPDATE events
      expect(insertCallback).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('does not dispatch when endpoint_id does not match', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()
      const callback = vi.fn()

      await switchToPollMode(
        transport,
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        callback,
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              inserts: [{ id: 'log-1', endpoint_id: 'ep-other' }],
              updates: [],
              server_time: new Date().toISOString(),
            }),
        }),
      )

      await vi.advanceTimersByTimeAsync(100)

      expect(callback).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('handles callback error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()
      const callback = vi.fn().mockImplementation(() => {
        throw new Error('callback crash')
      })

      await switchToPollMode(
        transport,
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        callback,
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              inserts: [{ id: 'log-1', endpoint_id: 'ep-1' }],
              updates: [],
              server_time: new Date().toISOString(),
            }),
        }),
      )

      // Should not throw
      await vi.advanceTimersByTimeAsync(100)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[transport] Callback error:',
        expect.any(Error),
      )

      consoleSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })

    it('isDuplicate evicts oldest IDs when exceeding MAX_SEEN_IDS', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()
      const callback = vi.fn()

      // Create 101 unique IDs to return across two polls
      // First poll: 100 unique IDs (fills capacity)
      const first100 = Array.from({ length: 100 }, (_, i) => ({
        id: `id-${i}`,
        endpoint_id: 'ep-1',
      }))

      let pollCount = 0
      const fetchMock = vi.fn().mockImplementation(() => {
        pollCount++
        if (pollCount === 1) {
          // First immediate poll: return 100 inserts to fill capacity
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                inserts: first100,
                updates: [],
                server_time: new Date().toISOString(),
              }),
          })
        }
        if (pollCount === 2) {
          // Second poll: return one new ID (triggers overflow eviction of id-0)
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                inserts: [{ id: 'id-100', endpoint_id: 'ep-1' }],
                updates: [],
                server_time: new Date().toISOString(),
              }),
          })
        }
        if (pollCount === 3) {
          // Third poll: return id-0 again (should NOT be deduped since it was evicted)
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                inserts: [{ id: 'id-0', endpoint_id: 'ep-1' }],
                updates: [],
                server_time: new Date().toISOString(),
              }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              inserts: [],
              updates: [],
              server_time: new Date().toISOString(),
            }),
        })
      })

      await switchToPollMode(
        transport,
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        callback,
        fetchMock,
      )

      // First poll tick runs immediately during switchToPolling
      await vi.advanceTimersByTimeAsync(100)

      // All 100 should be dispatched
      expect(callback).toHaveBeenCalledTimes(100)

      // Second poll (2s later): returns id-100 which triggers eviction of id-0
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(100)

      expect(callback).toHaveBeenCalledTimes(101)
      expect(callback).toHaveBeenCalledWith('INSERT', {
        id: 'id-100',
        endpoint_id: 'ep-1',
      })

      // Third poll (2s later): returns id-0 again
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(100)

      // id-0 was evicted so it should be re-dispatched (102 total calls)
      expect(callback).toHaveBeenCalledTimes(102)
      expect(callback).toHaveBeenCalledWith('INSERT', {
        id: 'id-0',
        endpoint_id: 'ep-1',
      })

      consoleSpy.mockRestore()
    })

    it('poll handles no auth token', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      // Re-mock with no session
      const supabaseModule =
        await import('../../../src/composables/use-supabase.js')
      vi.spyOn(supabaseModule, 'useSupabase').mockReturnValue({
        client: {
          channel: (name) => {
            const ch = createMockChannel()
            mockChannels[name] = ch
            return ch
          },
          removeChannel: mockRemoveChannel,
          auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
          },
        },
      })

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()

      globalThis.fetch = vi.fn()

      transport.subscribe(
        'test-ch',
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        vi.fn(),
      )

      const ch = mockChannels['test-ch']
      // Flush auto-SUBSCRIBED
      await vi.advanceTimersByTimeAsync(10)

      const statusCb = ch.subscribe.mock.calls[0][0]
      statusCb('CHANNEL_ERROR', null)
      statusCb('CHANNEL_ERROR', null)
      statusCb('CHANNEL_ERROR', null)

      await vi.advanceTimersByTimeAsync(100)

      // fetch should not be called when no token
      expect(globalThis.fetch).not.toHaveBeenCalled()
      expect(transport.isConnected.value).toBe(false)

      consoleSpy.mockRestore()
    })

    it('poll handles 401 with expired session (stops polling)', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      // Mock getSession to return null after first call
      let getSessionCallCount = 0
      const supabaseModule =
        await import('../../../src/composables/use-supabase.js')
      vi.spyOn(supabaseModule, 'useSupabase').mockReturnValue({
        client: {
          channel: (name) => {
            const ch = createMockChannel()
            mockChannels[name] = ch
            return ch
          },
          removeChannel: mockRemoveChannel,
          auth: {
            getSession: vi.fn().mockImplementation(() => {
              getSessionCallCount++
              if (getSessionCallCount <= 1) {
                return Promise.resolve({
                  data: { session: { access_token: 'token' } },
                })
              }
              return Promise.resolve({ data: { session: null } })
            }),
          },
        },
      })

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      })

      transport.subscribe(
        'test-ch',
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        vi.fn(),
      )

      const ch = mockChannels['test-ch']
      await vi.advanceTimersByTimeAsync(10)

      const statusCb = ch.subscribe.mock.calls[0][0]
      statusCb('CHANNEL_ERROR', null)
      statusCb('CHANNEL_ERROR', null)
      statusCb('CHANNEL_ERROR', null)

      await vi.advanceTimersByTimeAsync(100)

      expect(transport.isConnected.value).toBe(false)

      consoleSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    })
  })

  describe('subscribe in poll mode', () => {
    async function switchToPollModeForSub(transport, config, callback) {
      transport.subscribe('setup-ch', config, callback)

      const ch = mockChannels['setup-ch']
      await vi.advanceTimersByTimeAsync(10)

      const statusCb = ch.subscribe.mock.calls[0][0]

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            inserts: [],
            updates: [],
            server_time: new Date().toISOString(),
          }),
      })

      statusCb('CHANNEL_ERROR', null)
      statusCb('CHANNEL_ERROR', null)
      statusCb('CHANNEL_ERROR', null)

      expect(transport.transportMode.value).toBe('poll')
    }

    it('does not create WS channel when subscribing in poll mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()

      await switchToPollModeForSub(
        transport,
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        vi.fn(),
      )

      // Subscribe a new channel in poll mode
      transport.subscribe(
        'new-ch',
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-2'],
        },
        vi.fn(),
      )

      // No new WS channel should be created
      expect(mockChannels['new-ch']).toBeUndefined()

      consoleSpy.mockRestore()
    })
  })

  describe('probeWebSocket', () => {
    async function setupPollMode(transport) {
      const callback = vi.fn()

      transport.subscribe(
        'test-ch',
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        callback,
      )

      const ch = mockChannels['test-ch']
      await vi.advanceTimersByTimeAsync(10)

      const statusCb = ch.subscribe.mock.calls[0][0]

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            inserts: [],
            updates: [],
            server_time: new Date().toISOString(),
          }),
      })

      statusCb('CHANNEL_ERROR', null)
      statusCb('CHANNEL_ERROR', null)
      statusCb('CHANNEL_ERROR', null)

      expect(transport.transportMode.value).toBe('poll')
      return callback
    }

    it('switches back to WS when probe succeeds', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}
      mockRemoveChannel.mockResolvedValue(undefined)

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()

      await setupPollMode(transport)

      // Advance to trigger the probe interval (60s)
      await vi.advanceTimersByTimeAsync(60000)

      // Probe channel should have been created
      const probeChannel = mockChannels['transport-probe']
      expect(probeChannel).toBeDefined()

      // Simulate probe success: trigger SUBSCRIBED
      const probeCb = probeChannel.subscribe.mock.calls[0][0]
      probeCb('SUBSCRIBED')

      // Allow promise to resolve
      await vi.advanceTimersByTimeAsync(100)

      // Should have switched back to connecting/ws
      expect(transport.transportMode.value).not.toBe('poll')

      consoleSpy.mockRestore()
    })

    it('stays in poll mode when probe fails', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}
      mockRemoveChannel.mockResolvedValue(undefined)

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()

      await setupPollMode(transport)

      // Advance to trigger probe
      await vi.advanceTimersByTimeAsync(60000)

      const probeChannel = mockChannels['transport-probe']
      expect(probeChannel).toBeDefined()

      // Simulate probe failure
      const probeCb = probeChannel.subscribe.mock.calls[0][0]
      probeCb('CHANNEL_ERROR')

      await vi.advanceTimersByTimeAsync(100)

      // Should remain in poll mode
      expect(transport.transportMode.value).toBe('poll')

      consoleSpy.mockRestore()
    })

    it('stays in poll mode when probe times out', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}
      mockRemoveChannel.mockResolvedValue(undefined)

      // Override channel creation to NOT auto-subscribe for probe channel
      const supabaseModule =
        await import('../../../src/composables/use-supabase.js')
      const origClient = supabaseModule.useSupabase().client
      const origChannel = origClient.channel
      origClient.channel = vi.fn().mockImplementation((name) => {
        if (name === 'transport-probe') {
          // Create a channel that does NOT auto-fire SUBSCRIBED
          const ch = {
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn((cb) => {
              // Store callback but do NOT trigger SUBSCRIBED
              ch._statusCb = cb
              return { unsubscribe: vi.fn() }
            }),
            _statusCb: null,
          }
          mockChannels[name] = ch
          return ch
        }
        const ch = createMockChannel()
        mockChannels[name] = ch
        return ch
      })

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()

      await setupPollMode(transport)

      // Advance to trigger probe interval (60s)
      await vi.advanceTimersByTimeAsync(60000)

      const probeChannel = mockChannels['transport-probe']
      expect(probeChannel).toBeDefined()

      // Don't trigger any status callback - let the 10s timeout fire
      await vi.advanceTimersByTimeAsync(10100)

      // Should remain in poll mode (timeout resolved false)
      expect(transport.transportMode.value).toBe('poll')

      origClient.channel = origChannel
      consoleSpy.mockRestore()
    })

    it('handles probe error with cleanup', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}

      // Make removeChannel throw on probe cleanup
      let removeCallCount = 0
      mockRemoveChannel.mockImplementation(() => {
        removeCallCount++
        // Throw only for the probe channel cleanup (later calls)
        if (removeCallCount > 1) {
          throw new Error('cleanup error')
        }
        return Promise.resolve()
      })

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()

      await setupPollMode(transport)

      // Make channel() throw to trigger the catch block
      const supabaseModule =
        await import('../../../src/composables/use-supabase.js')
      const client = supabaseModule.useSupabase().client
      const originalChannel = client.channel
      client.channel = vi.fn().mockImplementation((name) => {
        if (name === 'transport-probe') {
          const ch = createMockChannel()
          mockChannels[name] = ch
          // Make subscribe throw
          ch.subscribe = vi.fn(() => {
            throw new Error('subscribe crash')
          })
          return ch
        }
        return originalChannel(name)
      })

      // Advance to trigger probe
      await vi.advanceTimersByTimeAsync(60000)

      await vi.advanceTimersByTimeAsync(100)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[transport] Probe error:',
        expect.any(Error),
      )

      // Should still be in poll mode
      expect(transport.transportMode.value).toBe('poll')

      client.channel = originalChannel
      consoleSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })

    it('ignores late status callbacks after probe resolved', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}
      mockRemoveChannel.mockResolvedValue(undefined)

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()

      await setupPollMode(transport)

      // Advance to trigger probe
      await vi.advanceTimersByTimeAsync(60000)

      const probeChannel = mockChannels['transport-probe']
      const probeCb = probeChannel.subscribe.mock.calls[0][0]

      // Resolve with CHANNEL_ERROR first
      probeCb('CHANNEL_ERROR')
      await vi.advanceTimersByTimeAsync(10)

      // Late SUBSCRIBED should be ignored (resolved flag is true)
      probeCb('SUBSCRIBED')
      await vi.advanceTimersByTimeAsync(100)

      // Should remain in poll mode because first resolution was failure
      expect(transport.transportMode.value).toBe('poll')

      consoleSpy.mockRestore()
    })
  })

  describe('switchToWebSocket', () => {
    it('recreates WS channels for all subscriptions', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}
      mockRemoveChannel.mockResolvedValue(undefined)

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()

      // Subscribe two channels
      transport.subscribe(
        'ch1',
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        vi.fn(),
      )
      transport.subscribe(
        'ch2',
        {
          table: 'webhook_logs',
          events: ['UPDATE'],
          endpointIds: ['ep-2'],
        },
        vi.fn(),
      )

      await vi.advanceTimersByTimeAsync(10)

      // Switch to poll mode
      const ch1 = mockChannels['ch1']
      const statusCb = ch1.subscribe.mock.calls[0][0]

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            inserts: [],
            updates: [],
            server_time: new Date().toISOString(),
          }),
      })

      statusCb('CHANNEL_ERROR', null)
      statusCb('CHANNEL_ERROR', null)
      statusCb('CHANNEL_ERROR', null)

      expect(transport.transportMode.value).toBe('poll')

      // Clear channel tracking to detect new channel creation
      mockChannels = {}
      mockRemoveChannel.mockClear()

      // Trigger probe
      await vi.advanceTimersByTimeAsync(60000)

      const probeChannel = mockChannels['transport-probe']
      expect(probeChannel).toBeDefined()

      const probeCb = probeChannel.subscribe.mock.calls[0][0]
      probeCb('SUBSCRIBED')

      await vi.advanceTimersByTimeAsync(100)

      // Both channels should be recreated
      expect(mockChannels['ch1']).toBeDefined()
      expect(mockChannels['ch2']).toBeDefined()

      consoleSpy.mockRestore()
    })

    it('skips subscriptions with empty endpointIds during switchToWebSocket', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      vi.resetModules()
      mockChannels = {}
      mockRemoveChannel.mockResolvedValue(undefined)

      const mod =
        await import('../../../src/composables/use-realtime-transport.js')
      const transport = mod.useRealtimeTransport()

      // Subscribe one channel with endpoints and one without
      transport.subscribe(
        'active-ch',
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        vi.fn(),
      )
      transport.subscribe(
        'empty-ch',
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: [],
        },
        vi.fn(),
      )

      await vi.advanceTimersByTimeAsync(10)

      const ch = mockChannels['active-ch']
      const statusCb = ch.subscribe.mock.calls[0][0]

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            inserts: [],
            updates: [],
            server_time: new Date().toISOString(),
          }),
      })

      statusCb('CHANNEL_ERROR', null)
      statusCb('CHANNEL_ERROR', null)
      statusCb('CHANNEL_ERROR', null)

      mockChannels = {}

      // Trigger probe
      await vi.advanceTimersByTimeAsync(60000)

      const probeChannel = mockChannels['transport-probe']
      const probeCb = probeChannel.subscribe.mock.calls[0][0]
      probeCb('SUBSCRIBED')

      await vi.advanceTimersByTimeAsync(100)

      // active-ch should be recreated, empty-ch should NOT
      expect(mockChannels['active-ch']).toBeDefined()
      expect(mockChannels['empty-ch']).toBeUndefined()

      consoleSpy.mockRestore()
    })
  })

  describe('WS channel callbacks', () => {
    it('dispatches postgres_changes payload to callback', async () => {
      const transport = useRealtimeTransport()
      const callback = vi.fn()

      transport.subscribe(
        'test-ch',
        {
          table: 'webhook_logs',
          events: ['INSERT'],
          endpointIds: ['ep-1'],
        },
        callback,
      )

      const ch = mockChannels['test-ch']
      // Get the callback passed to ch.on
      const onCall = ch.on.mock.calls[0]
      const eventCallback = onCall[2]

      // Simulate a payload
      eventCallback({
        eventType: 'INSERT',
        new: { id: 'log-1', endpoint_id: 'ep-1' },
      })

      expect(callback).toHaveBeenCalledWith('INSERT', {
        id: 'log-1',
        endpoint_id: 'ep-1',
      })
    })
  })
})
