<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue';
import { useNavStore } from '@/stores/navStore';
import { useTagStore } from '@/stores/tagStore';
import { tagsApi, type Tag } from '@/api/tags';
import { accountsApi } from '@/api/accounts';
import type { Service, ServiceAccount } from '@/types';

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
const tagStore = useTagStore();

const formData = ref({
  group_id: 0,
  name: '',
  url: '',
  description: '',
  icon: '',
  accent_color: ''
});

const selectedEmoji = ref(EMOJIS[0]);
const showPassword = ref(false);
const selectedTags = ref<string[]>([]);

// 账号管理
const serviceAccounts = ref<(ServiceAccount & { _local?: boolean })[]>([]);
const showAccountForm = ref(false);
const accountForm = ref({ name: '', username: '', password: '' });
const editingAccountId = ref<number | null>(null);
const editForm = ref({ name: '', username: '', password: '' });
const showAccountDeleteConfirm = ref(false);
const accountToDelete = ref<(ServiceAccount & { _local?: boolean }) | null>(null);
let localIdCounter = -1;

async function loadAccounts(serviceId: number) {
  try {
    const res = await accountsApi.list(serviceId);
    serviceAccounts.value = res.data || [];
  } catch {
    serviceAccounts.value = [];
  }
}

function openAddAccount() {
  accountForm.value = { name: '', username: '', password: '' };
  showAccountForm.value = true;
}

async function saveAccount() {
  if (!accountForm.value.name.trim() || !accountForm.value.username.trim()) return;

  const isFirst = serviceAccounts.value.length === 0;
  // 如果是第一个账号，自动设为默认
  if (isFirst) {
    serviceAccounts.value.forEach(a => a.is_default = false);
  }

  const newAccount: ServiceAccount & { _local?: boolean } = {
    id: localIdCounter--,
    service_id: props.service?.id || 0,
    name: accountForm.value.name.trim(),
    username: accountForm.value.username.trim(),
    password: accountForm.value.password,
    is_default: isFirst,
    sort_order: 0,
    created_at: '',
    updated_at: '',
    _local: true
  };
  serviceAccounts.value.unshift(newAccount);

  // 如果是已保存的服务，立即同步到后端
  if (props.service?.id) {
    try {
      await accountsApi.create(props.service.id, {
        name: newAccount.name,
        username: newAccount.username,
        password: newAccount.password,
        is_default: newAccount.is_default
      });
      await loadAccounts(props.service.id);
    } catch (error) {
      console.error('Failed to create account:', error);
    }
  }

  // 清空表单，继续添加
  accountForm.value = { name: '', username: '', password: '' };
  showAccountForm.value = false;
}

function startEditAccount(account: ServiceAccount & { _local?: boolean }) {
  editingAccountId.value = account.id;
  editForm.value = { name: account.name, username: account.username, password: account.password || '' };
}

async function saveEditAccount(account: ServiceAccount & { _local?: boolean }) {
  if (!editForm.value.name.trim() || !editForm.value.username.trim()) return;
  account.name = editForm.value.name.trim();
  account.username = editForm.value.username.trim();
  account.password = editForm.value.password;
  editingAccountId.value = null;
  // 已保存的账号同步后端
  if (!account._local && props.service?.id) {
    try {
      await accountsApi.update(props.service.id, account.id, {
        name: account.name,
        username: account.username,
        password: account.password,
        is_default: account.is_default
      });
      await loadAccounts(props.service.id);
    } catch (error) {
      console.error('Failed to update account:', error);
    }
  }
}

function confirmDeleteAccount(account: ServiceAccount & { _local?: boolean }) {
  accountToDelete.value = account;
  showAccountDeleteConfirm.value = true;
}

