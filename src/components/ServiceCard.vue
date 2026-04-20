<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Service, ServiceAccount } from '@/types';
import { useNavStore } from '@/stores/navStore';
import { useTagStore } from '@/stores/tagStore';
import { accountsApi } from '@/api/accounts';

const props = defineProps<{
  service: Service;
  selectable?: boolean;
  selected?: boolean;
}>();

const emit = defineEmits<{
  edit: [service: Service];
  delete: [service: Service];
  toggleSelect: [service: Service];
}>();

const store = useNavStore();
const tagStore = useTagStore();
const showLoginModal = ref(false);
const showDeleteConfirm = ref(false);
const showPassword = ref(false);
const showAccountList = ref(false);
const accounts = ref<ServiceAccount[]>([]);
const loadingAccounts = ref(false);

// 账号颜色池
const ACCOUNT_COLORS = [
  '#4ade80', '#f472b6', '#fbbf24', '#38bdf8',
  '#a78bfa', '#fb923c', '#34d399', '#f87171',
  '#22d3ee', '#6366f1', '#ec4899', '#14b8a6'
];

function getAccountColor(id: number) {
  return ACCOUNT_COLORS[id % ACCOUNT_COLORS.length];
}

async function loadAccounts() {
  if (!props.service.id) return;
  loadingAccounts.value = true;
  try {
    const res = await accountsApi.list(props.service.id);
    accounts.value = res.data || [];
  } catch {
    accounts.value = [];
  } finally {
    loadingAccounts.value = false;
  }
}

const hasAccounts = computed(() => accounts.value.length > 0);

const hasCredentials = computed(() => {
  if (props.service.username || props.service.password) return true;
  return hasAccounts.value;
});

// 优先取默认账号的凭据，否则用服务本身的
const defaultAccount = computed(() => accounts.value.find(a => a.is_default) || accounts.value[0]);
const displayUsername = computed(() => defaultAccount.value?.username || props.service.username);
const displayPassword = computed(() => defaultAccount.value?.password || props.service.password);

// 颜色池
const ACCENT_COLORS = [
  '#4ade80', '#f472b6', '#fbbf24', '#38bdf8',
  '#a78bfa', '#fb923c', '#34d399', '#f87171',
  '#22d3ee', '#6366f1', '#ec4899', '#14b8a6'
];

// 根据ID生成颜色
function generateColorFromId(id: number) {
  return ACCENT_COLORS[id % ACCENT_COLORS.length];
}

// 获取卡片主色
const accentColor = computed(() => {
  return props.service.accent_color || generateColorFromId(props.service.id);
});

// 计算渐变色条
const accentGradient = computed(() => {
  const color = accentColor.value;
  // 转换为更深色用于渐变终点
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const darkerColor = `#${Math.max(0, r - 40).toString(16).padStart(2, '0')}${Math.max(0, g - 40).toString(16).padStart(2, '0')}${Math.max(0, b - 40).toString(16).padStart(2, '0')}`;
  return `linear-gradient(90deg, ${color}, ${darkerColor})`;
});

// Get service tags with full info
const serviceTags = computed(() => {
  const tags = props.service.tags || [];
  return tags.map(tagValue => {
    const tag = tagStore.getTagByValue(tagValue);
    return tag || { value: tagValue, name: tagValue, color: '#6b7280' };
  });
});

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getDisplayIcon() {
  return props.service.icon || '🖥️';
}

function trimUrl(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 32);
  }
}

function openLoginModal() {
  showLoginModal.value = true;
  showPassword.value = false;
  showAccountList.value = false;
  loadAccounts();
}

function openUrl() {
  if (props.service.url) {
    window.open(props.service.url, '_blank');
    showLoginModal.value = false;
  }
}

async function copyToClipboard(text: string, label: string) {
  try {
    // 优先使用现代 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showToast(`${label}已复制到剪贴板`, 'success');
      return;
    }
    // Fallback: 使用 execCommand 方法（兼容 HTTP 环境）
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) {
      showToast(`${label}已复制到剪贴板`, 'success');
    } else {
      showToast('复制失败', 'error');
    }
  } catch {
    showToast('复制失败', 'error');
  }
}

async function copyCredentials() {
  if (props.service.username && props.service.password) {
    const credentials = `${props.service.username}\n${props.service.password}`;
    await copyToClipboard(credentials, '凭据');
  }
}

