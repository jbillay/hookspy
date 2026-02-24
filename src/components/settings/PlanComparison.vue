<script setup>
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const features = [
  {
    feature: 'Endpoints',
    free: '3',
    pro: '25',
  },
  {
    feature: 'Requests / min',
    free: '30',
    pro: '120',
  },
  {
    feature: 'Max body size',
    free: '256 KB',
    pro: '5 MB',
  },
  {
    feature: 'Log retention',
    free: '6 hours',
    pro: '7 days',
  },
  {
    feature: 'Max timeout',
    free: '30s',
    pro: '55s',
  },
  {
    feature: 'Replay webhooks',
    free: false,
    pro: true,
  },
  {
    feature: 'Advanced search',
    free: false,
    pro: true,
  },
  {
    feature: 'Custom headers',
    free: false,
    pro: true,
  },
]
</script>

<template>
  <DataTable
    :value="features"
    class="text-sm"
    :pt="{ table: { class: 'w-full' } }"
  >
    <Column field="feature" header="Feature" />
    <Column field="free" header="Free">
      <template #body="{ data }">
        <span v-if="typeof data.free === 'boolean'">
          <i
            :class="
              data.free
                ? 'pi pi-check text-green-600'
                : 'pi pi-times text-neutral-400'
            "
          />
        </span>
        <span v-else>{{ data.free }}</span>
      </template>
    </Column>
    <Column field="pro" header="Pro">
      <template #body="{ data }">
        <span v-if="typeof data.pro === 'boolean'">
          <i
            :class="
              data.pro
                ? 'pi pi-check text-green-600'
                : 'pi pi-times text-neutral-400'
            "
          />
        </span>
        <span v-else class="font-medium text-brand">{{ data.pro }}</span>
      </template>
    </Column>
  </DataTable>
</template>
