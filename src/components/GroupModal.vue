<script setup lang="ts">
import { ref, watch } from 'vue';
import { useNavStore } from '@/stores/navStore';
import type { Group } from '@/types';

const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b6ef8','#8b5cf6','#ec4899','#64748b','#10b981'];

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
const saving = ref(false);
const errorMessage = ref('');

watch(() => props.show, (newVal) => {
  if (newVal) {
    groupName.value = props.group?.name || '';
    selectedColor.value = props.group?.color || COLORS[5];
    errorMessage.value = '';
  }
});

async function handleSubmit() {
  if (!groupName.value.trim()) return;

  saving.value = true;
  errorMessage.value = '';
  try {
    if (props.group) {
      await store.updateGroup(props.group.id, { name: groupName.value.trim(), color: selectedColor.value });
    } else {
      await store.addGroup({ name: groupName.value.trim(), color: selectedColor.value });
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