function showToast(message: string, type: 'success' | 'error' = 'success') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-5 right-5 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg flex items-center gap-2 z-50 ${
    type === 'success' ? 'text-green-600 border' : 'text-red-500 border'
  }`;
  toast.style.background = type === 'success' ? 'var(--green-bg)' : 'var(--red-bg)';
  toast.style.borderColor = type === 'success' ? '#bbf7d0' : '#fecaca';
  toast.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span>${message}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

function handleCardClick() {
  if (props.selectable) {
    emit('toggleSelect', props.service);
    return;
  }
  openLoginModal();
}
</script>

<template>
  <div>
    <!-- Card -->
    <div
      class="service-card"
      :class="{ 'card-selected': selected }"
      :style="{
        background: 'var(--surface)',
        borderColor: selected ? 'var(--accent)' : 'var(--border)',
        animation: 'cardIn 0.25s ease both'
      }"
      @click="handleCardClick"
    >
      <!-- 渐变色条 -->
      <div
        class="accent-bar"
        :style="{ background: accentGradient }"
      ></div>

      <!-- Card Body -->
      <div class="card-body">
        <!-- Header: Icon + Name + URL + Online -->
        <div class="card-header">
          <div
            class="service-icon"
            :style="{ background: hexToRgba(accentColor, 0.1) }"
          >
            {{ getDisplayIcon() }}
          </div>
          <div class="card-meta">
            <div class="service-name">{{ service.name }}</div>
            <div class="service-url">{{ trimUrl(service.url) }}</div>
          </div>
          <!-- 在线状态 -->
          <div v-if="service.is_online" class="status-online">
            <span class="pulse-dot"></span>
            <span>在线</span>
          </div>
        </div>

        <!-- Description -->
        <p class="service-desc">{{ service.description || '暂无描述' }}</p>

        <!-- Tags -->
        <div class="card-tags" :class="{ 'empty': serviceTags.length === 0 }">
          <span
            v-for="tag in serviceTags"
            :key="tag.value"
            class="badge"
            :style="{
              background: tag.color + '12',
              color: tag.color,
              borderColor: tag.color + '25'
            }"
          >
            {{ tag.name }}
          </span>
        </div>

        <!-- Auth Indicator -->
        <div class="auth-indicator">
          <span class="auth-dot" :class="hasCredentials ? 'auth-yes' : 'auth-no'"></span>
          <span :class="hasCredentials ? 'auth-text-yes' : 'auth-text-no'">{{ hasCredentials ? '有凭据' : '无凭据' }}</span>
        </div>
      </div>

      <!-- Card Footer -->
      <div class="card-footer">
        <!-- Selection Checkbox -->
        <button
          v-if="selectable"
          @click.stop="emit('toggleSelect', service)"
          class="select-btn"
          :class="{ selected: selected }"
        >
          <svg v-if="selected" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
        <button
          @click.stop="openLoginModal"
          class="open-btn"
          :style="{
            '--btn-color': accentColor,
            background: hexToRgba(accentColor, 0.15),
            color: accentColor
          }"
        >
          <span class="open-arrow">↗</span> 打开
        </button>
        <button
          @click.stop="emit('edit', service)"
          class="action-btn"
          title="编辑"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button
          @click.stop="showDeleteConfirm = true"
          class="action-btn del-btn"
          title="删除"
        >
          🗑
        </button>
      </div>
    </div>

    <!-- Login Modal -->
    <div
      v-if="showLoginModal"
      class="fixed inset-0 flex items-center justify-center z-50 p-4"
      style="background: rgba(0,0,0,.36); backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px)"
      @click.self="showLoginModal = false"
    >
      <div
        class="w-full max-w-md rounded-3xl shadow-lg overflow-hidden"
        style="background: var(--surface); animation: modalIn 0.2s ease"
      >
        <!-- Header -->
        <div class="px-6 py-5 border-b flex items-center justify-between" style="border-color: var(--border)">
          <div class="flex items-center gap-2">
            <span class="text-xl">{{ getDisplayIcon() }}</span>
            <span class="text-[15px] font-bold" style="color: var(--text)">{{ service.name }}</span>
          </div>
          <button
            @click="showLoginModal = false"
            class="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
            style="color: var(--text3)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="px-6 py-4">
          <p class="text-[13px] mb-3" style="color: var(--text2)">将在新标签页打开登录页，账号信息如下：</p>

          <div class="border rounded-xl p-3" style="background: var(--surface2); border-color: var(--border)">
            <!-- URL -->
            <div class="flex items-center gap-2 py-1.5 text-[13px]">
              <span class="w-12 flex-shrink-0 text-xs" style="color: var(--text3)">地址</span>
              <span class="flex-1 font-mono text-[12.5px] truncate" style="color: var(--accent)">{{ service.url }}</span>
              <button
                @click="copyToClipboard(service.url, '地址')"
                class="px-2 py-0.5 rounded text-[11px] border transition-colors"
                style="border-color: var(--border); color: var(--text2)"
              >
                复制
              </button>
            </div>

            <!-- Username -->
            <div v-if="displayUsername" class="flex items-center gap-2 py-1.5 text-[13px] border-t" style="border-color: var(--border)">
              <span class="w-12 flex-shrink-0 text-xs" style="color: var(--text3)">用户名</span>
              <span class="flex-1 font-mono text-[12.5px] truncate" style="color: var(--text)">{{ displayUsername }}</span>
              <button
                @click="copyToClipboard(displayUsername!, '用户名')"
                class="px-2 py-0.5 rounded text-[11px] border transition-colors"
                style="border-color: var(--border); color: var(--text2)"
              >
                复制
              </button>
            </div>

            <!-- Password -->
            <div v-if="displayPassword" class="flex items-center gap-2 py-1.5 text-[13px] border-t" style="border-color: var(--border)">
              <span class="w-12 flex-shrink-0 text-xs" style="color: var(--text3)">密码</span>
              <span class="flex-1 min-w-0 font-mono text-[12.5px] select-all break-all">{{ showPassword ? displayPassword : '••••••••' }}</span>
              <button
                @click="showPassword = !showPassword"
                class="flex-shrink-0 p-1 rounded transition-colors"
                style="color: var(--text3)"
                :title="showPassword ? '隐藏' : '显示'"
              >
                <svg v-if="showPassword" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              <button
                @click="copyToClipboard(displayPassword!, '密码')"
                class="px-2 py-0.5 rounded text-[11px] border transition-colors"
                style="border-color: var(--border); color: var(--text2)"
              >
                复制
              </button>
            </div>

            <!-- No credentials -->
            <div v-if="!displayUsername && !displayPassword" class="py-1.5 text-xs" style="color: var(--text3)">
              未录入凭据
            </div>
          </div>

          <!-- Account List -->
          <div v-if="showAccountList && hasAccounts" class="mt-3">
            <div class="text-xs font-semibold mb-2" style="color: var(--text2)">全部账号</div>
            <div class="space-y-1.5">
              <div
                v-for="account in accounts"
                :key="account.id"
                class="account-item"
                :style="{ background: 'var(--surface2)', borderColor: account.is_default ? getAccountColor(account.id) + '40' : 'var(--border)' }"
              >
                <div
                  class="account-avatar"
                  :style="{ background: getAccountColor(account.id) + '20', color: getAccountColor(account.id) }"
                >
                  {{ account.name.charAt(0) }}
                </div>
                <div class="account-info">
                  <div class="flex items-center gap-1.5">
                    <span class="account-name" :style="{ fontWeight: account.is_default ? 600 : 500 }">{{ account.name }}</span>
                  </div>
                  <span v-if="account.username" class="account-username">{{ account.username }}</span>
                  <span v-else-if="account.password" class="account-username">仅密码/密钥</span>
                </div>
                <div class="account-actions">
                  <button
                    v-if="account.username"
                    @click="copyToClipboard(account.username, '账号')"
                    class="account-copy-btn"
                    title="复制账号"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </button>
                  <button
                    v-if="account.password"
                    @click="copyToClipboard(account.password, '密码')"
                    class="account-copy-btn"
                    title="复制密码"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="showAccountList && !hasAccounts && !loadingAccounts" class="mt-3 text-xs text-center py-3" style="color: var(--text3)">
            暂无账号记录
          </div>

          <p class="text-xs mt-3" style="color: var(--text3)">💡 点击「复制」后，在登录页对应输入框粘贴即可</p>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3.5 border-t flex justify-end gap-2" style="border-color: var(--border)">
          <button
            @click="showLoginModal = false"
            class="px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors"
            style="border-color: var(--border); color: var(--text2)"
          >
            关闭
          </button>
          <button
            @click="showAccountList = !showAccountList"
            class="px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors flex items-center gap-1.5"
            :style="{
              borderColor: showAccountList ? 'var(--accent)' : 'var(--border)',
              color: showAccountList ? 'var(--accent)' : 'var(--text2)',
              background: showAccountList ? 'var(--accent-bg)' : 'transparent'
            }"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            账号
            <span v-if="accounts.length > 0" class="account-count-badge">{{ accounts.length }}</span>
          </button>
          <button
            @click="openUrl"
            class="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
            style="background: var(--accent); color: white"
          >
            打开登录页
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div
      v-if="showDeleteConfirm"
      class="fixed inset-0 flex items-center justify-center z-50 p-4"
      style="background: rgba(0,0,0,.36); backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px)"
      @click.self="showDeleteConfirm = false"
    >
      <div
        class="w-full max-w-sm rounded-3xl shadow-lg overflow-hidden"
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
          <div class="text-[15px] font-semibold mb-1" style="color: var(--text)">删除服务</div>
          <div class="text-[13px]" style="color: var(--text3)">确定删除「{{ service.name }}」吗？此操作不可撤销。</div>
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
            @click="showDeleteConfirm = false; emit('delete', service)"
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
.service-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.28s cubic-bezier(0.25, 0.1, 0.25, 1), border-color 0.28s ease;
  position: relative;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-card);
}

.service-card:hover {
  box-shadow: var(--shadow-card-hover);
  border-color: var(--border2);
}

.service-card:hover .accent-bar {
  opacity: 1;
}

.card-selected {
  box-shadow: 0 0 0 2px var(--accent);
}

/* 渐变色条 - 默认隐藏，悬停显示 */
.accent-bar {
  height: 3px;
  width: 100%;
  flex-shrink: 0;
  opacity: 0.7;
  transition: opacity 0.28s ease, height 0.28s ease;
}

/* Card Body */
.card-body {
  padding: 18px 18px 14px;
  flex: 1;
}

/* Header */
.card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.service-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  flex-shrink: 0;
}

.card-meta {
  flex: 1;
  min-width: 0;
}

.service-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 3px;
  letter-spacing: -0.2px;
}

.service-url {
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  font-size: 11px;
  color: var(--text3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 在线状态 */
.status-online {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--green);
  flex-shrink: 0;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(52,199,89,0.4); }
  50% { opacity: 0.8; box-shadow: 0 0 0 4px rgba(52,199,89,0); }
}

/* Description */
.service-desc {
  font-size: 13px;
  color: var(--text2);
  line-height: 1.5;
  margin-bottom: 12px;
  min-height: 39px;
  max-height: 39px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Tags */
.card-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  min-height: 22px;
}

.card-tags.empty {
  visibility: hidden;
}

.badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 6px;
  font-weight: 500;
  letter-spacing: 0.01em;
  border: 1px solid;
}

/* Auth Indicator */
.auth-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
}

.auth-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.auth-yes { background: var(--green); }
.auth-no { background: var(--text3); }
.auth-text-yes { color: var(--green); }
.auth-text-no { color: var(--text3); }

/* Card Footer */
.card-footer {
  padding: 0 18px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.open-btn {
  flex: 1;
  padding: 9px 0;
  border-radius: 10px;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.22s cubic-bezier(0.25, 0.1, 0.25, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  position: relative;
}

.open-btn:hover {
  background: var(--btn-color);
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.open-btn:hover .open-arrow {
  transform: translateX(3px) translateY(-2px);
}

.open-arrow {
  display: inline-block;
  transition: transform 0.22s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.select-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 2px solid var(--border);
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.select-btn.selected {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.action-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

.del-btn:hover {
  border-color: var(--red);
  color: var(--red);
  background: var(--red-bg);
}

/* Account List */
.account-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid;
  transition: all 0.2s ease;
}

.account-item:hover {
  border-color: var(--accent);
}

.account-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.account-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.account-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
}

.account-username {
  font-size: 11px;
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  color: var(--text3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.account-copy-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.account-copy-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

.account-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: var(--accent);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 0 4px;
}
</style>