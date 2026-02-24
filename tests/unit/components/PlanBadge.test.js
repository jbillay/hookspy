import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

// Mock PrimeVue Tag component
const MockTag = {
  name: 'Tag',
  template: '<span :class="severity">{{ value }}</span>',
  props: ['value', 'severity'],
}

describe('PlanBadge component', () => {
  it('renders "Free" for free plan', async () => {
    const { default: PlanBadge } =
      await import('../../../src/components/settings/PlanBadge.vue')
    const wrapper = mount(PlanBadge, {
      props: { plan: 'free' },
      global: {
        stubs: { Tag: MockTag },
      },
    })

    expect(wrapper.text()).toContain('Free')
  })

  it('renders "Pro" for pro plan', async () => {
    const { default: PlanBadge } =
      await import('../../../src/components/settings/PlanBadge.vue')
    const wrapper = mount(PlanBadge, {
      props: { plan: 'pro' },
      global: {
        stubs: { Tag: MockTag },
      },
    })

    expect(wrapper.text()).toContain('Pro')
  })

  it('uses success severity for pro plan', async () => {
    const { default: PlanBadge } =
      await import('../../../src/components/settings/PlanBadge.vue')
    const wrapper = mount(PlanBadge, {
      props: { plan: 'pro' },
      global: {
        stubs: { Tag: MockTag },
      },
    })

    expect(wrapper.find('.success').exists()).toBe(true)
  })

  it('uses secondary severity for free plan', async () => {
    const { default: PlanBadge } =
      await import('../../../src/components/settings/PlanBadge.vue')
    const wrapper = mount(PlanBadge, {
      props: { plan: 'free' },
      global: {
        stubs: { Tag: MockTag },
      },
    })

    expect(wrapper.find('.secondary').exists()).toBe(true)
  })

  it('defaults to free plan when no prop', async () => {
    const { default: PlanBadge } =
      await import('../../../src/components/settings/PlanBadge.vue')
    const wrapper = mount(PlanBadge, {
      global: {
        stubs: { Tag: MockTag },
      },
    })

    expect(wrapper.text()).toContain('Free')
  })
})
