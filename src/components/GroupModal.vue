<script setup lang="ts">
import { ref, watch } from 'vue';
import { useNavStore } from '@/stores/navStore';
import type { Group } from '@/types';

const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b6ef8','#8b5cf6','#ec4899','#64748b','#10b981'];

// 图标定义（实心填充）
const GROUP_ICONS: { name: string; path: string }[] = [
  { name: 'folder',   path: 'M2 6a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11a2 2 0 01-2 2H4a2 2 0 01-2-2V6z' },
  { name: 'server',   path: 'M4 2h16a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm0 8h16a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2zm0 8h16a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2a2 2 0 012-2z' },
  { name: 'database', path: 'M12 2C6.5 2 2 4.5 2 7v10c0 2.5 4.5 5 10 5s10-2.5 10-5V7c0-2.5-4.5-5-10-5z' },
  { name: 'cloud',    path: 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z' },
  { name: 'shield',   path: 'M12 2l8 4v6c0 5.5-3.8 10.7-8 12-4.2-1.3-8-6.5-8-12V6l8-4z' },
  { name: 'terminal', path: 'M2 5l7 7-7 7 2 2 9-9-9-9-2 2zm10 14h8v-3h-8v3z' },
  { name: 'globe',    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z' },
  { name: 'lock',     path: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z' },
  { name: 'box',      path: 'M12 2L2 7v10l10 5 10-5V7L12 2z' },
  { name: 'rocket',   path: 'M12 2l3 8h4l-3 4 2 7-6-4-6 4 2-7-3-4h4z' },
  { name: 'code',     path: 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z' },
  { name: 'layers',   path: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5z' },
];

const props = defineProps<{
  show: boolean;
  group?: Group | null;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const store = useNavStore();
const groupName = ref('');
const selectedColor = ref(COLORS[5]);
const selectedIcon = ref('folder');
const saving = ref(false);
const errorMessage = ref('');

watch(() => props.show, (newVal) => {
  if (newVal) {
    groupName.value = props.group?.name || '';
    selectedColor.value = props.group?.color || COLORS[5];
    selectedIcon.value = props.group?.icon || GROUP_ICONS[Math.floor(Math.random() * GROUP_ICONS.length)].name;
    errorMessage.value = '';
  }
});

async function handleSubmit() {
  if (!groupName.value.trim()) return;

  saving.value = true;
  errorMessage.value = '';
  try {
    if (props.group) {
      await store.updateGroup(props.group.id, { name: groupName.value.trim(), color: selectedColor.value, icon: selectedIcon.value });
    } else {
      await store.addGroup({ name: groupName.value.trim(), color: selectedColor.value, icon: selectedIcon.value });
    }
    emit('saved');
    emit('close');
  } catch (error: any) {
    const msg = error?.response?.data?.message || error?.message || '保存失败';
    errorMessage.value = msg;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 flex items-center justify-center z-50 p-4"
    style="background: rgba(0,0,0,.4); backdrop-filter: blur(6px)"
    @click.self="emit('close')"
  >
    <div
      class="w-full max-w-sm rounded-2xl shadow-lg overflow-hidden"
      style="background: var(--surface); animation: modalIn 0.2s ease"
    >
      <!-- Header -->
      <div class="px-6 py-5 border-b flex items-center justify-between" style="border-color: var(--border)">
        <div class="text-[15px] font-bold" style="color: var(--text)">
          {{ group ? '编辑分组' : '新建分组' }}
        </div>
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

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="px-6 py-4">
        <div class="mb-4">
          <label class="block text-xs font-semibold mb-1.5" style="color: var(--text2)">
            分组名称 <span style="color: var(--red)">*</span>
          </label>
          <input
            v-model="groupName"
            type="text"
            class="w-full px-2.5 py-2 border rounded-lg text-[13.5px] outline-none transition-all"
            :class="{ 'border-red-400': errorMessage }"
            style="border-color: var(--border); color: var(--text); background: var(--surface)"
            placeholder="例：生产环境"
            :disabled="saving"
          />
          <p v-if="errorMessage" class="mt-1 text-xs" style="color: var(--red)">{{ errorMessage }}</p>
        </div>

        <div class="mb-4">
          <label class="block text-xs font-semibold mb-2" style="color: var(--text2)">
            图标
          </label>
          <div class="flex gap-1.5 flex-wrap">
            <button
              v-for="ico in GROUP_ICONS"
              :key="ico.name"
              type="button"
              @click="selectedIcon = ico.name"
              class="icon-option"
              :class="{ selected: selectedIcon === ico.name }"
              :style="{
                borderColor: selectedIcon === ico.name ? selectedColor : 'var(--border)',
                color: selectedIcon === ico.name ? selectedColor : 'var(--text3)',
                background: selectedIcon === ico.name ? selectedColor + '10' : 'var(--surface2)'
              }"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path :d="ico.path"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-xs font-semibold mb-2.5" style="color: var(--text2)">
            分组颜色
          </label>
          <div class="flex gap-3 flex-wrap">
            <button
              v-for="color in COLORS"
              :key="color"
              type="button"
              @click="selectedColor = color"
              class="color-option"
              :class="{ selected: selectedColor === color }"
              :style="{ background: color }"
            ></button>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <button
            type="button"
            @click="emit('close')"
            class="px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors"
            style="border-color: var(--border); color: var(--text2)"
            :disabled="saving"
          >
            取消
          </button>
          <button
            type="submit"
            class="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
            style="background: var(--accent); color: white"
            :disabled="!groupName.trim() || saving"
          >
            {{ saving ? '保存中...' : (group ? '保存' : '创建') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.icon-option {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  border: 2px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.icon-option:hover {
  transform: scale(1.1);
}

.icon-option.selected {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.color-option {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  border: 3px solid transparent;
  transition: all 0.15s ease;
  position: relative;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.selected {
  border-color: var(--text);
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
</style>