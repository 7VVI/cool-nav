<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Service, Group } from '@/types';
import { tagsApi, type Tag } from '@/api/tags';
import { useNavStore } from '@/stores/navStore';

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
const showLoginModal = ref(false);
const showDeleteConfirm = ref(false);
const showPassword = ref(false);
const allTags = ref<Tag[]>([]);

const hasCredentials = computed(() => {
  return props.service.username || props.service.password;
});

// Get group color for this service
const groupColor = computed(() => {
  const group = store.groups.find(g => g.id === props.service.group_id);
  return group?.color || '#3b6ef8';
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

// 计算渐变色条
const accentGradient = computed(() => {
  const color = props.service.accent_color || generateColorFromId(props.service.id);
  // 转换为更深色用于渐变终点
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const darkerColor = `#${Math.max(0, r - 40).toString(16).padStart(2, '0')}${Math.max(0, g - 40).toString(16).padStart(2, '0')}${Math.max(0, b - 40).toString(16).padStart(2, '0')}`;
  return `linear-gradient(90deg, ${color}, ${darkerColor})`;
});

// Load tags
onMounted(async () => {
  try {
    const res = await tagsApi.getAll();
    allTags.value = res.data || [];
  } catch (error) {
    console.error('Failed to load tags:', error);
  }
});

// Get service tags with full info
const serviceTags = computed(() => {
  const tags = props.service.tags || [];
  return tags.map(tagValue => {
    const tag = allTags.value.find(t => t.value === tagValue);
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
      class="rounded-2xl border p-4 flex flex-col gap-3 cursor-pointer card-hover service-card"
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

      <!-- Selection Checkbox -->
      <div v-if="selectable" class="absolute top-3 left-3 z-10">
        <button
          @click.stop="emit('toggleSelect', service)"
          class="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
          :style="{
            background: selected ? 'var(--accent)' : 'var(--surface)',
            borderColor: selected ? 'var(--accent)' : 'var(--border2)'
          }"
        >
          <svg v-if="selected" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
      </div>

      <!-- Top -->
      <div class="flex items-start gap-3" :class="{ 'ml-7': selectable }">
        <!-- Icon -->
        <div
          class="w-11 h-11 rounded-xl flex items-center justify-center text-[22px] flex-shrink-0"
          :style="{ background: hexToRgba(groupColor, 0.1) }"
        >
          {{ getDisplayIcon() }}
        </div>

        <!-- Body -->
        <div class="flex-1 min-w-0">
          <div class="text-[14.5px] font-semibold truncate mb-0.5" style="color: var(--text)">
            {{ service.name }}
          </div>
          <div class="text-[11.5px] font-mono truncate" style="color: var(--text3)">
            {{ trimUrl(service.url) }}
          </div>
        </div>

        <!-- Edit Button -->
        <button
          @click.stop="emit('edit', service)"
          class="w-7 h-7 rounded-md border flex items-center justify-center flex-shrink-0 transition-all"
          style="border-color: var(--border); color: var(--text3); opacity: 0"
          onmouseenter="this.style.opacity='1';this.style.background='var(--surface2)'"
          onmouseleave="this.style.opacity='0';this.style.background='var(--surface)'"
          title="编辑"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>

      <!-- Description -->
      <div class="text-[12.5px] leading-[1.4] line-clamp-2" style="color: var(--text2); min-height: 35px;">
        {{ service.description || '' }}
      </div>

      <!-- Tags - flex-grow 让它自动扩展 -->
      <div v-if="serviceTags.length > 0" class="flex flex-wrap gap-1.5 tags-area">
        <span
          v-for="tag in serviceTags"
          :key="tag.value"
          class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
          :style="{
            background: tag.color + '20',
            color: tag.color,
            border: '1px solid ' + tag.color + '40'
          }"
        >
          {{ tag.name }}
        </span>
      </div>

      <!-- Spacer - 当没有标签时占位 -->
      <div v-else class="flex-grow"></div>

      <!-- Meta -->
      <div class="flex items-center gap-1.5 mt-auto">
        <div
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
          :style="{
            background: hasCredentials ? 'var(--green-bg)' : 'var(--surface2)',
            color: hasCredentials ? 'var(--green)' : 'var(--text3)',
            borderColor: hasCredentials ? '#bbf7d0' : 'var(--border)'
          }"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          {{ hasCredentials ? '有凭据' : '无凭据' }}
        </div>

        <!-- 在线状态 -->
        <div v-if="service.is_online" class="online-badge">
          <span class="pulse-dot"></span>
          <span class="online-text">在线</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center gap-2">
        <button
          @click.stop="openLoginModal"
          class="flex-1 py-2 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
          style="background: var(--accent); color: white"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          打开
        </button>

        <button
          @click.stop="showDeleteConfirm = true"
          class="w-9 h-9 rounded-lg border flex items-center justify-center transition-colors"
          style="border-color: var(--border); color: var(--text3)"
          title="删除"
          onmouseenter="this.style.background='var(--red-bg)';this.style.color='var(--red)'"
          onmouseleave="this.style.background='var(--surface)';this.style.color='var(--text3)'"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/>
            <path d="M14 11v6"/>
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

    <!-- Delete Confirm Modal -->
    <div
      v-if="showDeleteConfirm"
      class="fixed inset-0 flex items-center justify-center z-50 p-4"
      style="background: rgba(0,0,0,.4); backdrop-filter: blur(6px)"
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
  position: relative;
  transition: all 0.18s ease;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.service-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.card-selected {
  box-shadow: 0 0 0 2px var(--accent);
}

.card-hover:hover button[style*="opacity: 0"] {
  opacity: 1 !important;
}

/* 简介文本截断 - 最多显示2行 */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 标签区域 */
.tags-area {
  flex-shrink: 0;
}

/* 渐变色条 */
.accent-bar {
  height: 3px;
  width: 100%;
  border-radius: 16px 16px 0 0;
  flex-shrink: 0;
  margin: -1px -1px 0 -1px;
}

/* 在线状态徽章 */
.online-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--green);
  flex-shrink: 0;
}

.online-text {
  font-weight: 500;
}

/* 在线状态脉冲动画 */
.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>