<script setup lang="ts">
import { ref, computed } from 'vue';
import { useChainStore } from '@/stores/chainStore';
import { categories, categoryLabels, categoryColors, moduleNodeTypes } from '@/data/nodeTypes';
import type { ModuleNodeType, NodeCategory } from '@/types';

const chainStore = useChainStore();

const search = ref('');
const expandedCategories = ref<Set<string>>(new Set(categories));

const filteredNodes = computed(() => {
  if (!search.value.trim()) return moduleNodeTypes;
  const q = search.value.toLowerCase();
  return moduleNodeTypes.filter(
    (n) =>
      n.label.toLowerCase().includes(q) ||
      n.description.toLowerCase().includes(q) ||
      n.type.toLowerCase().includes(q)
  );
});

const grouped = computed(() => {
  const map = new Map<NodeCategory, ModuleNodeType[]>();
  for (const cat of categories) {
    map.set(cat, filteredNodes.value.filter((n) => n.category === cat));
  }
  return map;
});

function toggleCategory(cat: string) {
  const next = new Set(expandedCategories.value);
  if (next.has(cat)) next.delete(cat);
  else next.add(cat);
  expandedCategories.value = next;
}

function handleDragStart(e: DragEvent, nodeType: ModuleNodeType) {
  e.dataTransfer!.setData('application/vueflow', nodeType.type);
  e.dataTransfer!.effectAllowed = 'move';
}

function handleAddClick(nodeType: ModuleNodeType) {
  chainStore.addNode(nodeType.type);
}
</script>

<template>
  <div class="node-palette">
    <!-- Search -->
    <div class="palette-search">
      <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input
        v-model="search"
        type="text"
        placeholder="搜索模块..."
        class="palette-input"
      />
    </div>

    <!-- Categories -->
    <div class="palette-content">
      <div v-for="cat in categories" :key="cat" class="palette-category">
        <template v-if="(grouped.get(cat) || []).length > 0">
          <button @click="toggleCategory(cat)" class="category-btn">
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              class="chevron"
              :class="{ rotated: expandedCategories.has(cat) }"
            ><polyline points="9 18 15 12 9 6"/></svg>
            <span class="category-dot" :style="{ background: categoryColors[cat] }"></span>
            <span class="category-label">{{ categoryLabels[cat] }}</span>
            <span class="category-count">{{ (grouped.get(cat) || []).length }}</span>
          </button>

          <div v-if="expandedCategories.has(cat)" class="category-nodes">
            <div
              v-for="node in grouped.get(cat)"
              :key="node.type"
              draggable="true"
              @dragstart="(e) => handleDragStart(e as DragEvent, node)"
              @click="handleAddClick(node)"
              class="node-item"
            >
              <div class="node-item-icon" :style="{ background: node.color + '12' }">
                <span :style="{ color: node.color }">{{ node.label.charAt(0) }}</span>
              </div>
              <div class="node-item-info">
                <div class="node-item-label">{{ node.label }}</div>
                <div class="node-item-desc">{{ node.description }}</div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.node-palette {
  width: 272px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: 100%;
  flex-shrink: 0;
}

.palette-search {
  padding: 8px 12px;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 22px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text3);
}

.palette-input {
  width: 100%;
  padding: 6px 10px 6px 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  outline: none;
}

.palette-input:focus {
  border-color: rgba(99, 102, 241, 0.5);
}

.palette-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 16px;
}

.category-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
}

.category-btn:hover {
  background: var(--surface2);
}

.chevron {
  color: var(--text3);
  transition: transform 0.2s;
}

.chevron.rotated {
  transform: rotate(90deg);
}

.category-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.category-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  flex: 1;
  text-align: left;
}

.category-count {
  font-size: 10px;
  color: var(--text3);
  background: var(--surface2);
  padding: 1px 6px;
  border-radius: 8px;
}

.category-nodes {
  margin-left: 16px;
  margin-top: 2px;
}

.node-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: grab;
  transition: all 0.15s;
  border: 1px solid transparent;
}

.node-item:hover {
  background: var(--surface2);
  border-color: var(--border);
}

.node-item:active {
  cursor: grabbing;
}

.node-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
}

.node-item-info {
  flex: 1;
  min-width: 0;
}

.node-item-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-item-desc {
  font-size: 10px;
  color: var(--text3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
