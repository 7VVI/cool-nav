<script setup lang="ts">
import { ref, watch } from 'vue';
import { useNavStore } from '@/stores/navStore';
import type { Group } from '@/types';

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
const saving = ref(false);

watch(() => props.show, (newVal) => {
  if (newVal) {
    groupName.value = props.group?.name || '';
  }
});

async function handleSubmit() {
  if (!groupName.value.trim()) return;

  saving.value = true;
  try {
    if (props.group) {
      await store.updateGroup(props.group.id, { name: groupName.value.trim() });
    } else {
      await store.addGroup({ name: groupName.value.trim() });
    }
    emit('saved');
    emit('close');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
      <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-800">
          {{ group ? '编辑分组' : '新建分组' }}
        </h3>
        <button @click="emit('close')" class="text-gray-400 hover:text-gray-600">✕</button>
      </div>

      <form @submit.prevent="handleSubmit" class="px-6 py-4">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            分组名称 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="groupName"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="如：运维系统"
            :disabled="saving"
          />
        </div>

        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            @click="emit('close')"
            :disabled="saving"
          >
            取消
          </button>
          <button
            type="submit"
            class="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!groupName.trim() || saving"
          >
            {{ saving ? '保存中...' : (group ? '保存' : '创建') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>