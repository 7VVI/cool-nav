<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import type { ModuleNodeData } from '@/types';
import { useChainStore } from '@/stores/chainStore';

const props = defineProps<{
  id: string;
  data: ModuleNodeData;
  selected?: boolean;
}>();

const chainStore = useChainStore();
const isEditing = ref(false);
const editInput = ref<HTMLInputElement | null>(null);
const editValue = ref('');

// Watch for data.editing being set externally (e.g., when custom module is first added)
watch(() => props.data.editing, (val) => {
  if (val && !isEditing.value) {
    startEditing();
  }
}, { immediate: true });

function startEditing() {
  isEditing.value = true;
  editValue.value = props.data.label;
  nextTick(() => {
    editInput.value?.focus();
    editInput.value?.select();
  });
}

function finishEditing() {
  isEditing.value = false;
  const newLabel = editValue.value.trim() || props.data.label;
  chainStore.updateNodeData(props.id, { label: newLabel, editing: false });
}

function handleLabelDblClick(e: MouseEvent) {
  e.stopPropagation();
  startEditing();
}

const statusStyles: Record<string, { border: string; bg: string; indicator: string }> = {
  idle: { border: 'border-[#e2e8f0]', bg: 'bg-white', indicator: '' },
  running: { border: 'border-[#6366f1]', bg: 'bg-[#eef2ff]', indicator: 'animate-pulse' },
  success: { border: 'border-[#22c55e]', bg: 'bg-[#f0fdf4]', indicator: '' },
  error: { border: 'border-[#ef4444]', bg: 'bg-[#fef2f2]', indicator: '' },
  warning: { border: 'border-[#f59e0b]', bg: 'bg-[#fffbeb]', indicator: '' },
};

const status = computed(() => props.data.status || 'idle');
const style = computed(() => statusStyles[status.value] || statusStyles.idle);
const color = computed(() => props.data.color || '#6366f1');

const handleBaseStyle = {
  width: '10px',
  height: '10px',
  background: 'transparent',
  border: 'none',
  transition: 'background 0.15s, border 0.15s',
};
</script>

