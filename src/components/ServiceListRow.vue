<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import type { Service } from '@/types';
import { tagsApi, type Tag } from '@/api/tags';

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

const allTags = ref<Tag[]>([]);

onMounted(async () => {
  try {
    const res = await tagsApi.getAll();
    allTags.value = res.data || [];
  } catch (error) {
    console.error('Failed to load tags:', error);
  }
});

const hasCredentials = computed(() => {
  return props.service.username || props.service.password;
});

const serviceTags = computed(() => {
  const tags = props.service.tags || [];
  return tags.map(tagValue => {
    const tag = allTags.value.find(t => t.value === tagValue);
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

function openUrl() {
  if (props.service.url) {
    window.open(props.service.url, '_blank');
  }
}

function handleRowClick() {
  if (props.selectable) {
    emit('toggleSelect', props.service);
  } else {
    openUrl();
  }
}
</script>

<template>
  <div
    class="list-row"
    :class="{ 'row-selected': selected }"
    @click="handleRowClick"
  >
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
      :style="{ background: hexToRgba(service.accent_color || '#3b6ef8', 0.1) }"
    >
      {{ service.icon || '🖥️' }}
    </div>

    <!-- 名称 -->
    <div class="list-name">{{ service.name }}</div>

    <!-- URL -->
    <div class="list-url font-mono">{{ trimUrl(service.url) }}</div>

    <!-- 标签 -->
    <div class="list-tags">
      <span
        v-for="tag in serviceTags.slice(0, 2)"
        :key="tag.value"
        class="list-tag"
        :style="{ background: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }"
      >
        {{ tag.name }}
      </span>
    </div>

    <!-- 凭据状态 -->
    <div class="list-auth">
      <span class="auth-dot" :class="hasCredentials ? 'has-cred' : 'no-cred'"></span>
      <span class="auth-text">{{ hasCredentials ? '有凭据' : '无凭据' }}</span>
    </div>

    <!-- 在线状态 -->
    <div v-if="service.is_online" class="list-online">
      <span class="pulse-dot"></span>
    </div>

    <!-- 操作按钮 -->
    <div class="list-actions">
      <button
        @click.stop="openUrl"
        class="list-open-btn"
        :style="{ background: hexToRgba(service.accent_color || '#3b6ef8', 0.15), color: service.accent_color || '#3b6ef8' }"
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
</template>

<style scoped>
.list-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.list-row:hover {
  border-color: var(--border2);
  background: var(--surface2);
  transform: translateX(2px);
}

.row-selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-bg);
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
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  border: 1px solid var(--border);
}

.list-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  width: 140px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-url {
  font-size: 11px;
  color: var(--text3);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-tags {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.list-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid;
}

.list-auth {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  flex-shrink: 0;
  width: 70px;
}

.auth-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.auth-dot.has-cred {
  background: var(--green);
}

.auth-dot.no-cred {
  background: var(--text3);
}

.auth-text {
  color: var(--text2);
}

.list-online {
  flex-shrink: 0;
  width: 20px;
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
  background: var(--surface);
  color: var(--text3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}

.list-edit-btn:hover {
  background: var(--surface2);
  color: var(--text);
}

.list-delete-btn:hover {
  background: var(--red-bg);
  color: var(--red);
  border-color: var(--red-border);
}
</style>