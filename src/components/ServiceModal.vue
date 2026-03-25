<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useNavStore } from '@/stores/navStore';
import type { Service } from '@/types';

const props = defineProps<{
  show: boolean;
  service?: Service | null;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const store = useNavStore();

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
const modalTitle = computed(() => isEditing.value ? '编辑服务' : '添加服务');

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
        group_id: store.currentGroupId || (store.groups[0]?.id ?? 0),
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
      await store.updateService(props.service.id, data);
    } else {
      await store.addService(data);
    }
    emit('saved');
    emit('close');
  } catch (error) {
    console.error('Failed to save service:', error);
  }
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-md bg-white rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-800">{{ modalTitle }}</h2>
        <button @click="emit('close')" class="text-gray-400 hover:text-gray-600">✕</button>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="px-6 py-4 space-y-4">
        <!-- Group Selector -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            所属分组 <span class="text-red-500">*</span>
          </label>
          <select
            v-model="formData.group_id"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
            required
          >
            <option v-for="group in store.groups" :key="group.id" :value="group.id">
              {{ group.name }}
            </option>
          </select>
        </div>

        <!-- Service Name -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            服务名称 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="formData.name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="如：Jenkins"
            required
          />
        </div>

        <!-- URL -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            URL <span class="text-red-500">*</span>
          </label>
          <input
            v-model="formData.url"
            type="url"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://example.com"
            required
          />
        </div>

        <!-- Username -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            用户名（可选）
          </label>
          <input
            v-model="formData.username"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="登录用户名"
          />
        </div>

        <!-- Password -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            密码（可选）
          </label>
          <input
            v-model="formData.password"
            type="password"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="登录密码"
          />
        </div>

        <!-- Description -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            描述（可选）
          </label>
          <input
            v-model="formData.description"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="简短描述"
          />
        </div>

        <!-- Icon -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            图标（可选）
          </label>
          <input
            v-model="formData.icon"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="emoji 如：🔧"
          />
        </div>

        <!-- Buttons -->
        <div class="flex justify-end gap-3 pt-2">
          <button
            type="button"
            class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            @click="emit('close')"
          >
            取消
          </button>
          <button
            type="submit"
            class="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            {{ isEditing ? '保存' : '添加' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>