<script setup lang="ts">
import { ref } from 'vue';
import { useNavStore } from '@/stores/navStore';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const store = useNavStore();
const selectedGroups = ref<number[]>([]);

function toggleGroup(id: number) {
  const index = selectedGroups.value.indexOf(id);
  if (index > -1) {
    selectedGroups.value.splice(index, 1);
  } else {
    selectedGroups.value.push(id);
  }
}

function selectAll() {
  selectedGroups.value = store.groups.map(g => g.id);
}

function clearAll() {
  selectedGroups.value = [];
}

function getExportFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `internal-nav-${year}-${month}-${day}.md`;
}

async function handleExport() {
  if (selectedGroups.value.length === 0) {
    alert('请选择要导出的分组');
    return;
  }

  try {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupIds: selectedGroups.value })
    });

    if (!res.ok) {
      throw new Error('Export failed');
    }

    const data = await res.json();

    if (data.success) {
      const blob = new Blob([data.data.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.data.filename || getExportFilename();
      a.click();
      URL.revokeObjectURL(url);
      emit('close');
    }
  } catch (e) {
    console.error('Export failed:', e);
    alert('导出失败');
  }
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-xl shadow-xl w-[400px]">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-800">导出 Markdown</h3>
        <button @click="emit('close')" class="text-gray-400 hover:text-gray-600">✕</button>
      </div>

      <!-- Content -->
      <div class="px-6 py-4">
        <!-- Select actions -->
        <div class="flex gap-4 mb-4">
          <button @click="selectAll" class="text-sm text-blue-500 hover:text-blue-600">
            全选
          </button>
          <button @click="clearAll" class="text-sm text-gray-500 hover:text-gray-600">
            清空
          </button>
        </div>

        <!-- Group list -->
        <div class="space-y-2 max-h-[300px] overflow-y-auto">
          <label
            v-for="group in store.groups"
            :key="group.id"
            class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              :checked="selectedGroups.includes(group.id)"
              @change="toggleGroup(group.id)"
              class="w-4 h-4 text-blue-500 rounded border-gray-300 focus:ring-blue-500"
            />
            <span class="flex-1 text-sm text-gray-700">{{ group.name }}</span>
            <span class="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
              {{ group.serviceCount || 0 }}
            </span>
          </label>
        </div>

        <!-- Empty state -->
        <div v-if="store.groups.length === 0" class="text-center py-8 text-gray-400 text-sm">
          暂无可导出的分组
        </div>

        <!-- Buttons -->
        <div class="flex gap-3 mt-6">
          <button
            @click="emit('close')"
            class="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            @click="handleExport"
            class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
          >
            导出
          </button>
        </div>
      </div>
    </div>
  </div>
</template>