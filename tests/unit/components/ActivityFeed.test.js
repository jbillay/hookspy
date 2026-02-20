import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ActivityFeed from '../../../src/components/dashboard/ActivityFeed.vue'

vi.mock('../../../src/composables/use-dashboard.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    formatTimeAgo: vi.fn(() => '2 min ago'),
  }
})

const primevuePlugin = {
  install(app) {
    app.use(PrimeVue, { unstyled: true })
  },
}

function mountFeed(props = {}) {
  return mount(ActivityFeed, {
    props: {
      logs: [],
      ...props,
    },
    global: {
      plugins: [primevuePlugin],
    },
  })
}

describe('ActivityFeed', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders empty state when no logs', () => {
    const wrapper = mountFeed({ logs: [] })
    expect(wrapper.text()).toContain('No recent activity')
  })

  it('renders log entries with endpoint name and method', () => {
    const logs = [
      {
        id: 'log-1',
        endpoint_name: 'My Webhook',
        request_method: 'POST',
        status: 'responded',
        received_at: new Date().toISOString(),
      },
      {
        id: 'log-2',
        endpoint_name: 'Other Hook',
        request_method: 'GET',
        status: 'pending',
        received_at: new Date().toISOString(),
      },
    ]
    const wrapper = mountFeed({ logs })
    expect(wrapper.text()).toContain('My Webhook')
    expect(wrapper.text()).toContain('Other Hook')
    expect(wrapper.text()).toContain('POST')
    expect(wrapper.text()).toContain('GET')
  })

  it('renders relative time for log entries', () => {
    const logs = [
      {
        id: 'log-1',
        endpoint_name: 'Test',
        request_method: 'POST',
        status: 'responded',
        received_at: new Date().toISOString(),
      },
    ]
    const wrapper = mountFeed({ logs })
    expect(wrapper.text()).toContain('2 min ago')
  })

  it('shows loading skeleton when loading and no logs', () => {
    const wrapper = mountFeed({ logs: [], loading: true })
    expect(wrapper.findComponent({ name: 'Skeleton' }).exists()).toBe(true)
  })

  it('does not show empty state when loading', () => {
    const wrapper = mountFeed({ logs: [], loading: true })
    expect(wrapper.text()).not.toContain('No recent activity')
  })
})
