<script setup lang="ts">
import { computed } from 'vue';
import { useChainStore } from '@/stores/chainStore';
import { getNodeType } from '@/data/nodeTypes';

const chainStore = useChainStore();

const selectedNode = computed(() =>
  chainStore.nodes.find((n) => n.id === chainStore.selectedNodeId)
);

const nodeTypeDef = computed(() =>
  selectedNode.value ? getNodeType(selectedNode.value.data.type) : undefined
);

const configEntries = computed(() =>
  Object.entries(selectedNode.value?.data.config || {}).filter(
    ([_, v]) => typeof v !== 'object'
  )
);

function updateLabel(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  if (selectedNode.value) chainStore.updateNodeData(selectedNode.value.id, { label: val });
}

function updateDescription(e: Event) {
  const val = (e.target as HTMLTextAreaElement).value;
  if (selectedNode.value) chainStore.updateNodeData(selectedNode.value.id, { description: val });
}

function updateConfig(key: string, e: Event) {
  const val = (e.target as HTMLInputElement).value;
  if (selectedNode.value) chainStore.updateNodeConfig(selectedNode.value.id, { [key]: val });
}

function handleDuplicate() {
  if (selectedNode.value) chainStore.duplicateNode(selectedNode.value.id);
}

function handleDelete() {
  if (selectedNode.value) chainStore.deleteNode(selectedNode.value.id);
}

const presetColors = [
  '#e74c3c', '#ef4444', '#f97316', '#f59e0b',
  '#22c55e', '#2ecc71', '#14b8a6', '#1abc9c',
  '#3498db', '#3b82f6', '#6366f1', '#8b5cf6',
  '#9b59b6', '#a855f7', '#ec4899', '#64748b',
];

function updateColor(color: string) {
  if (selectedNode.value) chainStore.updateNodeData(selectedNode.value.id, { color });
}

const statusConfig: Record<string, { label: string; color: string }> = {
  idle: { label: '空闲', color: 'bg-gray-100 text-gray-600' },
  running: { label: '运行中', color: 'bg-indigo-100 text-indigo-600' },
  success: { label: '成功', color: 'bg-green-100 text-green-600' },
  error: { label: '错误', color: 'bg-red-100 text-red-600' },
  warning: { label: '警告', color: 'bg-yellow-100 text-yellow-600' },
};
</script>

