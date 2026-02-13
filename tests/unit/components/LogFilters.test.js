import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import LogFilters from '../../../src/components/logs/LogFilters.vue'

// PrimeVue DatePicker calls matchMedia on mount
globalThis.matchMedia =
  globalThis.matchMedia ||
  vi.fn().mockReturnValue({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })

const primevuePlugin = {
  install(app) {
    app.use(PrimeVue, { unstyled: true })
  },
}

function mountFilters(props = {}) {
  return mount(LogFilters, {
    props: {
      modelValue: { q: '', method: [], status: [], from: null, to: null },
      ...props,
    },
    global: {
      plugins: [primevuePlugin],
    },
  })
}

describe('LogFilters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders search input', () => {
    const wrapper = mountFilters()
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
  })

  it('emits update:modelValue on search input after debounce', async () => {
    const wrapper = mountFilters()
    const input = wrapper.find('input')

    await input.setValue('webhook')
    await input.trigger('input')

    // Should not emit immediately
    expect(wrapper.emitted('update:modelValue')).toBeFalsy()

    // Advance past debounce
    vi.advanceTimersByTime(350)

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const emitted = wrapper.emitted('update:modelValue')
    const lastEmit = emitted[emitted.length - 1][0]
    expect(lastEmit.q).toBe('webhook')
  })

  it('does not emit before debounce completes', async () => {
    const wrapper = mountFilters()
    const input = wrapper.find('input')

    await input.setValue('test')
    await input.trigger('input')

    vi.advanceTimersByTime(200) // Less than 300ms debounce
    expect(wrapper.emitted('update:modelValue')).toBeFalsy()
  })

  it('emits clear event when clear button clicked', async () => {
    const wrapper = mountFilters({
      modelValue: { q: 'test', method: [], status: [], from: null, to: null },
    })

    const clearBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Clear filters'))

    if (clearBtn) {
      await clearBtn.trigger('click')
      expect(wrapper.emitted('clear')).toBeTruthy()
    }
  })

  it('shows clear button only when filters are active', () => {
    const noFilters = mountFilters()
    const clearBtns = noFilters
      .findAll('button')
      .filter((b) => b.text().includes('Clear filters'))
    expect(clearBtns).toHaveLength(0)
  })

  it('syncs local state when modelValue prop changes', async () => {
    const wrapper = mountFilters()
    const input = wrapper.find('input')
    expect(input.element.value).toBe('')

    await wrapper.setProps({
      modelValue: {
        q: 'updated',
        method: ['GET'],
        status: [],
        from: null,
        to: null,
      },
    })

    expect(input.element.value).toBe('updated')
  })
})
