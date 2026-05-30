import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ModuleNodeData } from '@/types';
import { getNodeType } from '@/data/nodeTypes';

let idCounter = 0;
function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

const defaultEdgeOpts = {
  type: 'editableEdge',
  animated: true,
  style: { stroke: '#6366f1', strokeWidth: 2 },
};

export const useChainStore = defineStore('chain', () => {
  // Use any[] to avoid Vue Flow's complex internal GraphNode/GraphEdge types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodes = ref<any[]>([
    {
      id: 'start-1',
      type: 'moduleNode',
      position: { x: 300, y: 200 },
      data: {
        label: 'HTTP 请求',
        description: '通过HTTP请求触发链路执行',
        icon: 'globe',
        category: 'triggers',
        type: 'http_trigger',
        status: 'idle',
        config: { method: 'GET', path: '/api/trigger' },
        color: '#e74c3c',
      },
    },
    {
      id: 'auth-1',
      type: 'moduleNode',
      position: { x: 580, y: 200 },
      data: {
        label: '认证服务',
        description: '用户认证与授权校验',
        icon: 'lock',
        category: 'services',
        type: 'auth_service',
        status: 'idle',
        config: { authType: 'JWT' },
        color: '#3498db',
      },
    },
    {
      id: 'process-1',
      type: 'moduleNode',
      position: { x: 860, y: 200 },
      data: {
        label: '用户服务',
        description: '用户信息管理微服务',
        icon: 'users',
        category: 'services',
        type: 'user_service',
        status: 'idle',
        config: { endpoint: '/api/users' },
        color: '#3498db',
      },
    },
    {
      id: 'data-1',
      type: 'moduleNode',
      position: { x: 1140, y: 200 },
      data: {
        label: 'MySQL',
        description: 'MySQL数据库读写操作',
        icon: 'database',
        category: 'data',
        type: 'mysql',
        status: 'idle',
        config: { host: 'localhost', port: 3306, operation: 'query' },
        color: '#2ecc71',
      },
    },
    {
      id: 'output-1',
      type: 'moduleNode',
      position: { x: 1420, y: 200 },
      data: {
        label: 'HTTP 响应',
        description: '返回HTTP响应结果',
        icon: 'arrow-up-right',
        category: 'services',
        type: 'http_response',
        status: 'idle',
        config: { statusCode: 200 },
        color: '#1abc9c',
      },
    },
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edges = ref<any[]>([
    { id: 'e-start-auth', source: 'start-1', sourceHandle: 'right-mid', target: 'auth-1', targetHandle: 'left-mid', ...defaultEdgeOpts },
    { id: 'e-auth-process', source: 'auth-1', sourceHandle: 'right-mid', target: 'process-1', targetHandle: 'left-mid', ...defaultEdgeOpts },
    { id: 'e-process-data', source: 'process-1', sourceHandle: 'right-mid', target: 'data-1', targetHandle: 'left-mid', ...defaultEdgeOpts },
    { id: 'e-data-output', source: 'data-1', sourceHandle: 'right-mid', target: 'output-1', targetHandle: 'left-mid', ...defaultEdgeOpts },
  ]);

  const selectedNodeId = ref<string | null>(null);
  const selectedEdgeId = ref<string | null>(null);
  const chainName = ref('用户请求处理链路');
  const isExecuting = ref(false);
  const showNodePalette = ref(true);
  const showProperties = ref(false);
  const defaultEdgeStyle = ref<'bezier' | 'smoothstep'>('bezier');

  function selectNode(id: string | null) {
    selectedNodeId.value = id;
    showProperties.value = id !== null;
    if (id !== null) selectedEdgeId.value = null;
  }

  function selectEdge(id: string | null) {
    selectedEdgeId.value = id;
    if (id !== null) {
      selectedNodeId.value = null;
      showProperties.value = false;
    }
  }

  function addNode(type: string, position?: { x: number; y: number }) {
    const nodeTypeDef = getNodeType(type);
    if (!nodeTypeDef) return;
    const id = genId(type);
    const isCustom = type === 'custom_module';
    nodes.value = [
      ...nodes.value,
      {
        id,
        type: 'moduleNode',
        position: position || { x: 400 + Math.random() * 200, y: 200 + Math.random() * 200 },
        data: {
          label: isCustom ? '自定义模块' : nodeTypeDef.label,
          description: nodeTypeDef.description,
          icon: nodeTypeDef.icon,
          category: nodeTypeDef.category,
          type: nodeTypeDef.type,
          status: 'idle',
          config: { ...nodeTypeDef.defaultConfig },
          color: nodeTypeDef.color,
          inputs: nodeTypeDef.inputs,
          outputs: nodeTypeDef.outputs,
          editing: isCustom, // auto-enter edit mode for custom modules
        },
      },
    ];
    // Auto-select the new custom node so it gets focus
    if (isCustom) {
      setTimeout(() => selectNode(id), 50);
    }
  }

  function deleteNode(id: string) {
    nodes.value = nodes.value.filter((n: any) => n.id !== id);
    edges.value = edges.value.filter((e: any) => e.source !== id && e.target !== id);
    if (selectedNodeId.value === id) selectNode(null);
  }

  function duplicateNode(id: string) {
    const node = nodes.value.find((n: any) => n.id === id);
    if (!node) return;
    const newId = genId(node.data.type);
    nodes.value = [
      ...nodes.value,
      {
        ...node,
        id: newId,
        position: { x: node.position.x + 50, y: node.position.y + 50 },
        data: { ...node.data, status: 'idle' },
      },
    ];
  }

  function updateNodeData(id: string, data: Partial<ModuleNodeData>) {
    nodes.value = nodes.value.map((n: any) =>
      n.id === id ? { ...n, data: { ...n.data, ...data } } : n
    );
  }

  function updateNodeConfig(id: string, config: Record<string, unknown>) {
    nodes.value = nodes.value.map((n: any) =>
      n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...config } } } : n
    );
  }

  function onConnect(params: any) {
    edges.value = [
      ...edges.value,
      {
        id: `e-${params.source}-${params.target}`,
        source: params.source,
        sourceHandle: params.sourceHandle ?? undefined,
        target: params.target,
        targetHandle: params.targetHandle ?? undefined,
        data: { lineStyle: defaultEdgeStyle.value },
        ...defaultEdgeOpts,
      },
    ];
  }

  function clearCanvas() {
    nodes.value = [];
    edges.value = [];
    selectedNodeId.value = null;
    showProperties.value = false;
  }

  function exportChain(): string {
    return JSON.stringify({ chainName: chainName.value, nodes: nodes.value, edges: edges.value }, null, 2);
  }

  function importChain(json: string) {
    try {
      const data = JSON.parse(json);
      if (data.nodes && data.edges) {
        nodes.value = data.nodes;
        edges.value = data.edges;
        chainName.value = data.chainName || '导入的链路';
      }
    } catch {
      console.error('Invalid JSON');
    }
  }

  function executeChain() {
    if (isExecuting.value) return;
    isExecuting.value = true;

    const _nodes = [...nodes.value];
    let i = 0;

    const step = () => {
      if (i >= _nodes.length) {
        isExecuting.value = false;
        nodes.value = nodes.value.map((n: any) => ({ ...n, data: { ...n.data, status: 'idle' as const } }));
        return;
      }

      nodes.value = nodes.value.map((n: any) => {
        if (n.id === _nodes[i].id) return { ...n, data: { ...n.data, status: 'running' as const } };
        if (i > 0 && n.id === _nodes[i - 1].id) return { ...n, data: { ...n.data, status: 'success' as const } };
        return n;
      });

      i++;
      setTimeout(step, 600);
    };

    step();
  }

  function stopExecution() {
    isExecuting.value = false;
    nodes.value = nodes.value.map((n: any) => ({ ...n, data: { ...n.data, status: 'idle' as const } }));
  }

  function toggleNodePalette() {
    showNodePalette.value = !showNodePalette.value;
  }

  function toggleProperties() {
    showProperties.value = !showProperties.value;
  }

  function updateEdgeData(id: string, data: Record<string, unknown>) {
    edges.value = edges.value.map((e: any) =>
      e.id === id ? { ...e, data: { ...(e.data || {}), ...data } } : e
    );
  }

  function updateEdgeLineStyle(id: string, lineStyle: 'bezier' | 'smoothstep') {
    updateEdgeData(id, { lineStyle });
  }

  function deleteEdge(id: string) {
    edges.value = edges.value.filter((e: any) => e.id !== id);
    if (selectedEdgeId.value === id) selectedEdgeId.value = null;
  }

  return {
    nodes, edges, selectedNodeId, selectedEdgeId, chainName, isExecuting,
    showNodePalette, showProperties, defaultEdgeStyle,
    selectNode, selectEdge, addNode, deleteNode, deleteEdge, duplicateNode,
    updateNodeData, updateNodeConfig, updateEdgeData, updateEdgeLineStyle, onConnect,
    clearCanvas, exportChain, importChain,
    executeChain, stopExecution,
    toggleNodePalette, toggleProperties,
  };
});
