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

const navStore = useNavStore();
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
      await navStore.updateGroup(props.group.id, { name: groupName.value.trim() });
    } else {
      await navStore.addGroup({ name: groupName.value.trim() });
    }
    emit('saved');
    emit('close');
  } finally {
    saving.value = false;
  }
}

function handleClose() {
  emit('close');
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="handleClose"
  >
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
      <div class="px-6 py-4 border-b border-border-main">
        <h3 class="text-lg font-medium text-text-main">
          {{ group ? 'Edit Group' : 'Add Group' }}
        </h3>
      </div>

      <form @submit.prevent="handleSubmit" class="px-6 py-4">
        <div class="mb-4">
          <label for="groupName" class="block text-sm font-medium text-text-main mb-1">
            Group Name <span class="text-red-500">*</span>
          </label>
          <input
            id="groupName"
            v-model="groupName"
            type="text"
            class="w-full px-3 py-2 border border-border-main rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Enter group name"
            :disabled="saving"
          />
        </div>

        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="px-4 py-2 text-sm text-text-sub hover:text-text-main transition-colors"
            @click="handleClose"
            :disabled="saving"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!groupName.trim() || saving"
          >
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>