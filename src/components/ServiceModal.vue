<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { useNavStore } from '@/stores/navStore';
import { tagsApi, type Tag } from '@/api/tags';
import type { Service } from '@/types';

const EMOJIS = [
  '🖥️','🔧','📊','📦','🔒','🌐','💼','📁','🚀','⚙️',
  '🔗','📋','🗄️','📡','💡','🔑','🏢','📈','🛠️','🎯',
  '🔮','⚡','🧩','🌿','🚜','📄','📶','💧','💰','💵',
  '🗺','📍','🗂','👁','📝','📰','📣','🏭','🧪','💻',
  '🟢','🟡','🔐'
];

// Emoji 推荐映射表
const EMOJI_RECOMMEND_MAP: Record<string, string> = {
  'crm': '📊', '农机': '🚜', '文档': '📄', 'erp': '🏢',
  'mqtt': '📶', '物联网': '📡', '水文': '💧', '成本': '💰',
  '应收': '💵', '售后': '🔧', '平台': '🌐', '后台': '⚙️',
  'admin': '🔐', 'api': '🔗', '日志': '🗂', '监控': '👁',
  '地图': '🗺', 'gps': '📍', '定位': '🎯', '博客': '📝',
  '文章': '📰', '媒体': '📣', 'fms': '📦', '仓库': '🏭',
  '测试': '🧪', '开发': '💻', '生产': '🟢', '预生产': '🟡',
};

function recommendEmoji(name: string): string {
  const lowerName = name.toLowerCase();
  for (const [keyword, emoji] of Object.entries(EMOJI_RECOMMEND_MAP)) {
    if (lowerName.includes(keyword.toLowerCase())) {
      return emoji;
    }
  }
  return '🖥️';
}

const props = defineProps<{
  show: boolean;
  service?: Service | null;
  currentGroupId?: number | null;
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
  icon: '',
  accent_color: ''
});

const selectedEmoji = ref(EMOJIS[0]);
const showPassword = ref(false);
const selectedTags = ref<string[]>([]);

// 标签相关
const allTags = ref<Tag[]>([]);
const showTagManager = ref(false);
const newTagName = ref('');
const newTagValue = ref('');
const newTagColor = ref('#3b6ef8');
const editingTag = ref<Tag | null>(null);
const showDeleteConfirm = ref(false);
const tagToDelete = ref<Tag | null>(null);
const tagNameError = ref('');
const tagValueError = ref('');

const isEditing = computed(() => !!props.service?.id);
const modalTitle = computed(() => isEditing.value ? '编辑服务' : '添加服务');

// 是否显示分组选择框：编辑时显示，或没有选中分组时显示
const showGroupSelector = computed(() => {
  return isEditing.value || !props.currentGroupId;
});

// 加载标签
async function loadTags() {
  try {
    const res = await tagsApi.getAll();
    allTags.value = res.data || [];
  } catch (error) {
    console.error('Failed to load tags:', error);
  }
}

// 根据标签值获取标签信息
function getTagByValue(value: string): Tag | undefined {
  return allTags.value.find(t => t.value === value);
}

onMounted(() => {
  loadTags();
});

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
        icon: props.service.icon || '',
        accent_color: props.service.accent_color || ''
      };
      selectedEmoji.value = props.service.icon || EMOJIS[0];
      selectedTags.value = props.service.tags || [];
    } else {
      // 新增服务时，如果有当前分组则使用当前分组
      formData.value = {
        group_id: props.currentGroupId || (store.groups[0]?.id ?? 0),
        name: '',
        url: '',
        username: '',
        password: '',
        description: '',
        icon: '',
        accent_color: ''
      };
      selectedEmoji.value = EMOJIS[0];
      selectedTags.value = [];
    }
    showPassword.value = false;
  }
});

// 监听名称变化，自动推荐 emoji
watch(() => formData.value.name, (newName) => {
  if (newName && !isEditing.value) {
    // 新增服务时，根据名称自动推荐
    const recommended = recommendEmoji(newName);
    if (!selectedEmoji.value || selectedEmoji.value === EMOJIS[0]) {
      selectedEmoji.value = recommended;
    }
  }
});

