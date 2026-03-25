<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useNavStore } from '@/stores/navStore';
import type { Service } from '@/types';

const props = defineProps<{
  show: boolean;
  service?: Service | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const navStore = useNavStore();

const formData = ref({
  group_id: 0,
  name: '',
  url: '',
  username: '',
  password: '',
  description: '',
  icon: ''
});

const isEditing = computed(() => !!props.service?.id);
const modalTitle = computed(() => isEditing.value ? 'Edit Service' : 'Add Service');

const groups = computed(() => navStore.groups);

watch(() => props.show, (newVal) => {
  if (newVal) {
    if (props.service) {
      formData.value = {
        group_id: props.service.group_id,
        name: props.service.name,
        url: props.service.url,
        username: props.service.username || '',
        password: props.service.password || '',
        description: props.service.description || '',
        icon: props.service.icon || ''
      };
    } else {
      formData.value = {
        group_id: navStore.currentGroupId || (groups.value[0]?.id ?? 0),
        name: '',
        url: '',
        username: '',
        password: '',
        description: '',
        icon: ''
      };
    }
  }
});

function closeModal() {
  emit('close');
}

async function handleSubmit() {
  if (!formData.value.name.trim() || !formData.value.url.trim()) {
    return;
  }

  const data = {
    group_id: formData.value.group_id,
    name: formData.value.name.trim(),
    url: formData.value.url.trim(),
    username: formData.value.username.trim() || null,
    password: formData.value.password.trim() || null,
    description: formData.value.description.trim() || null,
    icon: formData.value.icon.trim() || null
  };

  try {
    if (isEditing.value && props.service?.id) {
      await navStore.updateService(props.service.id, data);
    } else {
      await navStore.addService(data);
    }
    emit('saved');
    closeModal();
  } catch (error) {
    console.error('Failed to save service:', error);
  }
}

function handleOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    closeModal();
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click="handleOverlayClick"
      >
        <div class="w-full max-w-md rounded-lg bg-white shadow-xl">
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-border-main px-6 py-4">
            <h2 class="text-lg font-semibold text-text-main">{{ modalTitle }}</h2>
            <button
              type="button"
              class="text-text-sub hover:text-text-main transition-colors"
              @click="closeModal"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Form -->
          <form @submit.prevent="handleSubmit" class="px-6 py-4 space-y-4">
            <!-- Group Selector -->
            <div>
              <label for="group" class="block text-sm font-medium text-text-main mb-1">
                Group <span class="text-red-500">*</span>
              </label>
              <select
                id="group"
                v-model="formData.group_id"
                class="w-full px-3 py-2 border border-border-main rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-text-main bg-white"
                required
              >
                <option v-for="group in groups" :key="group.id" :value="group.id">
                  {{ group.name }}
                </option>
              </select>
            </div>

            <!-- Service Name -->
            <div>
              <label for="name" class="block text-sm font-medium text-text-main mb-1">
                Service Name <span class="text-red-500">*</span>
              </label>
              <input
                id="name"
                v-model="formData.name"
                type="text"
                class="w-full px-3 py-2 border border-border-main rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-text-main"
                placeholder="Enter service name"
                required
              />
            </div>

            <!-- URL -->
            <div>
              <label for="url" class="block text-sm font-medium text-text-main mb-1">
                URL <span class="text-red-500">*</span>
              </label>
              <input
                id="url"
                v-model="formData.url"
                type="url"
                class="w-full px-3 py-2 border border-border-main rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-text-main"
                placeholder="https://example.com"
                required
              />
            </div>

            <!-- Username -->
            <div>
              <label for="username" class="block text-sm font-medium text-text-main mb-1">
                Username
              </label>
              <input
                id="username"
                v-model="formData.username"
                type="text"
                class="w-full px-3 py-2 border border-border-main rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-text-main"
                placeholder="Enter username (optional)"
              />
            </div>

            <!-- Password -->
            <div>
              <label for="password" class="block text-sm font-medium text-text-main mb-1">
                Password
              </label>
              <input
                id="password"
                v-model="formData.password"
                type="password"
                class="w-full px-3 py-2 border border-border-main rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-text-main"
                placeholder="Enter password (optional)"
              />
            </div>

            <!-- Description -->
            <div>
              <label for="description" class="block text-sm font-medium text-text-main mb-1">
                Description
              </label>
              <textarea
                id="description"
                v-model="formData.description"
                rows="2"
                class="w-full px-3 py-2 border border-border-main rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-text-main resize-none"
                placeholder="Enter description (optional)"
              />
            </div>

            <!-- Icon (Emoji) -->
            <div>
              <label for="icon" class="block text-sm font-medium text-text-main mb-1">
                Icon
              </label>
              <input
                id="icon"
                v-model="formData.icon"
                type="text"
                class="w-full px-3 py-2 border border-border-main rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-text-main"
                placeholder="Enter emoji icon (optional)"
              />
            </div>

            <!-- Buttons -->
            <div class="flex justify-end gap-3 pt-2">
              <button
                type="button"
                class="px-4 py-2 text-sm font-medium text-text-sub hover:text-text-main transition-colors"
                @click="closeModal"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-blue-600 transition-colors"
              >
                {{ isEditing ? 'Update' : 'Create' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>