<template>
  <div class="module-node-wrapper">
    <!-- Left handles (input) -->
    <Handle type="target" :position="Position.Left" id="left-top" :style="{ ...handleBaseStyle, top: '20%' }" class="node-handle" />
    <Handle type="target" :position="Position.Left" id="left-mid" :style="{ ...handleBaseStyle, top: '50%' }" class="node-handle" />
    <Handle type="target" :position="Position.Left" id="left-bottom" :style="{ ...handleBaseStyle, top: '80%' }" class="node-handle" />

    <!-- Right handles (output) -->
    <Handle type="source" :position="Position.Right" id="right-top" :style="{ ...handleBaseStyle, top: '20%' }" class="node-handle" />
    <Handle type="source" :position="Position.Right" id="right-mid" :style="{ ...handleBaseStyle, top: '50%' }" class="node-handle" />
    <Handle type="source" :position="Position.Right" id="right-bottom" :style="{ ...handleBaseStyle, top: '80%' }" class="node-handle" />

    <!-- Top handles (input) -->
    <Handle type="target" :position="Position.Top" id="top-left" :style="{ ...handleBaseStyle, left: '25%' }" class="node-handle" />
    <Handle type="target" :position="Position.Top" id="top-mid" :style="{ ...handleBaseStyle, left: '50%' }" class="node-handle" />
    <Handle type="target" :position="Position.Top" id="top-right" :style="{ ...handleBaseStyle, left: '75%' }" class="node-handle" />

    <!-- Bottom handles (output) -->
    <Handle type="source" :position="Position.Bottom" id="bottom-left" :style="{ ...handleBaseStyle, left: '25%' }" class="node-handle" />
    <Handle type="source" :position="Position.Bottom" id="bottom-mid" :style="{ ...handleBaseStyle, left: '50%' }" class="node-handle" />
    <Handle type="source" :position="Position.Bottom" id="bottom-right" :style="{ ...handleBaseStyle, left: '75%' }" class="node-handle" />

    <div
      class="module-node-card"
      :class="[
        style.border, style.bg,
        selected ? 'shadow-xl ring-2 ring-[#6366f1]/30 scale-[1.02]' : 'hover:shadow-xl hover:scale-[1.01]',
        style.indicator,
      ]"
      :style="{ borderTopColor: color, borderTopWidth: '3px' }"
    >
      <!-- Running ping -->
      <div
        v-if="status === 'running'"
        class="absolute inset-0 rounded-xl animate-ping opacity-20"
        :style="{ background: color }"
      />

      <!-- Icon -->
      <div
        class="module-node-icon"
        :style="{ background: color + '15' }"
      >
        <svg
          v-if="data.icon === 'globe'"
          width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          :style="{ color }"
        ><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <svg v-else-if="data.icon === 'lock'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <svg v-else-if="data.icon === 'users'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <svg v-else-if="data.icon === 'database'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
        <svg v-else-if="data.icon === 'arrow-up-right'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
        <svg v-else-if="data.icon === 'shield'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <svg v-else-if="data.icon === 'shopping-cart'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        <svg v-else-if="data.icon === 'credit-card'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        <svg v-else-if="data.icon === 'bell'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <svg v-else-if="data.icon === 'search'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <svg v-else-if="data.icon === 'file-text'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        <svg v-else-if="data.icon === 'mail'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        <svg v-else-if="data.icon === 'git-branch'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
        <svg v-else-if="data.icon === 'clock'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <svg v-else-if="data.icon === 'radio'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>
        <svg v-else-if="data.icon === 'play'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <svg v-else-if="data.icon === 'code'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        <svg v-else-if="data.icon === 'hard-drive'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
        <svg v-else-if="data.icon === 'server'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
        <svg v-else-if="data.icon === 'inbox'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
        <svg v-else-if="data.icon === 'refresh-cw'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        <svg v-else-if="data.icon === 'alert-triangle'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <svg v-else-if="data.icon === 'timer'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3L2 6"/><path d="M22 6l-3-3"/><line x1="6" y1="19" x2="6.01" y2="19"/><line x1="18" y1="19" x2="18.01" y2="19"/></svg>
        <svg v-else-if="data.icon === 'scroll-text'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 3H9v7h14V5a2 2 0 0 0-2-2z"/></svg>
        <svg v-else-if="data.icon === 'external-link'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color }"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
      </div>

      <!-- Info -->
      <div class="module-node-info">
        <input
          v-if="isEditing"
          ref="editInput"
          v-model="editValue"
          class="module-node-edit-input"
          @blur="finishEditing"
          @keydown.enter="finishEditing"
          @keydown.escape="finishEditing"
          @click.stop
        />
        <div
          v-else
          class="module-node-label"
          @dblclick="handleLabelDblClick"
        >{{ data.label }}</div>
        <div class="module-node-desc">{{ data.description }}</div>
      </div>

      <!-- Status Indicator -->
      <div v-if="status === 'success'" class="module-node-status" style="background: #22c55e;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div v-if="status === 'error'" class="module-node-status" style="background: #ef4444;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
      <div v-if="status === 'running'" class="module-node-status animate-spin" style="background: #6366f1;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.module-node-wrapper {
  position: relative;
}

.module-node-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 12px;
  padding: 12px 16px;
  min-width: 200px;
  max-width: 260px;
  border-width: 2px;
  border-style: solid;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: all 0.3s;
  cursor: pointer;
  background: white;
}

[data-theme="dark"] .module-node-card {
  background: #1a1a1a;
}

.module-node-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  flex-shrink: 0;
}

.module-node-info {
  flex: 1;
  min-width: 0;
}

.module-node-label {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: default;
}

.module-node-label:hover {
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.module-node-edit-input {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  background: white;
  border: 1px solid #6366f1;
  border-radius: 4px;
  padding: 1px 4px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

[data-theme="dark"] .module-node-edit-input {
  color: #e5e5e5;
  background: #1a1a1a;
}

[data-theme="dark"] .module-node-label {
  color: #e5e5e5;
}

.module-node-desc {
  font-size: 11px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

[data-theme="dark"] .module-node-desc {
  color: #737373;
}

.module-node-status {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

<style>
/* Global styles for Vue Flow handles - must be unscoped */
.node-handle {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.module-node-wrapper:hover .node-handle {
  opacity: 1;
  background: #6366f1 !important;
  border: 2px solid white !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* Show handles when user is dragging a connection line */
.vue-flow__connection-line .node-handle,
.vue-flow.vue-flow__connection-dragging .node-handle {
  opacity: 1;
  background: #6366f1 !important;
  border: 2px solid white !important;
}
</style>
