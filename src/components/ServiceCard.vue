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
        showToast(`已复制 ${props.service.name} 的凭据到剪贴板`);
      }
    } catch (error) {
      console.error('Failed to copy credentials:', error);
      showToast('复制凭据失败', 'error');
    } finally {
      copying.value = false;
    }
  } else {
    showToast(`已打开 ${props.service.name}`);
  }
}

function handleEdit() {
  emit('edit', props.service);
}

function showToast(message: string, type: 'success' | 'error' = 'success') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-white text-sm z-50 ${
    type === 'success' ? 'bg-gray-800' : 'bg-red-500'
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function getDisplayIcon() {
  return props.service.icon || '🔗';
}
</script>

<template>
  <div class="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
    <!-- Card Header -->
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-xl">
          {{ getDisplayIcon() }}
        </div>
        <div>
          <h3 class="font-semibold text-gray-800">{{ service.name }}</h3>
          <p class="text-xs text-gray-400 truncate max-w-[150px]">{{ service.url }}</p>
        </div>
      </div>
      <button
        @click="handleEdit"
        class="p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-50 rounded-lg transition-colors"
        title="编辑"
      >
        ✏️
      </button>
    </div>

    <!-- Description -->
    <p class="text-sm text-gray-500 mb-4 line-clamp-2 min-h-[2.5rem]">
      {{ service.description || '暂无描述' }}
    </p>

    <!-- Credentials indicator -->
    <div v-if="service.username || service.password" class="flex items-center gap-1 mb-3 text-xs text-gray-400">
      <span>🔐</span>
      <span>有凭据</span>
    </div>

    <!-- Actions -->
    <div class="flex gap-2">
      <button
        @click="handleOpen"
        :disabled="!service.url"
        class="flex-1 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {{ copying ? '处理中...' : '打开' }}
      </button>
    </div>
  </div>
</template>