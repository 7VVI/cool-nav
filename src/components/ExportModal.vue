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

    const markdownContent = await res.text();
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExportFilename();
    a.click();
    URL.revokeObjectURL(url);
    emit('close');
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
    <div class="bg-white rounded-xl w-[400px]">
      <div class="p-4 border-b border-border-main flex items-center justify-between">
        <h3 class="font-semibold">导出 Markdown</h3>
        <button @click="emit('close')" class="text-text-sub hover:text-text-main">✕</button>
      </div>

      <div class="p-4">
        <div class="flex gap-2 mb-3">
          <button @click="selectAll" class="text-xs text-primary hover:underline">全选</button>
          <button @click="clearAll" class="text-xs text-text-sub hover:underline">清空</button>
        </div>

        <div class="space-y-2 max-h-[300px] overflow-y-auto">
          <label
            v-for="group in store.groups"
            :key="group.id"
            class="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              :checked="selectedGroups.includes(group.id)"
              @change="toggleGroup(group.id)"
              class="w-4 h-4 text-primary rounded border-border-main focus:ring-primary"
            />
            <span class="text-sm">{{ group.name }}</span>
            <span class="text-xs text-text-sub">({{ group.serviceCount || 0 }})</span>
          </label>
        </div>

        <div class="flex gap-2 mt-4">
          <button
            @click="emit('close')"
            class="flex-1 px-4 py-2 bg-gray-100 text-text-main rounded-md text-sm hover:bg-gray-200"
          >
            取消
          </button>
          <button
            @click="handleExport"
            class="flex-1 px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-blue-600"
          >
            导出
          </button>
        </div>
      </div>
    </div>
  </div>
</template>