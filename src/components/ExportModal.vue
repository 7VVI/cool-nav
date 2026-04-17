<script setup lang="ts">
import { ref } from 'vue';
import { useNavStore } from '@/stores/navStore';
import { useAuthStore } from '@/stores/authStore';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const store = useNavStore();
const authStore = useAuthStore();
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
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
    class="fixed inset-0 flex items-center justify-center z-50"
    style="background: rgba(0,0,0,.36); backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px)"
    @click.self="emit('close')"
  >
    <div
      class="w-[400px] rounded-3xl shadow-lg overflow-hidden"
      style="background: var(--surface); animation: modalIn 0.2s ease"
    >
      <!-- Header -->
      <div class="px-6 py-5 border-b flex items-center justify-between" style="border-color: var(--border)">
        <h3 class="text-[15px] font-bold" style="color: var(--text)">导出 Markdown</h3>
        <button
          @click="emit('close')"
          class="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
          style="color: var(--text3)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="px-6 py-4">
        <!-- Select actions -->
        <div class="flex gap-4 mb-4">
          <button
            @click="selectAll"
            class="text-xs font-medium transition-colors"
            style="color: var(--accent)"
          >
            全选
          </button>
          <button
            @click="clearAll"
            class="text-xs font-medium transition-colors"
            style="color: var(--text3)"
          >
            清空
          </button>
        </div>

        <!-- Group list -->
        <div class="space-y-1 max-h-[300px] overflow-y-auto">
          <label
            v-for="group in store.groups"
            :key="group.id"
            class="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
            style="color: var(--text2)"
            onmouseenter="this.style.background='var(--surface2)'"
            onmouseleave="this.style.background='transparent'"
          >
            <input
              type="checkbox"
              :checked="selectedGroups.includes(group.id)"
              @change="toggleGroup(group.id)"
              class="w-4 h-4 rounded border"
              style="accent-color: var(--accent)"
            />
            <span
              class="w-1.5 h-1.5 rounded-full flex-shrink-0"
              :style="{ background: group.color || '#3b6ef8' }"
            ></span>
            <span class="flex-1 text-[13px]">{{ group.name }}</span>
            <span
              class="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style="background: var(--surface2); color: var(--text3)"
            >
              {{ group.serviceCount || 0 }}
            </span>
          </label>
        </div>

        <!-- Empty state -->
        <div v-if="store.groups.length === 0" class="text-center py-8 text-[13px]" style="color: var(--text3)">
          暂无可导出的分组
        </div>

        <!-- Buttons -->
        <div class="flex gap-2 mt-6">
          <button
            @click="emit('close')"
            class="flex-1 px-4 py-2.5 rounded-lg text-[13px] font-medium border transition-colors"
            style="border-color: var(--border); color: var(--text2)"
          >
            取消
          </button>
          <button
            @click="handleExport"
            class="flex-1 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors"
            style="background: var(--accent); color: white"
          >
            导出
          </button>
        </div>
      </div>
    </div>
  </div>
</template>