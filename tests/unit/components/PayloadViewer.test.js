import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PayloadViewer from '../../../src/components/logs/PayloadViewer.vue'

describe('PayloadViewer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders "No body" when content is empty', () => {
    const wrapper = mount(PayloadViewer, {
      props: { content: '' },
    })
    expect(wrapper.text()).toContain('No body')
  })

  it('renders "No body" when content is not provided', () => {
    const wrapper = mount(PayloadViewer)
    expect(wrapper.text()).toContain('No body')
  })

  it('renders raw text for non-JSON content', () => {
    const wrapper = mount(PayloadViewer, {
      props: { content: 'Hello plain text' },
    })
    expect(wrapper.text()).toContain('Hello plain text')
    // Should not show Pretty/Raw toggle
    expect(wrapper.text()).not.toContain('Raw')
    expect(wrapper.text()).not.toContain('Pretty')
  })

  it('detects and pretty-prints JSON', () => {
    const json = '{"key":"value","num":42}'
    const wrapper = mount(PayloadViewer, {
      props: { content: json },
    })
    // Should show the toggle button
    expect(wrapper.text()).toContain('Raw')
    // Pretty-printed JSON should have the key and value visible
    expect(wrapper.text()).toContain('key')
    expect(wrapper.text()).toContain('value')
  })

  it('toggles between Pretty and Raw views', async () => {
    const json = '{"key":"value"}'
    const wrapper = mount(PayloadViewer, {
      props: { content: json },
    })

    // Initially in pretty mode, button shows "Raw"
    const toggleBtn = wrapper.find('button')
    expect(toggleBtn.text()).toBe('Raw')

    // Click to switch to raw
    await toggleBtn.trigger('click')
    expect(toggleBtn.text()).toBe('Pretty')

    // In raw mode, should show the raw JSON string
    expect(wrapper.text()).toContain('{"key":"value"}')
  })

  it('truncates content over 102400 chars', () => {
    const longContent = 'a'.repeat(110000)
    const wrapper = mount(PayloadViewer, {
      props: { content: longContent },
    })
    expect(wrapper.text()).toContain('Show full body')
  })

  it('shows full content when toggle is clicked', async () => {
    const longContent = 'x'.repeat(110000)
    const wrapper = mount(PayloadViewer, {
      props: { content: longContent },
    })

    const showFullBtn = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Show full body')
    expect(showFullBtn).toBeTruthy()

    await showFullBtn.trigger('click')
    expect(wrapper.text()).toContain('Collapse')
  })
})