async function doDeleteAccount() {
  if (!accountToDelete.value) return;
  if (accountToDelete.value._local || !props.service?.id) {
    serviceAccounts.value = serviceAccounts.value.filter(a => a.id !== accountToDelete.value!.id);
  } else {
    try {
      await accountsApi.delete(props.service.id, accountToDelete.value.id);
      await loadAccounts(props.service.id);
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  }
  showAccountDeleteConfirm.value = false;
  accountToDelete.value = null;
}

function toggleDefault(account: ServiceAccount & { _local?: boolean }) {
  serviceAccounts.value.forEach(a => a.is_default = false);
  account.is_default = true;
  if (!account._local && props.service?.id) {
    accountsApi.setDefault(props.service.id, account.id).catch(e => console.error('Failed to set default:', e));
  }
}

// 区分单击/双击
let clickTimer: ReturnType<typeof setTimeout> | null = null;

function handleRowClick(account: ServiceAccount & { _local?: boolean }) {
  if (clickTimer) {
    clearTimeout(clickTimer);
    clickTimer = null;
    return; // 双击的第二次 click，忽略
  }
  clickTimer = setTimeout(() => {
    clickTimer = null;
    toggleDefault(account);
  }, 250);
}

function handleRowDblClick(account: ServiceAccount & { _local?: boolean }) {
  if (clickTimer) {
    clearTimeout(clickTimer);
    clickTimer = null;
  }
  startEditAccount(account);
}

// 点击外部关闭分组下拉
function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  if (groupDropdownRef.value && !groupDropdownRef.value.contains(target)) {
    // Also check if click is inside the teleported dropdown
    const teleported = document.querySelector('.group-dropdown-panel');
    if (teleported && teleported.contains(target)) return;
    showGroupDropdown.value = false;
  }
}
onUnmounted(() => document.removeEventListener('click', handleClickOutside));

// 标签相关
const showTagManager = ref(false);
const newTagName = ref('');
const newTagValue = ref('');
const newTagColor = ref('#3b6ef8');
const editingTag = ref<Tag | null>(null);
const showDeleteConfirm = ref(false);
const tagToDelete = ref<Tag | null>(null);
const tagNameError = ref('');
const tagValueError = ref('');

// 使用 computed 获取标签列表
const allTags = computed(() => tagStore.tags);

const isEditing = computed(() => !!props.service?.id);

// Group dropdown
const showGroupDropdown = ref(false);
const groupDropdownRef = ref<HTMLElement | null>(null);
const selectedGroupName = computed(() => store.groups.find(g => g.id === formData.value.group_id)?.name || '选择分组');
const selectedGroupColor = computed(() => store.groups.find(g => g.id === formData.value.group_id)?.color || '#6b7280');
const dropdownPos = ref({ top: 0, left: 0, width: 0 });

function toggleGroupDropdown() {
  if (showGroupDropdown.value) {
    showGroupDropdown.value = false;
    return;
  }
  // Calculate position from trigger button
  const ref = groupDropdownRef.value;
  if (ref) {
    const rect = ref.getBoundingClientRect();
    dropdownPos.value = {
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width
    };
  }
  showGroupDropdown.value = true;
}

// 是否显示分组选择框：编辑时显示，或没有选中分组时显示
const showGroupSelector = computed(() => {
  return isEditing.value || !props.currentGroupId;
});

