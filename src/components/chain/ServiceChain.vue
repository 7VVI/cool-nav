<script setup lang="ts">
import { useChainStore } from '@/stores/chainStore';
import Toolbar from './Toolbar.vue';
import NodePalette from './NodePalette.vue';
import FlowCanvas from './FlowCanvas.vue';
import NodeProperties from './NodeProperties.vue';
import EdgeProperties from './EdgeProperties.vue';

const chainStore = useChainStore();
</script>

<template>
  <div class="service-chain">
    <!-- Top Toolbar -->
    <Toolbar />

    <!-- Main Content -->
    <div class="chain-body">
      <!-- Left: Node Palette -->
      <NodePalette v-if="chainStore.showNodePalette" />

      <!-- Center: Flow Canvas -->
      <div class="canvas-area">
        <FlowCanvas />
      </div>

      <!-- Right: Properties Panel (Node or Edge) -->
      <NodeProperties />
      <EdgeProperties />
    </div>
  </div>
</template>

<style scoped>
.service-chain {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chain-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}
</style>
