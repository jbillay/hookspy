import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import HeaderInjectionEditor from '../../../../src/components/endpoints/HeaderInjectionEditor.vue'

function mountEditor(props = {}) {
  return mount(HeaderInjectionEditor, {
    props: { modelValue: {}, ...props },
    global: {
      plugins: [
        [
          PrimeVue,
          {
            theme: { preset: Aura },
          },
        ],
      ],
    },
  })
}

describe('HeaderInjectionEditor', () => {
  it('renders empty state when no headers', () => {
    const wrapper = mountEditor()
    expect(wrapper.text()).toContain('No custom headers configured')
  })

  it('renders existing headers as rows', () => {
    const wrapper = mountEditor({
      modelValue: {
        'X-Api-Key': 'secret123',
        'X-Custom-Id': 'project-1',
      },
    })
    const inputs = wrapper.findAll('input')
    expect(inputs.length).toBe(4)
  })

  it('adds a new row when Add Header is clicked', async () => {
    const wrapper = mountEditor()

    await wrapper.find('button').trigger('click')
    const inputs = wrapper.findAll('input')
    expect(inputs.length).toBe(2)
  })

  it('removes a row and emits update', async () => {
    const wrapper = mountEditor({
      modelValue: { 'X-Api-Key': 'secret' },
    })

    const removeBtn = wrapper.findAll('button').at(1)
    await removeBtn.trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted[emitted.length - 1][0]).toEqual({})
  })

  it('emits updated object when key changes', async () => {
    const wrapper = mountEditor()

    await wrapper.find('button').trigger('click')

    const keyInput = wrapper.findAll('input').at(0)
    await keyInput.setValue('X-New-Header')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
  })

  it('ignores empty keys in emitted object', async () => {
    const wrapper = mountEditor()

    await wrapper.find('button').trigger('click')

    const valueInput = wrapper.findAll('input').at(1)
    await valueInput.setValue('some-value')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    const lastEmit = emitted[emitted.length - 1][0]
    expect(Object.keys(lastEmit)).toHaveLength(0)
  })
})