function selectGroup(group: { id: number }) {
  formData.value.group_id = group.id;
  showGroupDropdown.value = false;
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    localIdCounter = -1;
    if (props.service) {
      formData.value = {
        group_id: props.service.group_id,
        name: props.service.name,
        url: props.service.url,
        description: props.service.description || '',
        icon: props.service.icon || '',
        accent_color: props.service.accent_color || ''
      };
      selectedEmoji.value = props.service.icon || EMOJIS[0];
      selectedTags.value = props.service.tags || [];
      loadAccounts(props.service.id);
    } else {
      formData.value = {
        group_id: props.currentGroupId || (store.groups[0]?.id ?? 0),
        name: '',
        url: '',
        description: '',
        icon: '',
        accent_color: ''
      };
      selectedEmoji.value = EMOJIS[0];
      selectedTags.value = [];
      serviceAccounts.value = [];
    }
    showPassword.value = false;
    showAccountForm.value = false;
    editingAccountId.value = null;
    showGroupDropdown.value = false;
    if (newVal) {
      setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
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
    await tagStore.refreshTags();
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
    await tagStore.refreshTags();
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

  // 取默认账号的用户名/密码作为服务的 username/password（兼容旧数据）
  const defaultAccount = serviceAccounts.value.find(a => a.is_default) || serviceAccounts.value[0];

  const data = {
    group_id: formData.value.group_id,
    name: formData.value.name.trim(),
    url: formData.value.url.trim(),
    username: defaultAccount?.username || null,
    password: defaultAccount?.password || null,
    description: formData.value.description.trim() || null,
    icon: selectedEmoji.value || null,
    tags: selectedTags.value,
    accent_color: formData.value.accent_color.trim() || null
  };

  try {
    if (isEditing.value && props.service?.id) {
      await store.updateService(props.service.id, data);
    } else {
      const result = await store.addService(data);
      // 新建服务后，保存本地账号
      const newServiceId = result?.id;
      if (newServiceId) {
        for (const account of serviceAccounts.value) {
          try {
            await accountsApi.create(newServiceId, {
              name: account.name,
              username: account.username,
              password: account.password,
              is_default: account.is_default
            });
          } catch (e) {
            console.error('Failed to create account:', e);
          }
        }
      }
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
      class="w-full max-w-lg rounded-2xl shadow-lg overflow-hidden flex flex-col"
      style="background: var(--surface); animation: modalIn 0.2s ease; height: 80vh; max-height: 700px"
    >
      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="flex flex-col flex-1 min-h-0">
        <!-- Scrollable content -->
        <div class="px-6 py-5 overflow-y-auto flex-1">
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
          <div class="relative" ref="groupDropdownRef">
            <button
              type="button"
              @click="toggleGroupDropdown"
              class="group-selector-trigger w-full flex items-center gap-2 px-3 py-2.5 border rounded-xl text-[13.5px] outline-none transition-all"
              :style="{
                borderColor: showGroupDropdown ? 'var(--accent)' : 'var(--border)',
                background: showGroupDropdown ? 'var(--accent-bg)' : 'var(--surface)',
                boxShadow: showGroupDropdown ? '0 0 0 2px var(--accent-bg)' : 'none'
              }"
            >
              <span
                class="w-3 h-3 rounded-full flex-shrink-0 transition-all"
                :style="{
                  background: selectedGroupColor,
                  boxShadow: showGroupDropdown ? '0 0 0 3px ' + selectedGroupColor + '30' : 'none'
                }"
              ></span>
              <span class="flex-1 text-left font-medium">{{ selectedGroupName }}</span>
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                class="transition-transform duration-200 flex-shrink-0"
                :style="{ transform: showGroupDropdown ? 'rotate(180deg)' : 'rotate(0deg)', color: showGroupDropdown ? 'var(--accent)' : 'var(--text3)' }"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <!-- Fixed-position dropdown to escape overflow clipping -->
            <Teleport to="body">
              <div
                v-if="showGroupDropdown"
                class="group-dropdown-panel fixed z-[9999] border rounded-xl shadow-xl overflow-hidden"
                :style="{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  top: dropdownPos.top + 'px',
                  left: dropdownPos.left + 'px',
                  width: dropdownPos.width + 'px'
                }"
              >
                <div class="py-1.5 max-h-56 overflow-y-auto group-dropdown-scroll">
                  <button
                    v-for="group in store.groups"
                    :key="group.id"
                    type="button"
                    @click="selectGroup(group)"
                    class="group-dropdown-item w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] transition-all duration-100"
                    :class="{ 'is-active': formData.group_id === group.id }"
                  >
                    <span
                      class="w-3.5 h-3.5 rounded-full flex-shrink-0 transition-all duration-150"
                      :style="{
                        background: group.color,
                        boxShadow: formData.group_id === group.id ? '0 0 0 3px ' + group.color + '30' : 'none',
                        transform: formData.group_id === group.id ? 'scale(1.1)' : 'scale(1)'
                      }"
                    ></span>
                    <span class="flex-1 text-left font-medium">{{ group.name }}</span>
                    <svg
                      v-if="formData.group_id === group.id"
                      width="14" height="14" viewBox="0 0 24 24"
                      :style="{ color: group.color }"
                      fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                      class="check-icon"
                    >
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                </div>
              </div>
            </Teleport>
          </div>
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
            style="border-color: var(--border); color: var(--text); background: var(--surface)"
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
            style="border-color: var(--border); color: var(--text); background: var(--surface)"
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
            style="border-color: var(--border); color: var(--text); background: var(--surface)"
            placeholder="https://example.com/login"
            required
          />
        </div>

        <!-- Account Management -->
        <div class="mb-4">
          <div class="flex items-center justify-between mb-2">
            <label class="block text-xs font-semibold" style="color: var(--text2)">账号管理</label>
            <button
              v-if="!showAccountForm"
              type="button"
              @click="openAddAccount"
              class="text-xs px-2 py-0.5 rounded border transition-colors"
              style="border-color: var(--border); color: var(--text3)"
            >
              + 添加账号
            </button>
          </div>

          <div class="space-y-1.5">
            <!-- Inline add row -->
            <div
              v-if="showAccountForm"
              class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border"
              style="border-color: var(--accent); background: var(--accent-bg)"
            >
              <input
                v-model="accountForm.name"
                type="text"
                class="flex-1 min-w-0 px-2 py-1.5 border rounded-md text-[12.5px] outline-none"
                style="border-color: var(--border); color: var(--text); background: var(--surface)"
                placeholder="名称"
                @keydown.enter="saveAccount"
                ref="addAccountNameRef"
              />
              <input
                v-model="accountForm.username"
                type="text"
                class="flex-1 min-w-0 px-2 py-1.5 border rounded-md text-[12.5px] outline-none"
                style="border-color: var(--border); color: var(--text); background: var(--surface)"
                placeholder="用户名"
                @keydown.enter="saveAccount"
              />
              <input
                v-model="accountForm.password"
                type="text"
                class="flex-1 min-w-0 px-2 py-1.5 border rounded-md text-[12.5px] outline-none"
                style="border-color: var(--border); color: var(--text); background: var(--surface)"
                placeholder="密码"
                autocomplete="off"
                @keydown.enter="saveAccount"
              />
              <button
                type="button"
                @click="saveAccount"
                class="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
                style="background: var(--accent); color: white"
                title="保存"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
              <button
                type="button"
                @click="showAccountForm = false"
                class="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center border"
                style="border-color: var(--border); color: var(--text3)"
                title="取消"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <!-- Empty state -->
            <div v-if="serviceAccounts.length === 0 && !showAccountForm" class="text-xs py-3 text-center rounded-lg border" style="color: var(--text3); border-color: var(--border); background: var(--surface2)">
              暂无账号，点击上方「添加账号」新建
            </div>

            <!-- Account rows -->
            <div
              v-for="account in serviceAccounts"
              :key="account.id"
            >
              <!-- Edit mode -->
              <div
                v-if="editingAccountId === account.id"
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border"
                style="border-color: var(--accent); background: var(--accent-bg)"
              >
                <input
                  v-model="editForm.name"
                  type="text"
                  class="flex-1 min-w-0 px-2 py-1.5 border rounded-md text-[12.5px] outline-none"
                  style="border-color: var(--border); color: var(--text); background: var(--surface)"
                  placeholder="名称"
                  @keydown.enter="saveEditAccount(account)"
                  @keydown.escape="editingAccountId = null"
                />
                <input
                  v-model="editForm.username"
                  type="text"
                  class="flex-1 min-w-0 px-2 py-1.5 border rounded-md text-[12.5px] outline-none"
                  style="border-color: var(--border); color: var(--text); background: var(--surface)"
                  placeholder="用户名"
                  @keydown.enter="saveEditAccount(account)"
                  @keydown.escape="editingAccountId = null"
                />
                <input
                  v-model="editForm.password"
                  type="text"
                  class="flex-1 min-w-0 px-2 py-1.5 border rounded-md text-[12.5px] outline-none"
                  style="border-color: var(--border); color: var(--text); background: var(--surface)"
                  placeholder="密码"
                  autocomplete="off"
                  @keydown.enter="saveEditAccount(account)"
                  @keydown.escape="editingAccountId = null"
                />
                <button
                  type="button"
                  @click="saveEditAccount(account)"
                  class="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
                  style="background: var(--accent); color: white"
                  title="保存"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
                <button
                  type="button"
                  @click="editingAccountId = null"
                  class="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center border"
                  style="border-color: var(--border); color: var(--text3)"
                  title="取消"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <!-- Display mode -->
              <div
                v-else
                class="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all cursor-pointer"
                :style="{
                  borderColor: account.is_default ? 'var(--accent)' : 'var(--border)',
                  background: account.is_default ? 'var(--accent-bg)' : 'var(--surface2)'
                }"
                @click="handleRowClick(account)"
                @dblclick.stop="handleRowDblClick(account)"
              >
                <span
                  class="flex-shrink-0"
                  :title="account.is_default ? '默认账号' : '设为默认'"
                >
                  <svg v-if="account.is_default" width="14" height="14" viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                  </svg>
                </span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-[13px] font-medium" style="color: var(--text)">{{ account.name }}</span>
                    <span class="text-[11px] font-mono" style="color: var(--text3)">{{ account.username }}</span>
                  </div>
                </div>
                <button
                  type="button"
                  @click.stop="confirmDeleteAccount(account)"
                  class="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors"
                  style="color: var(--text3)"
                  title="删除"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>

        <!-- Buttons - fixed at bottom -->
        <div class="px-6 py-3.5 border-t flex justify-end gap-2" style="border-color: var(--border)">
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

    <!-- Account Delete Confirm Modal -->
    <div
      v-if="showAccountDeleteConfirm"
      class="fixed inset-0 flex items-center justify-center z-[70] p-4"
      style="background: rgba(0,0,0,.5)"
      @click.self="showAccountDeleteConfirm = false"
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
          <div class="text-[15px] font-semibold mb-1" style="color: var(--text)">删除账号</div>
          <div class="text-[13px]" style="color: var(--text3)">确定删除账号「{{ accountToDelete?.name }}」吗？此操作不可撤销。</div>
        </div>
        <div class="px-5 py-3 border-t flex justify-center gap-3" style="border-color: var(--border)">
          <button
            @click="showAccountDeleteConfirm = false"
            class="flex-1 py-2 rounded-lg text-[13px] font-medium border transition-colors"
            style="border-color: var(--border); color: var(--text2)"
          >
            取消
          </button>
          <button
            @click="doDeleteAccount"
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

/* Group Selector Trigger */
.group-selector-trigger:hover {
  border-color: var(--border2) !important;
}

/* Group Dropdown Panel */
.group-dropdown-panel {
  animation: dropdownIn 0.18s ease;
}

@keyframes dropdownIn {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Dropdown scroll styling */
.group-dropdown-scroll::-webkit-scrollbar {
  width: 4px;
}

.group-dropdown-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.group-dropdown-scroll::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}

.group-dropdown-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--text3);
}

/* Dropdown item */
.group-dropdown-item {
  position: relative;
  color: var(--text);
}

.group-dropdown-item:hover {
  background: var(--surface2);
}

.group-dropdown-item:active {
  background: var(--surface);
}

.group-dropdown-item.is-active {
  color: var(--text);
  font-weight: 600;
}

.group-dropdown-item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  border-radius: 0 3px 3px 0;
  background: var(--accent);
}

/* Check icon animation */
.check-icon {
  animation: checkPop 0.2s ease;
}

@keyframes checkPop {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

/* Vue Transition */
.dropdown-enter-active {
  transition: all 0.18s ease;
}

.dropdown-leave-active {
  transition: all 0.12s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>