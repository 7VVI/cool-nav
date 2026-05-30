<script setup lang="ts">
import { ref } from 'vue';
import { useChainStore } from '@/stores/chainStore';

const chainStore = useChainStore();
const fileInputRef = ref<HTMLInputElement | null>(null);

function handleImport() {
  fileInputRef.value?.click();
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const text = ev.target?.result as string;
    chainStore.importChain(text);
  };
  reader.readAsText(file);
  input.value = '';
}

function handleExport() {
  const json = chainStore.exportChain();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${chainStore.chainName || 'chain'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleClear() {
  if (confirm('确认清空画布？此操作将删除所有模块和连线且无法恢复。')) {
    chainStore.clearCanvas();
  }
}
</script>

<template>
  <div class="chain-toolbar">
    <!-- Left -->
    <div class="toolbar-left">
      <button @click="chainStore.toggleNodePalette()" class="toolbar-icon-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
      </button>

      <div class="toolbar-divider" />

      <div class="toolbar-chain-name">
        <div class="chain-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="16" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M11 5h3"/><path d="M11 19h3"/><path d="M19 11v3"/><path d="M5 11v3"/></svg>
        </div>
        <input
          v-model="chainStore.chainName"
          class="chain-name-input"
        />
      </div>

      <div class="toolbar-divider" />

      <!-- Default Edge Style Toggle -->
      <button
        @click="chainStore.defaultEdgeStyle = chainStore.defaultEdgeStyle === 'bezier' ? 'smoothstep' : 'bezier'"
        class="toolbar-btn-sm"
        :title="chainStore.defaultEdgeStyle === 'bezier' ? '默认折线' : '默认曲线'"
      >
        <svg v-if="chainStore.defaultEdgeStyle === 'bezier'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20C3 20 8 4 21 4"/></svg>
        <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h8V4h10"/></svg>
        {{ chainStore.defaultEdgeStyle === 'bezier' ? '曲线' : '折线' }}
      </button>

      <div class="toolbar-divider" />

      <!-- Execute -->
      <button
        v-if="!chainStore.isExecuting"
        @click="chainStore.executeChain()"
        class="toolbar-btn execute"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        执行链路
      </button>
      <button
        v-else
        @click="chainStore.stopExecution()"
        class="toolbar-btn stop"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        停止
      </button>
    </div>

    <!-- Right -->
    <div class="toolbar-right">
      <span class="toolbar-stats">
        {{ chainStore.nodes.length }} 个模块 · {{ chainStore.edges.length }} 条连线
      </span>

      <div class="toolbar-divider" />

      <button @click="handleImport" class="toolbar-btn-sm">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        导入
      </button>
      <button @click="handleExport" class="toolbar-btn-sm">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        导出
      </button>

      <div class="toolbar-divider" />

      <button @click="handleClear" class="toolbar-btn-sm danger">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        清空
      </button>

      <input
        ref="fileInputRef"
        type="file"
        accept=".json"
        style="display: none"
        @change="handleFileChange"
      />
    </div>
  </div>
</template>

<style scoped>
.chain-toolbar {
  height: 48px;
  min-height: 48px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  flex-shrink: 0;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--border);
}

.toolbar-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.toolbar-icon-btn:hover {
  background: var(--surface2);
  color: var(--text);
}

.toolbar-chain-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chain-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #7c3aed);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: white;
}

.chain-name-input {
  height: 28px;
  width: 180px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text);
  padding: 0 4px;
  border-radius: 6px;
  outline: none;
}

.chain-name-input:hover {
  border-color: var(--border);
}

.chain-name-input:focus {
  border-color: rgba(99, 102, 241, 0.5);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  border: none;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.toolbar-btn.execute {
  background: #22c55e;
  color: white;
}

.toolbar-btn.execute:hover {
  background: #16a34a;
}

.toolbar-btn.stop {
  background: #ef4444;
  color: white;
}

.toolbar-btn.stop:hover {
  background: #dc2626;
}

.toolbar-stats {
  font-size: 11px;
  color: var(--text3);
}

.toolbar-btn-sm {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text2);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.toolbar-btn-sm:hover {
  border-color: var(--border2);
  color: var(--text);
}

.toolbar-btn-sm.danger:hover {
  border-color: #ef4444;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.06);
}
</style>
