<script setup lang="ts">
import { ref } from 'vue';
import type { Service } from '@/types';
import { servicesApi } from '@/api/services';

const props = defineProps<{
  service: Service;
}>();

const emit = defineEmits<{
  edit: [service: Service];
}>();

const copying = ref(false);
const toast = ref<{ show: boolean; message: string; type: 'success' | 'error' }>({
  show: false,
  message: '',
  type: 'success'
});

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = { show: true, message, type };
  setTimeout(() => {
    toast.value.show = false;
  }, 3000);
}

async function handleOpen() {
  // Open URL in new tab
  if (props.service.url) {
    window.open(props.service.url, '_blank');
  }

  // If service has credentials, copy them to clipboard
  if (props.service.username || props.service.password) {
    try {
      copying.value = true;
      const res = await servicesApi.copyCredentials(props.service.id);

      if (res.data?.hasCredentials && res.data.username && res.data.password) {
        const credentials = `${res.data.username}\n${res.data.password}`;
        await navigator.clipboard.writeText(credentials);
        showToast('Credentials copied to clipboard');
      }
    } catch (error) {
      console.error('Failed to copy credentials:', error);
      showToast('Failed to copy credentials', 'error');
    } finally {
      copying.value = false;
    }
  }
}

function handleEdit() {
  emit('edit', props.service);
}

function getDisplayIcon() {
  return props.service.icon || '🔗';
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-border-main p-4 hover:shadow-md transition-shadow">
    <!-- Toast Notification -->
    <div
      v-if="toast.show"
      class="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm"
      :class="toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'"
    >
      {{ toast.message }}
    </div>

    <!-- Card Header -->
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-3">
        <span class="text-2xl">{{ getDisplayIcon() }}</span>
        <h3 class="font-medium text-text-main">{{ service.name }}</h3>
      </div>
      <button
        @click="handleEdit"
        class="p-1.5 text-text-sub hover:text-text-main hover:bg-gray-100 rounded transition-colors"
        title="Edit service"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    </div>

    <!-- Description -->
    <p class="text-sm text-text-sub mb-4 line-clamp-2 min-h-[2.5rem]">
      {{ service.description || 'No description' }}
    </p>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <button
        @click="handleOpen"
        :disabled="!service.url"
        class="flex-1 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        <svg v-if="copying" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>{{ copying ? 'Opening...' : 'Open' }}</span>
      </button>
    </div>
  </div>
</template>