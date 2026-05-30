<script setup lang="ts">
import { computed } from 'vue';
import { useChainStore } from '@/stores/chainStore';

const chainStore = useChainStore();

const selectedEdge = computed(() => {
  if (!chainStore.selectedEdgeId) return null;
  return chainStore.edges.find((e: any) => e.id === chainStore.selectedEdgeId) || null;
});

const sourceNode = computed(() => {
  if (!selectedEdge.value) return null;
  return chainStore.nodes.find((n: any) => n.id === selectedEdge.value.source) || null;
});

const targetNode = computed(() => {
  if (!selectedEdge.value) return null;
  return chainStore.nodes.find((n: any) => n.id === selectedEdge.value.target) || null;
});

const currentLineStyle = computed(() => {
  return selectedEdge.value?.data?.lineStyle || 'bezier';
});

const currentColor = computed(() => {
  return selectedEdge.value?.data?.color || '#6366f1';
});

const currentLabel = computed(() => {
  return selectedEdge.value?.data?.label || '';
});

function setLineStyle(style: 'bezier' | 'smoothstep') {
  if (chainStore.selectedEdgeId) {
    chainStore.updateEdgeLineStyle(chainStore.selectedEdgeId, style);
  }
}

function updateColor(color: string) {
  if (chainStore.selectedEdgeId) {
    chainStore.updateEdgeData(chainStore.selectedEdgeId, { color });
  }
}

function updateLabel(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  if (chainStore.selectedEdgeId) {
    chainStore.updateEdgeData(chainStore.selectedEdgeId, { label: val });
  }
}

function handleDelete() {
  if (chainStore.selectedEdgeId) {
    chainStore.deleteEdge(chainStore.selectedEdgeId);
  }
}

function handleClose() {
  chainStore.selectEdge(null);
}

const presetColors = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#e74c3c', '#ef4444', '#f97316', '#f59e0b',
  '#22c55e', '#2ecc71', '#14b8a6', '#1abc9c',
  '#3498db', '#3b82f6', '#64748b', '#374151',
];
</script>

<template>
  <div v-if="selectedEdge" class="edge-properties">
    <!-- Header -->
    <div class="eprop-header">
      <div class="eprop-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20C3 20 8 4 21 4"/></svg>
        连线属性
      </div>
      <button @click="handleClose" class="eprop-close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="eprop-content">
      <!-- Connection Info -->
      <div class="eprop-info-card">
        <div class="eprop-info-dot" :style="{ background: currentColor }" />
        <div class="eprop-info-text">
          <div class="eprop-info-label">
            {{ sourceNode?.data?.label || '?' }} → {{ targetNode?.data?.label || '?' }}
          </div>
          <div class="eprop-info-desc">连线</div>
        </div>
      </div>

      <hr class="eprop-divider" />

      <!-- Line Style -->
      <div class="eprop-section">
        <label class="eprop-section-label">线条类型</label>
        <div class="eprop-style-group">
          <button
            :class="['eprop-style-btn', { active: currentLineStyle === 'bezier' }]"
            @click="setLineStyle('bezier')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20C3 20 8 4 21 4"/></svg>
            曲线
          </button>
          <button
            :class="['eprop-style-btn', { active: currentLineStyle === 'smoothstep' }]"
            @click="setLineStyle('smoothstep')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h8V4h10"/></svg>
            折线
          </button>
        </div>
      </div>

      <hr class="eprop-divider" />

      <!-- Color -->
      <div class="eprop-section">
        <label class="eprop-section-label">线条颜色</label>
        <div class="eprop-color-grid">
          <button
            v-for="c in presetColors"
            :key="c"
            class="eprop-color-swatch"
            :class="{ active: currentColor === c }"
            :style="{ background: c }"
            @click="updateColor(c)"
          >
            <svg v-if="currentColor === c" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <label class="eprop-color-custom">
            <input
              type="color"
              :value="currentColor"
              @input="(e) => updateColor((e.target as HTMLInputElement).value)"
              class="eprop-color-input"
            />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </label>
        </div>
      </div>

      <hr class="eprop-divider" />

      <!-- Label / Annotation -->
      <div class="eprop-section">
        <label class="eprop-section-label">注释文本</label>
        <div class="eprop-field">
          <input
            :value="currentLabel"
            @input="updateLabel"
            class="eprop-input"
            placeholder="双击连线或在此输入注释..."
          />
        </div>
      </div>

      <hr class="eprop-divider" />

      <!-- Connection Info -->
      <div class="eprop-section">
        <label class="eprop-section-label">连线信息</label>
        <div class="eprop-meta">
          <div class="eprop-meta-row"><span>起始节点</span><span class="mono">{{ sourceNode?.data?.label || '-' }}</span></div>
          <div class="eprop-meta-row"><span>目标节点</span><span class="mono">{{ targetNode?.data?.label || '-' }}</span></div>
        </div>
      </div>

      <hr class="eprop-divider" />

      <!-- Actions -->
      <div class="eprop-actions">
        <button @click="handleDelete" class="eprop-action-btn danger">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          删除连线
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edge-properties {
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

.eprop-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.eprop-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.eprop-close {
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

.eprop-close:hover {
  color: var(--text);
}

.eprop-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.eprop-info-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: var(--surface2);
}

.eprop-info-dot {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  flex-shrink: 0;
}

.eprop-info-text {
  flex: 1;
  min-width: 0;
}

.eprop-info-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.eprop-info-desc {
  font-size: 11px;
  color: var(--text3);
  margin-top: 2px;
}

.eprop-section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 8px;
}

.eprop-divider {
  border: none;
  border-top: 1px solid var(--border);
}

.eprop-style-group {
  display: flex;
  gap: 6px;
}

.eprop-style-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text2);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.eprop-style-btn:hover {
  border-color: var(--border2);
  color: var(--text);
}

.eprop-style-btn.active {
  background: #6366f1;
  border-color: #6366f1;
  color: white;
}

.eprop-color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.eprop-color-swatch {
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

.eprop-color-swatch:hover {
  transform: scale(1.15);
}

.eprop-color-swatch.active {
  border-color: #374151;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
}

.eprop-color-custom {
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

.eprop-color-custom:hover {
  border-color: var(--text2);
  color: var(--text);
}

.eprop-color-input {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.eprop-field {
  margin-bottom: 0;
}

.eprop-input {
  width: 100%;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  outline: none;
}

.eprop-input:focus {
  border-color: rgba(99, 102, 241, 0.5);
}

.eprop-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.eprop-meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text3);
}

.eprop-meta-row .mono {
  font-family: 'SF Mono', 'Menlo', monospace;
  color: var(--text);
  font-size: 11px;
}

.eprop-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.eprop-action-btn {
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

.eprop-action-btn.danger:hover {
  border-color: #ef4444;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.06);
}
</style>
