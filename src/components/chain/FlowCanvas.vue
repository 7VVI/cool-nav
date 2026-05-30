<script setup lang="ts">
import { markRaw, ref } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';
import ModuleNode from './ModuleNode.vue';
import EditableEdge from './EditableEdge.vue';
import { useChainStore } from '@/stores/chainStore';

const chainStore = useChainStore();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: any = {
  moduleNode: markRaw(ModuleNode),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edgeTypes: any = {
  editableEdge: markRaw(EditableEdge),
};

const { screenToFlowCoordinate, onConnect: vfOnConnect, onPaneClick, onNodeClick } = useVueFlow();

const canvasRef = ref<HTMLDivElement | null>(null);

vfOnConnect((params) => {
  chainStore.onConnect(params);
});

onPaneClick(() => {
  chainStore.selectNode(null);
  chainStore.selectEdge(null);
});

onNodeClick(({ node }) => {
  chainStore.selectNode(node.id);
});

function onDragOver(event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

function onDrop(event: DragEvent) {
  event.preventDefault();
  const type = event.dataTransfer?.getData('application/vueflow');
  if (!type) return;
  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY });
  chainStore.addNode(type, position);
}
</script>

<template>
  <div
    ref="canvasRef"
    class="flow-canvas"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <VueFlow
      v-model:nodes="chainStore.nodes"
      v-model:edges="chainStore.edges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :default-edge-options="{
        type: 'editableEdge',
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2 },
      }"
      :fit-view-on-init="true"
      :fit-view-options="{ padding: 0.4 }"
      :snap-to-grid="true"
      :snap-grid="[16, 16]"
      :min-zoom="0.1"
      :max-zoom="2"
      :delete-key-code="'Delete'"
    >
      <Background :gap="20" :size="1" pattern-color="#d1d5db" />
      <Controls :show-interactive="false" />
      <MiniMap
        :pannable="true"
        :zoomable="true"
        :node-stroke-width="3"
      />
    </VueFlow>
  </div>
</template>

<style scoped>
.flow-canvas {
  width: 100%;
  height: 100%;
  background: #f9fafb;
}

[data-theme="dark"] .flow-canvas {
  background: #0a0a0a;
}
</style>
