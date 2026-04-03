<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Service } from '@/types';
import { useTagStore } from '@/stores/tagStore';

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

const tagStore = useTagStore();
const showLoginModal = ref(false);
const showPassword = ref(false);

const hasCredentials = computed(() => {
  return props.service.username || props.service.password;
});

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

// 获取行主色
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
  return `linear-gradient(180deg, ${color}, ${darkerColor})`;
});

// Get service tags with full info
const serviceTags = computed(() => {
  const tags = props.service.tags || [];
  return tags.map(tagValue => {
    const tag = tagStore.getTagByValue(tagValue);
    return tag || { value: tagValue, name: tagValue, color: '#6b7280' };
  });
});

function trimUrl(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 40);
  }
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function openLoginModal() {
  showLoginModal.value = true;
  showPassword.value = false;
}

function openUrl() {
  if (props.service.url) {
    window.open(props.service.url, '_blank');
    showLoginModal.value = false;
  }
}

async function copyToClipboard(text: string, label: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showToast(`${label}已复制到剪贴板`, 'success');
      return;
    }
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

function handleRowClick() {
  if (props.selectable) {
    emit('toggleSelect', props.service);
  } else {
    openLoginModal();
  }
}
</script>

<template>
  <div>
    <!-- List Row -->
    <div
      class="list-row"
      :class="{ 'row-selected': selected }"
      @click="handleRowClick"
    >
      <!-- 左侧渐变色条 -->
      <div class="accent-bar" :style="{ background: accentGradient }"></div>

      <!-- 选择框 -->
      <div v-if="selectable" class="select-checkbox">
        <button
          @click.stop="emit('toggleSelect', service)"
          class="checkbox-btn"
          :class="{ checked: selected }"
        >
          <svg v-if="selected" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
      </div>

      <!-- 图标 -->
      <div
        class="list-icon"
        :style="{ background: hexToRgba(accentColor, 0.1) }"
      >
        {{ service.icon || '🖥️' }}
      </div>

      <!-- 名称 -->
      <div class="list-name">{{ service.name }}</div>

      <!-- 描述（固定宽度，空时占位） -->
      <div class="list-desc">
        <span v-if="service.description">{{ service.description }}</span>
        <span v-else class="placeholder-text">-</span>
      </div>

      <!-- 标签（居中，固定宽度） -->
      <div class="list-tags-center">
        <span
          v-for="tag in serviceTags.slice(0, 2)"
          :key="tag.value"
          class="list-tag"
          :style="{ background: tag.color + '15', color: tag.color, borderColor: tag.color + '30' }"
        >
          {{ tag.name }}
        </span>
        <span v-if="serviceTags.length === 0" class="list-tag-placeholder">-</span>
      </div>

      <!-- URL -->
      <div class="list-url font-mono">{{ trimUrl(service.url) }}</div>

      <!-- 凭据状态 -->
      <div class="list-auth" :class="hasCredentials ? 'has-cred' : 'no-cred'">
        <span class="auth-dot" :class="hasCredentials ? 'auth-yes' : 'auth-no'">
          <span v-if="hasCredentials" class="pulse-ring"></span>
        </span>
        <span class="auth-text">{{ hasCredentials ? '有凭据' : '无凭据' }}</span>
      </div>

      <!-- 在线状态（固定宽度占位） -->
      <div class="list-online">
        <span v-if="service.is_online" class="pulse-dot"></span>
      </div>

      <!-- 操作按钮 -->
      <div class="list-actions">
        <button
          @click.stop="openLoginModal"
          class="list-open-btn"
          :style="{ background: hexToRgba(accentColor, 0.15), color: accentColor }"
        >
          打开
        </button>
        <button
          @click.stop="emit('edit', service)"
          class="list-edit-btn"
          title="编辑"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button
          @click.stop="emit('delete', service)"
          class="list-delete-btn"
          title="删除"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Login Modal -->
    <div
      v-if="showLoginModal"
      class="fixed inset-0 flex items-center justify-center z-50 p-4"
      style="background: rgba(0,0,0,.4); backdrop-filter: blur(6px)"
      @click.self="showLoginModal = false"
    >
      <div
        class="w-full max-w-md rounded-2xl shadow-lg overflow-hidden"
        style="background: var(--surface); animation: modalIn 0.2s ease"
      >
        <!-- Header -->
        <div class="px-6 py-5 border-b flex items-center justify-between" style="border-color: var(--border)">
          <div class="flex items-center gap-2">
            <span class="text-xl">{{ service.icon || '🖥️' }}</span>
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
            <div v-if="service.username" class="flex items-center gap-2 py-1.5 text-[13px] border-t" style="border-color: var(--border)">
              <span class="w-12 flex-shrink-0 text-xs" style="color: var(--text3)">用户名</span>
              <span class="flex-1 font-mono text-[12.5px] truncate" style="color: var(--text)">{{ service.username }}</span>
              <button
                @click="copyToClipboard(service.username!, '用户名')"
                class="px-2 py-0.5 rounded text-[11px] border transition-colors"
                style="border-color: var(--border); color: var(--text2)"
              >
                复制
              </button>
            </div>

            <!-- Password -->
            <div v-if="service.password" class="flex items-center gap-2 py-1.5 text-[13px] border-t" style="border-color: var(--border)">
              <span class="w-12 flex-shrink-0 text-xs" style="color: var(--text3)">密码</span>
              <span class="flex-1 font-mono text-[12.5px] select-all">{{ showPassword ? service.password : '••••••••' }}</span>
              <button
                @click="showPassword = !showPassword"
                class="p-1 rounded transition-colors"
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
                @click="copyToClipboard(service.password!, '密码')"
                class="px-2 py-0.5 rounded text-[11px] border transition-colors"
                style="border-color: var(--border); color: var(--text2)"
              >
                复制
              </button>
            </div>

            <!-- No credentials -->
            <div v-if="!service.username && !service.password" class="py-1.5 text-xs" style="color: var(--text3)">
              未录入凭据
            </div>
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
            @click="openUrl"
            class="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
            style="background: var(--accent); color: white"
          >
            打开登录页
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.list-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px 10px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.list-row:hover {
  border-color: var(--border2);
  background: var(--surface2);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.row-selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-bg);
}

