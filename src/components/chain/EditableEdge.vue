<script setup lang="ts">
import { ref, nextTick, computed } from 'vue';
import { getBezierPath, getSmoothStepPath } from '@vue-flow/core';
import { useChainStore } from '@/stores/chainStore';

const props = defineProps<{
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: any;
  targetPosition: any;
  data?: { label?: string; lineStyle?: 'bezier' | 'smoothstep'; color?: string };
  markerEnd?: string;
  style?: Record<string, any>;
  selected?: boolean;
}>();

const chainStore = useChainStore();

const isEditing = ref(false);
const editValue = ref('');
const editInput = ref<HTMLInputElement | null>(null);

const edgeLabel = computed(() => props.data?.label || '');
const lineStyle = computed(() => props.data?.lineStyle || 'bezier');
const edgeColor = computed(() => props.data?.color || '#6366f1');

const pathParams = computed(() => ({
  sourceX: props.sourceX,
  sourceY: props.sourceY,
  sourcePosition: props.sourcePosition,
  targetX: props.targetX,
  targetY: props.targetY,
  targetPosition: props.targetPosition,
}));

const isSelected = computed(() => chainStore.selectedEdgeId === props.id);

const path = computed(() => {
  const fn = lineStyle.value === 'smoothstep' ? getSmoothStepPath : getBezierPath;
  const [edgePath, labelX, labelY] = fn(pathParams.value);
  return { edgePath, labelX, labelY };
});

function handleClick(e: MouseEvent) {
  e.stopPropagation();
  chainStore.selectEdge(props.id);
}

function handleDoubleClick(e: MouseEvent) {
  e.stopPropagation();
  isEditing.value = true;
  editValue.value = edgeLabel.value;
  nextTick(() => {
    editInput.value?.focus();
    editInput.value?.select();
  });
}

function finishEditing() {
  isEditing.value = false;
  if (editValue.value.trim()) {
    chainStore.updateEdgeData(props.id, { label: editValue.value.trim() });
  }
}
</script>

<template>
  <g class="editable-edge">
    <!-- Wide invisible interaction area for easy clicking -->
    <path
      :d="path.edgePath"
      fill="none"
      stroke="transparent"
      stroke-width="24"
      @click="handleClick"
      @dblclick="handleDoubleClick"
      style="cursor: pointer;"
    />
    <!-- Selection highlight glow -->
    <path
      v-if="isSelected"
      :d="path.edgePath"
      fill="none"
      :stroke="edgeColor"
      stroke-width="8"
      stroke-linecap="round"
      opacity="0.15"
    />
    <!-- Visible edge path -->
    <path
      :d="path.edgePath"
      fill="none"
      :stroke="edgeColor"
      :stroke-width="style?.strokeWidth || 2"
      stroke-linecap="round"
      :class="{ 'animated-edge': style?.animated !== false }"
      @click="handleClick"
      @dblclick="handleDoubleClick"
      style="cursor: pointer;"
    />
    <!-- Edge label - draw.io style plain text -->
    <text
      v-if="edgeLabel && !isEditing"
      :x="path.labelX"
      :y="path.labelY"
      text-anchor="middle"
      dominant-baseline="middle"
      fill="#64748b"
      font-size="12"
      font-weight="500"
      font-family="system-ui, -apple-system, sans-serif"
      @click="handleClick"
      @dblclick="handleDoubleClick"
      style="cursor: pointer;"
    >{{ edgeLabel }}</text>
    <!-- Edit input (when editing) -->
    <foreignObject
      v-if="isEditing"
      :x="path.labelX - 60"
      :y="path.labelY - 12"
      width="120"
      height="24"
    >
      <div xmlns="http://www.w3.org/1999/xhtml" class="edge-edit-wrapper">
        <input
          ref="editInput"
          v-model="editValue"
          class="edge-edit-input"
          @blur="finishEditing"
          @keydown.enter="finishEditing"
          @keydown.escape="isEditing = false"
        />
      </div>
    </foreignObject>
  </g>
</template>

<style scoped>
.animated-edge {
  animation: dashdraw 0.5s linear infinite;
  stroke-dasharray: 5;
}

@keyframes dashdraw {
  0% {
    stroke-dashoffset: 10;
  }
}

.edge-edit-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edge-edit-input {
  width: 116px;
  padding: 2px 6px;
  border: none;
  border-bottom: 1.5px solid #6366f1;
  border-radius: 0;
  font-size: 12px;
  font-weight: 500;
  outline: none;
  text-align: center;
  background: rgba(255, 255, 255, 0.95);
  color: #374151;
  font-family: system-ui, -apple-system, sans-serif;
}
</style>
