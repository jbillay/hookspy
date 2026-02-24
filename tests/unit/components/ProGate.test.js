import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../../src/composables/use-supabase.js', () => ({
  useSupabase: () => ({
    client: {
      auth: {
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    },
  }),
}))

// Mock useUserPlan with configurable values
const mockCanReplay = { value: false }
const mockCanSearch = { value: false }
const mockCanInjectHeaders = { value: false }

vi.mock('../../../src/composables/use-user-plan.js', () => ({
  useUserPlan: () => ({
    canReplay: mockCanReplay,
    canSearch: mockCanSearch,
    canInjectHeaders: mockCanInjectHeaders,
  }),
}))

// Mock PrimeVue Tag
const MockTag = {
  name: 'Tag',
  template: '<span class="mock-tag"><slot /></span>',
  props: ['value', 'severity'],
}

describe('ProGate component', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockCanReplay.value = false
    mockCanSearch.value = false
    mockCanInjectHeaders.value = false
  })

  it('renders slot content when feature is allowed', async () => {
    mockCanReplay.value = true

    const { default: ProGate } =
      await import('../../../src/components/shared/ProGate.vue')
    const wrapper = mount(ProGate, {
      props: { feature: 'replay' },
      slots: { default: '<button>Replay</button>' },
      global: {
        stubs: { Tag: MockTag },
      },
    })

    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.find('.mock-tag').exists()).toBe(false)
  })

  it('renders locked state when feature is not allowed', async () => {
    mockCanReplay.value = false

    const { default: ProGate } =
      await import('../../../src/components/shared/ProGate.vue')
    const wrapper = mount(ProGate, {
      props: { feature: 'replay' },
      slots: { default: '<button>Replay</button>' },
      global: {
        stubs: { Tag: MockTag },
      },
    })

    // Content should be in the disabled overlay
    expect(wrapper.find('.opacity-40').exists()).toBe(true)
    expect(wrapper.find('.mock-tag').exists()).toBe(true)
  })

  it('checks canSearch for search feature', async () => {
    mockCanSearch.value = true

    const { default: ProGate } =
      await import('../../../src/components/shared/ProGate.vue')
    const wrapper = mount(ProGate, {
      props: { feature: 'search' },
      slots: { default: '<div>Search</div>' },
      global: {
        stubs: { Tag: MockTag },
      },
    })

    expect(wrapper.find('.opacity-40').exists()).toBe(false)
  })

  it('checks canInjectHeaders for headers feature', async () => {
    mockCanInjectHeaders.value = false

    const { default: ProGate } =
      await import('../../../src/components/shared/ProGate.vue')
    const wrapper = mount(ProGate, {
      props: { feature: 'headers' },
      slots: { default: '<div>Headers</div>' },
      global: {
        stubs: { Tag: MockTag },
      },
    })

    expect(wrapper.find('.opacity-40').exists()).toBe(true)
  })
})