function toggleTag(tagValue: string) {
  const index = selectedTags.value.indexOf(tagValue);
  if (index > -1) {
    selectedTags.value.splice(index, 1);
  } else {
    selectedTags.value.push(tagValue);
  }
}

// 打开新增标签弹窗
function openAddTag() {
  newTagName.value = '';
  newTagValue.value = '';
  newTagColor.value = '#3b6ef8';
  editingTag.value = null;
  tagNameError.value = '';
  tagValueError.value = '';
  showTagManager.value = true;
}

// 打开编辑标签弹窗
function openEditTag(tag: Tag) {
  newTagName.value = tag.name;
  newTagValue.value = tag.value;
  newTagColor.value = tag.color;
  editingTag.value = tag;
  tagNameError.value = '';
  tagValueError.value = '';
  showTagManager.value = true;
}

// 保存标签（新增或编辑）
async function saveTag() {
  // 清除之前的错误
  tagNameError.value = '';
  tagValueError.value = '';

  let hasError = false;

  // 验证标签名称
  if (!newTagName.value.trim()) {
    tagNameError.value = '请输入标签名称';
    hasError = true;
  }

  // 验证标签值
  if (!newTagValue.value.trim()) {
    tagValueError.value = '请输入标签值';
    hasError = true;
  } else {
    // 验证标签值格式（只允许英文、数字、下划线、连字符）
    const valuePattern = /^[a-zA-Z0-9_-]+$/;
    if (!valuePattern.test(newTagValue.value.trim())) {
      tagValueError.value = '只能包含英文、数字、下划线和连字符';
      hasError = true;
    }
  }

  if (hasError) return;

  try {
    if (editingTag.value) {
      await tagsApi.update(editingTag.value.id, {
        name: newTagName.value.trim(),
        value: newTagValue.value.trim(),
        color: newTagColor.value
      });
    } else {
      await tagsApi.create({
        name: newTagName.value.trim(),
        value: newTagValue.value.trim(),
        color: newTagColor.value
      });
    }
    await loadTags();
    showTagManager.value = false;
  } catch (error) {
    console.error('Failed to save tag:', error);
  }
}

// 删除标签
function confirmDeleteTag(tag: Tag) {
  tagToDelete.value = tag;
  showDeleteConfirm.value = true;
}