/* 左侧渐变色条 - 和卡片一样的切条效果 */
.accent-bar {
  width: 4px;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 12px 0 0 12px;
  flex-shrink: 0;
}

.select-checkbox {
  flex-shrink: 0;
}

.checkbox-btn {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid var(--border2);
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}

.checkbox-btn.checked {
  background: var(--accent);
  border-color: var(--accent);
}

.list-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
  border: 1px solid var(--border);
}

.list-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  width: 130px;
  min-width: 130px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 描述列 - 固定宽度 */
.list-desc {
  font-size: 12px;
  color: var(--text3);
  width: 150px;
  min-width: 150px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.placeholder-text {
  color: var(--text3);
  opacity: 0.5;
}

/* 标签居中显示 - 固定宽度 */
.list-tags-center {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  flex-shrink: 0;
  width: 110px;
  min-width: 110px;
}

.list-tag-placeholder {
  font-size: 11px;
  color: var(--text3);
  opacity: 0.5;
}

.list-url {
  font-size: 11px;
  color: var(--text3);
  flex: 1;
  min-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid;
  font-weight: 500;
}

/* 凭据状态 - 增强样式 */
.list-auth {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 500;
  flex-shrink: 0;
  width: 85px;
  min-width: 85px;
}

.list-auth.has-cred {
  color: var(--green);
}

.list-auth.no-cred {
  color: var(--text3);
}

.auth-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  position: relative;
  flex-shrink: 0;
}

.auth-dot.auth-yes {
  background: var(--green);
}

.auth-dot.auth-no {
  background: var(--text3);
}

/* 绿色光晕脉冲效果 */
.pulse-ring {
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0; transform: scale(1.8); }
}

.auth-text {
  font-weight: 500;
}

.list-online {
  flex-shrink: 0;
  width: 24px;
  min-width: 24px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(74,222,128,0.4); }
  50% { opacity: 0.8; box-shadow: 0 0 0 4px rgba(74,222,128,0); }
}

.list-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.list-open-btn {
  padding: 5px 12px;
  border-radius: 6px;
  border: none;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.list-open-btn:hover {
  opacity: 0.85;
}

.list-edit-btn,
.list-delete-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}

/* 编辑按钮悬停变蓝 */
.list-edit-btn:hover {
  background: rgba(59, 110, 248, 0.1);
  border-color: var(--accent);
  color: var(--accent);
}

/* 删除按钮悬停变红 */
.list-delete-btn:hover {
  background: var(--red-bg);
  color: var(--red);
  border-color: var(--red-border);
}
</style>