<template>
  <div v-if="chainStore.showProperties && selectedNode" class="node-properties">
    <!-- Header -->
    <div class="prop-header">
      <div class="prop-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        模块属性
      </div>
      <button @click="chainStore.toggleProperties()" class="prop-close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="prop-content">
      <!-- Node Info Card -->
      <div class="prop-info-card">
        <div class="prop-info-icon" :style="{ background: (selectedNode.data.color || '#6366f1') + '15' }">
          <span :style="{ color: selectedNode.data.color || '#6366f1' }">{{ selectedNode.data.label.charAt(0) }}</span>
        </div>
        <div class="prop-info-text">
          <div class="prop-info-label">{{ selectedNode.data.label }}</div>
          <div class="prop-info-desc">{{ selectedNode.data.description }}</div>
          <span class="prop-info-type" :style="{ background: (selectedNode.data.color || '#6366f1') + '15', color: selectedNode.data.color || '#6366f1' }">{{ selectedNode.data.type }}</span>
        </div>
      </div>

      <!-- Status -->
      <div class="prop-section">
        <label class="prop-section-label">状态</label>
        <span class="prop-status-badge" :class="statusConfig[selectedNode.data.status]?.color">
          {{ statusConfig[selectedNode.data.status]?.label || '空闲' }}
        </span>
      </div>

      <hr class="prop-divider" />

      <!-- Basic Config -->
      <div class="prop-section">
        <label class="prop-section-label">基本信息</label>
        <div class="prop-field">
          <label class="prop-field-label">名称</label>
          <input :value="selectedNode.data.label" @input="updateLabel" class="prop-input" />
        </div>
        <div class="prop-field">
          <label class="prop-field-label">描述</label>
          <textarea :value="selectedNode.data.description" @input="updateDescription" class="prop-textarea" rows="3"></textarea>
        </div>
      </div>

      <hr class="prop-divider" />

      <!-- Color -->
      <div class="prop-section">
        <label class="prop-section-label">节点颜色</label>
        <div class="prop-color-grid">
          <button
            v-for="c in presetColors"
            :key="c"
            class="prop-color-swatch"
            :class="{ active: (selectedNode.data.color || '#6366f1') === c }"
            :style="{ background: c }"
            @click="updateColor(c)"
          >
            <svg v-if="(selectedNode.data.color || '#6366f1') === c" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <label class="prop-color-custom">
            <input
              type="color"
              :value="selectedNode.data.color || '#6366f1'"
              @input="(e) => updateColor((e.target as HTMLInputElement).value)"
              class="prop-color-input"
            />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </label>
        </div>
      </div>

      <hr class="prop-divider" />

      <!-- Module Config -->
      <div v-if="configEntries.length > 0" class="prop-section">
        <label class="prop-section-label">模块配置</label>
        <div class="prop-config-box">
          <div v-for="[key, value] in configEntries" :key="key" class="prop-field">
            <label class="prop-field-label">{{ key.replace(/([A-Z])/g, ' $1').trim() }}</label>
            <input :value="String(value)" @input="(e) => updateConfig(key, e)" class="prop-input" />
          </div>
        </div>
      </div>

      <hr class="prop-divider" />

      <!-- Metadata -->
      <div class="prop-section">
        <label class="prop-section-label">节点信息</label>
        <div class="prop-meta">
          <div class="prop-meta-row"><span>节点 ID</span><span class="mono">{{ selectedNode.id }}</span></div>
          <div class="prop-meta-row"><span>坐标位置</span><span class="mono">({{ Math.round(selectedNode.position.x) }}, {{ Math.round(selectedNode.position.y) }})</span></div>
          <div class="prop-meta-row"><span>输入端口</span><span class="mono">{{ nodeTypeDef?.inputs ?? 1 }}</span></div>
          <div class="prop-meta-row"><span>输出端口</span><span class="mono">{{ nodeTypeDef?.outputs ?? 1 }}</span></div>
        </div>
      </div>

      <hr class="prop-divider" />

      <!-- Actions -->
      <div class="prop-actions">
        <button @click="handleDuplicate" class="prop-action-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          复制节点
        </button>
        <button @click="handleDelete" class="prop-action-btn danger">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          删除节点
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.node-properties {
  width: 320px;
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: 100%;
  flex-shrink: 0;
  animation: slideIn 0.2s ease;
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.prop-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.prop-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.prop-close {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.prop-close:hover {
  color: var(--text);
}

.prop-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.prop-info-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: var(--surface2);
}

.prop-info-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  flex-shrink: 0;
  font-size: 20px;
  font-weight: 600;
}

.prop-info-text {
  flex: 1;
  min-width: 0;
}

.prop-info-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.prop-info-desc {
  font-size: 12px;
  color: var(--text3);
  margin-top: 2px;
}

.prop-info-type {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
  margin-top: 4px;
}

.prop-section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 8px;
}

.prop-status-badge {
  display: inline-block;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 6px;
}

.prop-divider {
  border: none;
  border-top: 1px solid var(--border);
}

.prop-field {
  margin-bottom: 10px;
}

.prop-field-label {
  font-size: 12px;
  color: var(--text3);
  margin-bottom: 4px;
  display: block;
}

.prop-input {
  width: 100%;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  outline: none;
}

.prop-input:focus {
  border-color: rgba(99, 102, 241, 0.5);
}

.prop-textarea {
  width: 100%;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  outline: none;
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

.prop-textarea:focus {
  border-color: rgba(99, 102, 241, 0.5);
}

.prop-config-box {
  background: var(--surface2);
  border-radius: 12px;
  padding: 12px;
}

.prop-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prop-meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text3);
}

.prop-meta-row .mono {
  font-family: 'SF Mono', 'Menlo', monospace;
  color: var(--text);
  font-size: 11px;
}

.prop-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prop-action-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text2);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.prop-action-btn:hover {
  border-color: var(--border2);
  color: var(--text);
}

.prop-action-btn.danger:hover {
  border-color: #ef4444;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.06);
}

.prop-color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.prop-color-swatch {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  padding: 0;
}

.prop-color-swatch:hover {
  transform: scale(1.15);
}

.prop-color-swatch.active {
  border-color: #374151;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
}

.prop-color-custom {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px dashed var(--border);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text3);
  position: relative;
  transition: all 0.15s;
}

.prop-color-custom:hover {
  border-color: var(--text2);
  color: var(--text);
}

.prop-color-input {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
</style>