// 执行删除标签
async function doDeleteTag() {
  if (!tagToDelete.value) return;

  try {
    await tagsApi.delete(tagToDelete.value.id);
    await loadTags();
    // 从已选标签中移除
    selectedTags.value = selectedTags.value.filter(t => t !== tagToDelete.value!.value);
    showDeleteConfirm.value = false;
    tagToDelete.value = null;
  } catch (error) {
    console.error('Failed to delete tag:', error);
  }
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
    icon: selectedEmoji.value || null,
    tags: selectedTags.value,
    accent_color: formData.value.accent_color.trim() || null
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
    class="fixed inset-0 flex items-center justify-center z-50 p-4"
    style="background: rgba(0,0,0,.4); backdrop-filter: blur(6px)"
  >
    <div
      class="w-full max-w-lg rounded-2xl shadow-lg overflow-hidden max-h-[90vh] overflow-y-auto"
      style="background: var(--surface); animation: modalIn 0.2s ease"
    >
      <!-- Header -->
      <div class="px-6 py-5 border-b flex items-center justify-between" style="border-color: var(--border)">
        <div class="text-[15px] font-bold" style="color: var(--text)">{{ modalTitle }}</div>
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
        <!-- Icon Picker -->
        <div class="mb-4">
          <label class="block text-xs font-semibold mb-2" style="color: var(--text2)">图标</label>
          <div class="flex gap-1 flex-wrap">
            <button
              v-for="emoji in EMOJIS"
              :key="emoji"
              type="button"
              @click="selectedEmoji = emoji"
              class="w-8.5 h-8.5 rounded-lg border flex items-center justify-center text-[17px] transition-all"
              :style="{
                borderColor: selectedEmoji === emoji ? 'var(--accent)' : 'var(--border)',
                background: selectedEmoji === emoji ? 'var(--accent-bg)' : 'var(--surface2)'
              }"
            >
              {{ emoji }}
            </button>
          </div>
        </div>

        <!-- Tags -->
        <div class="mb-4">
          <div class="flex items-center justify-between mb-2">
            <label class="block text-xs font-semibold" style="color: var(--text2)">标签</label>
            <button
              type="button"
              @click="openAddTag"
              class="text-xs px-2 py-0.5 rounded border transition-colors"
              style="border-color: var(--border); color: var(--text3)"
            >
              + 新增标签
            </button>
          </div>
          <div class="flex gap-2 flex-wrap">
            <div
              v-for="tag in allTags"
              :key="tag.id"
              class="tag-btn-wrapper"
            >
              <button
                type="button"
                @click="toggleTag(tag.value)"
                @dblclick.stop="openEditTag(tag)"
                class="tag-btn"
                :class="{ active: selectedTags.includes(tag.value) }"
                :style="{
                  borderColor: selectedTags.includes(tag.value) ? tag.color : 'var(--border)',
                  background: selectedTags.includes(tag.value) ? tag.color + '15' : 'var(--surface2)',
                  color: selectedTags.includes(tag.value) ? tag.color : 'var(--text2)'
                }"
                title="单击选择/取消，双击编辑"
              >
                <span class="w-2 h-2 rounded-full" :style="{ background: tag.color }"></span>
                {{ tag.name }}
              </button>
              <button
                type="button"
                @click.stop="confirmDeleteTag(tag)"
                class="tag-delete-btn"
                title="删除标签"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 主题色编辑 -->
        <div class="mb-4">
          <label class="block text-xs font-semibold mb-1.5" style="color: var(--text2)">主题色</label>
          <div class="flex items-center gap-2">
            <input
              v-model="formData.accent_color"
              type="color"
              class="w-10 h-8 rounded border cursor-pointer"
              style="border-color: var(--border)"
            />
            <input
              v-model="formData.accent_color"
              type="text"
              class="flex-1 px-2.5 py-2 border rounded-lg text-[13px] outline-none font-mono"
              style="border-color: var(--border); color: var(--text); background: var(--surface)"
              placeholder="#3b6ef8"
            />
            <button
              type="button"
              @click="formData.accent_color = ''"
              class="px-2 py-1.5 rounded text-[11px] border"
              style="border-color: var(--border); color: var(--text3)"
            >
              自动
            </button>
          </div>
          <p class="text-[11px] mt-1" style="color: var(--text3)">留空则自动生成独特颜色</p>
        </div>

        <!-- Group Selector -->
        <div v-if="showGroupSelector" class="mb-4">
          <label class="block text-xs font-semibold mb-1.5" style="color: var(--text2)">
            所属分组 <span style="color: var(--red)">*</span>
          </label>
          <select
            v-model="formData.group_id"
            class="w-full px-2.5 py-2 border rounded-lg text-[13.5px] outline-none transition-all"
            style="border-color: var(--border); color: var(--text); background: var(--surface)"
            required
          >
            <option v-for="group in store.groups" :key="group.id" :value="group.id">
              {{ group.name }}
            </option>
          </select>
        </div>

        <!-- Service Name -->
        <div class="mb-4">
          <label class="block text-xs font-semibold mb-1.5" style="color: var(--text2)">
            服务名称 <span style="color: var(--red)">*</span>
          </label>
          <input
            v-model="formData.name"
            type="text"
            class="w-full px-2.5 py-2 border rounded-lg text-[13.5px] outline-none transition-all"
            style="border-color: var(--border); color: var(--text)"
            placeholder="例：OA 系统"
            required
          />
        </div>

        <!-- Description -->
        <div class="mb-4">
          <label class="block text-xs font-semibold mb-1.5" style="color: var(--text2)">简介</label>
          <input
            v-model="formData.description"
            type="text"
            class="w-full px-2.5 py-2 border rounded-lg text-[13.5px] outline-none transition-all"
            style="border-color: var(--border); color: var(--text)"
            placeholder="一句话描述（选填）"
          />
        </div>

        <!-- URL -->
        <div class="mb-4">
          <label class="block text-xs font-semibold mb-1.5" style="color: var(--text2)">
            登录地址 <span style="color: var(--red)">*</span>
          </label>
          <input
            v-model="formData.url"
            type="url"
            class="w-full px-2.5 py-2 border rounded-lg text-[13.5px] outline-none transition-all"
            style="border-color: var(--border); color: var(--text)"
            placeholder="https://example.com/login"
            required
          />
        </div>

        <!-- Username & Password -->
        <div class="flex gap-3 mb-4">
          <div class="flex-1">
            <label class="block text-xs font-semibold mb-1.5" style="color: var(--text2)">用户名</label>
            <input
              v-model="formData.username"
              type="text"
              class="w-full px-2.5 py-2 border rounded-lg text-[13.5px] outline-none transition-all"
              style="border-color: var(--border); color: var(--text)"
              placeholder="username"
              autocomplete="off"
            />
          </div>
          <div class="flex-1">
            <label class="block text-xs font-semibold mb-1.5" style="color: var(--text2)">密码</label>
            <div class="relative">
              <input
                v-model="formData.password"
                :type="showPassword ? 'text' : 'password'"
                class="w-full px-2.5 py-2 pr-9 border rounded-lg text-[13.5px] outline-none transition-all"
                style="border-color: var(--border); color: var(--text)"
                placeholder="••••••••"
                autocomplete="new-password"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-2.5 top-1/2 -translate-y-1/2"
                style="color: var(--text3)"
              >
                <svg v-if="showPassword" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Buttons -->
        <div class="flex justify-end gap-2 pt-1">
          <button
            type="button"
            @click="emit('close')"
            class="px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors"
            style="border-color: var(--border); color: var(--text2)"
          >
            取消
          </button>
          <button
            type="submit"
            class="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
            style="background: var(--accent); color: white"
          >
            {{ isEditing ? '保存' : '添加' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Tag Manager Modal -->
    <div
      v-if="showTagManager"
      class="fixed inset-0 flex items-center justify-center z-[60] p-4"
      style="background: rgba(0,0,0,.5)"
    >
      <div
        class="w-full max-w-md rounded-2xl shadow-lg overflow-hidden"
        style="background: var(--surface); animation: modalIn 0.2s ease"
      >
        <!-- Header -->
        <div class="px-5 py-4 border-b flex items-center justify-between" style="border-color: var(--border)">
          <div class="text-[14px] font-bold" style="color: var(--text)">{{ editingTag ? '编辑标签' : '新增标签' }}</div>
          <button
            @click="showTagManager = false"
            class="w-6 h-6 rounded flex items-center justify-center"
            style="color: var(--text3)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Form -->
        <div class="px-5 py-4 space-y-3">
          <div>
            <label class="block text-xs font-medium mb-1" style="color: var(--text2)">标签名称</label>
            <input
              v-model="newTagName"
              type="text"
              class="w-full px-2.5 py-2 border rounded-lg text-[13px] outline-none"
              :style="{
                borderColor: tagNameError ? 'var(--red)' : 'var(--border)',
                color: 'var(--text)',
                background: 'var(--surface)'
              }"
              placeholder="如：生产、测试"
              @input="tagNameError = ''"
            />
            <div v-if="tagNameError" class="text-[11px] mt-1" style="color: var(--red)">{{ tagNameError }}</div>
          </div>
          <div>
            <label class="block text-xs font-medium mb-1" style="color: var(--text2)">标签值（英文）</label>
            <input
              v-model="newTagValue"
              type="text"
              class="w-full px-2.5 py-2 border rounded-lg text-[13px] outline-none"
              :style="{
                borderColor: tagValueError ? 'var(--red)' : 'var(--border)',
                color: 'var(--text)',
                background: 'var(--surface)'
              }"
              placeholder="如：production、testing"
              @input="tagValueError = ''"
            />
            <div v-if="tagValueError" class="text-[11px] mt-1" style="color: var(--red)">{{ tagValueError }}</div>
          </div>
          <div>
            <label class="block text-xs font-medium mb-1" style="color: var(--text2)">颜色</label>
            <div class="flex items-center gap-2">
              <input
                v-model="newTagColor"
                type="color"
                class="w-10 h-8 rounded border cursor-pointer"
                style="border-color: var(--border)"
              />
              <input
                v-model="newTagColor"
                type="text"
                class="flex-1 px-2.5 py-2 border rounded-lg text-[13px] outline-none font-mono"
                style="border-color: var(--border); color: var(--text); background: var(--surface)"
                placeholder="#3b6ef8"
              />
            </div>
          </div>

          <!-- Existing Tags List -->
          <div v-if="allTags.length > 0" class="pt-2 border-t" style="border-color: var(--border)">
            <label class="block text-xs font-medium mb-2" style="color: var(--text3)">现有标签（点击编辑）</label>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="tag in allTags"
                :key="tag.id"
                class="existing-tag-item"
                @click="openEditTag(tag)"
              >
                <span class="w-2.5 h-2.5 rounded-full" :style="{ background: tag.color }"></span>
                <span>{{ tag.name }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="px-5 py-3 border-t flex justify-end gap-2" style="border-color: var(--border)">
          <button
            @click="showTagManager = false"
            class="px-3 py-1.5 rounded-lg text-[13px] border"
            style="border-color: var(--border); color: var(--text2)"
          >
            取消
          </button>
          <button
            @click="saveTag"
            class="px-3 py-1.5 rounded-lg text-[13px]"
            style="background: var(--accent); color: white"
          >
            保存
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div
      v-if="showDeleteConfirm"
      class="fixed inset-0 flex items-center justify-center z-[70] p-4"
      style="background: rgba(0,0,0,.5)"
      @click.self="showDeleteConfirm = false"
    >
      <div
        class="w-full max-w-sm rounded-2xl shadow-lg overflow-hidden"
        style="background: var(--surface); animation: modalIn 0.2s ease"
      >
        <div class="px-5 py-6 text-center">
          <div class="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style="background: #fef2f2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div class="text-[15px] font-semibold mb-1" style="color: var(--text)">删除标签</div>
          <div class="text-[13px]" style="color: var(--text3)">确定删除标签「{{ tagToDelete?.name }}」吗？此操作不可撤销。</div>
        </div>
        <div class="px-5 py-3 border-t flex justify-center gap-3" style="border-color: var(--border)">
          <button
            @click="showDeleteConfirm = false"
            class="flex-1 py-2 rounded-lg text-[13px] font-medium border transition-colors"
            style="border-color: var(--border); color: var(--text2)"
          >
            取消
          </button>
          <button
            @click="doDeleteTag"
            class="flex-1 py-2 rounded-lg text-[13px] font-medium transition-colors"
            style="background: #ef4444; color: white"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tag-btn-wrapper {
  position: relative;
}

.tag-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid;
  transition: all 0.15s ease;
  cursor: pointer;
  padding-right: 20px;
}

.tag-btn:hover {
  opacity: 0.85;
}

.tag-delete-btn {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.15s ease;
  cursor: pointer;
  background: #ef4444;
  color: white;
  border: none;
}

.tag-btn-wrapper:hover .tag-delete-btn {
  opacity: 1;
}

.tag-delete-btn:hover {
  background: #dc2626;
  transform: scale(1.1);
}

.existing-tag-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  background: var(--surface2);
  color: var(--text2);
  transition: all 0.15s ease;
}

.existing-tag-item:hover {
  background: var(--surface);
  box-shadow: 0 0 0 1px var(--border);
}
</style>