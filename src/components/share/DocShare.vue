<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import draggable from 'vuedraggable';
import { useDocStore } from '@/stores/docStore';
import { docsApi } from '@/api/docs';
import type { SharedDoc } from '@/types';

const store = useDocStore();

// Local mutable list for draggable
const localDocs = ref<SharedDoc[]>([]);

// Watch store docs to sync with local
watch(
  () => store.docs,
  (newDocs) => {
    // If item count changed (add/delete), reassign
    if (newDocs.length !== localDocs.value.length) {
      localDocs.value = [...newDocs];
      return;
    }
    // If same set of IDs, just update data but keep order
    const newIds = new Set(newDocs.map(d => d.id));
    const localIds = new Set(localDocs.value.map(d => d.id));
    if (newIds.size === localIds.size && [...newIds].every(id => localIds.has(id))) {
      localDocs.value = localDocs.value.map(localDoc => {
        const updated = newDocs.find(d => d.id === localDoc.id);
        return updated || localDoc;
      });
    } else {
      localDocs.value = [...newDocs];
    }
  },
  { immediate: true, deep: true }
);

// Modal state
const showModal = ref(false);
const modalTab = ref<'upload' | 'paste'>('upload');
const pasteForm = ref<{ name: string; content: string; content_type: 'html' | 'md' }>({
  name: '', content: '', content_type: 'md'
});
const uploadError = ref('');
const pasteError = ref('');
const isSaving = ref(false);
const docToDelete = ref<SharedDoc | null>(null);
const dragOver = ref(false);

// Filter
const typeFilter = ref<'all' | 'html' | 'md'>('all');
const filteredDocs = computed(() => {
  if (typeFilter.value === 'all') return localDocs.value;
  return localDocs.value.filter(d => d.content_type === typeFilter.value);
});

// Toast
const toast = ref('');
let toastTimer: ReturnType<typeof setTimeout> | null = null;
function showToast(msg: string) {
  toast.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value = ''; }, 1800);
}

onUnmounted(() => {
  if (toastTimer) clearTimeout(toastTimer);
});

// ============ Inline Edit ============
const editingDocId = ref<number | null>(null);
const editingName = ref('');
const editInputRef = ref<HTMLInputElement | null>(null);

function startEditName(doc: SharedDoc) {
  editingDocId.value = doc.id;
  editingName.value = doc.name;
  // Focus input after render
  setTimeout(() => {
    editInputRef.value?.focus();
    editInputRef.value?.select();
  }, 0);
}

function cancelEditName() {
  editingDocId.value = null;
  editingName.value = '';
}

async function saveEditName(doc: SharedDoc) {
  const newName = editingName.value.trim();
  if (!newName) {
    cancelEditName();
    return;
  }
  if (newName === doc.name) {
    cancelEditName();
    return;
  }
  try {
    await store.updateDocName(doc.id, newName);
    // Update localDocs directly for immediate feedback
    const localDoc = localDocs.value.find(d => d.id === doc.id);
    if (localDoc) {
      localDoc.name = newName;
    }
    showToast('名称已更新');
  } catch (err) {
    console.error(err);
    showToast('更新失败');
  }
  cancelEditName();
}

function handleEditKeydown(e: KeyboardEvent, doc: SharedDoc) {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveEditName(doc);
  } else if (e.key === 'Escape') {
    cancelEditName();
  }
}

function openModal() {
  modalTab.value = 'upload';
  pasteForm.value = { name: '', content: '', content_type: 'md' };
  uploadError.value = '';
  pasteError.value = '';
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

// ============ Upload ============
function readFile(file: File) {
  if (isSaving.value) return;
  uploadError.value = '';
  if (file.size > 2 * 1024 * 1024) {
    uploadError.value = '文件超过 2MB';
    return;
  }
  const ext = file.name.toLowerCase().split('.').pop();
  if (!['html', 'htm', 'md'].includes(ext || '')) {
    uploadError.value = '仅支持 .html / .md 文件';
    return;
  }
  // 去掉文件名后缀
  const lastDotIndex = file.name.lastIndexOf('.');
  const nameWithoutExt = lastDotIndex > 0 ? file.name.substring(0, lastDotIndex) : file.name;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = String(e.target?.result || '');
    const contentType: 'html' | 'md' = ext === 'md' ? 'md' : 'html';
    isSaving.value = true;
    try {
      await store.addDoc({ name: nameWithoutExt, content, content_type: contentType });
      showModal.value = false;
      showToast('已生成短链');
    } catch (err) {
      uploadError.value = '上传失败';
      console.error(err);
    } finally {
      isSaving.value = false;
    }
  };
  reader.onerror = () => { uploadError.value = '读取文件失败'; };
  reader.readAsText(file);
}

function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) readFile(file);
  input.value = '';
}

function handleDrop(e: DragEvent) {
  dragOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) readFile(file);
}

// ============ Paste ============
async function handlePasteSubmit() {
  pasteError.value = '';
  if (!pasteForm.value.content.trim()) {
    pasteError.value = '内容不能为空';
    return;
  }
  isSaving.value = true;
  try {
    await store.addDoc({
      name: pasteForm.value.name.trim() || `未命名文档.${pasteForm.value.content_type === 'html' ? 'html' : 'md'}`,
      content: pasteForm.value.content,
      content_type: pasteForm.value.content_type
    });
    showModal.value = false;
    showToast('已生成短链');
  } catch (err) {
    pasteError.value = '创建失败';
    console.error(err);
  } finally {
    isSaving.value = false;
  }
}

// ============ Actions ============
async function handleDocDragEnd() {
  // Only reorder if filter is 'all' - filtering changes the displayed subset
  if (typeFilter.value !== 'all') return;

  const items = localDocs.value.map((doc, index) => ({
    id: doc.id,
    sort_order: index
  }));

  try {
    await store.reorderDocs(items);
  } catch (error) {
    console.error('Failed to reorder docs:', error);
    localDocs.value = [...store.docs];
  }
}

async function copyLink(doc: SharedDoc) {
  try {
    await navigator.clipboard.writeText(doc.url);
    showToast('已复制链接');
  } catch {
    showToast('复制失败');
  }
}

function openPreview(doc: SharedDoc) {
  window.open(doc.url, '_blank');
}

async function downloadDoc(doc: SharedDoc) {
  try {
    const ext = doc.content_type === 'html' ? 'html' : 'md';
    const filename = doc.name.toLowerCase().endsWith(`.${ext}`) ? doc.name : `${doc.name}.${ext}`;
    await docsApi.download(doc.id!, filename);
  } catch (err) {
    console.error(err);
    showToast('下载失败');
  }
}

function confirmDelete(doc: SharedDoc) {
  docToDelete.value = doc;
}

function cancelDelete() {
  docToDelete.value = null;
}

async function executeDelete() {
  const doc = docToDelete.value;
  if (!doc) return;
  docToDelete.value = null;
  try {
    await store.removeDoc(doc.id!);
    showToast('已删除');
  } catch (err) {
    showToast('删除失败');
    console.error(err);
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr.replace(' ', 'T'));
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} 天前`;
  return d.toLocaleDateString();
}

onMounted(() => {
  store.fetchDocs();
});
</script>

<template>
  <div class="doc-share-page">
    <!-- Toolbar -->
    <div class="doc-toolbar">
      <div class="flex gap-2">
        <button v-for="f in (['all','html','md'] as const)" :key="f"
          @click="typeFilter = f" class="doc-filter-btn" :class="{ active: typeFilter === f }">
          {{ f === 'all' ? '全部' : f === 'html' ? 'HTML' : 'Markdown' }}
        </button>
      </div>
      <button @click="openModal" class="doc-add-btn">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        新建文档
      </button>
    </div>

    <!-- List -->
    <div class="doc-list-area">
      <div v-if="store.loading" class="doc-empty">加载中...</div>
      <div v-else-if="localDocs.length === 0" class="doc-empty">
        <p style="font-size: 14px; font-weight: 500; color: var(--text2);">暂无文档</p>
        <p style="font-size: 12px;">点击右上角「新建文档」生成你的第一个短链</p>
      </div>
      <div v-else-if="filteredDocs.length === 0" class="doc-empty">
        <p style="font-size: 14px; font-weight: 500; color: var(--text2);">无匹配文档</p>
        <p style="font-size: 12px;">当前筛选条件下没有文档</p>
      </div>
      <!-- Draggable mode when no filter -->
      <draggable
        v-if="typeFilter === 'all'"
        v-model="localDocs"
        item-key="id"
        class="doc-grid"
        ghost-class="doc-card-ghost"
        :animation="200"
        @end="handleDocDragEnd"
      >
        <template #item="{ element: doc }">
          <div class="doc-card">
            <div class="doc-card-header">
              <span class="doc-type-badge" :class="doc.content_type">{{ doc.content_type === 'html' ? 'HTML' : 'MD' }}</span>
              <span class="doc-size">{{ formatSize(doc.size_bytes) }}</span>
            </div>
            <div class="doc-card-name" v-if="editingDocId !== doc.id" @dblclick="startEditName(doc)" title="双击编辑名称">{{ doc.name }}</div>
            <div v-else class="doc-card-name-edit">
              <input
                v-model="editingName"
                class="doc-name-input"
                @keydown="handleEditKeydown($event, doc)"
                @blur="saveEditName(doc)"
                @click.stop
              />
            </div>
            <div class="doc-card-meta">
              <span>👁 {{ doc.views }} 次</span>
              <span>{{ formatTime(doc.created_at) }}</span>
            </div>
            <div class="doc-card-actions">
              <button @click="copyLink(doc)" class="doc-action primary">复制链接</button>
              <button @click="openPreview(doc)" class="doc-action">打开</button>
              <button @click="downloadDoc(doc)" class="doc-action">下载</button>
              <button @click="confirmDelete(doc)" class="doc-action delete">×</button>
            </div>
          </div>
        </template>
      </draggable>
      <!-- Static mode when filter is active -->
      <div v-else class="doc-grid">
        <div v-for="doc in filteredDocs" :key="doc.id" class="doc-card">
          <div class="doc-card-header">
            <span class="doc-type-badge" :class="doc.content_type">{{ doc.content_type === 'html' ? 'HTML' : 'MD' }}</span>
            <span class="doc-size">{{ formatSize(doc.size_bytes) }}</span>
          </div>
          <div class="doc-card-name" v-if="editingDocId !== doc.id" @dblclick="startEditName(doc)" title="双击编辑名称">{{ doc.name }}</div>
          <div v-else class="doc-card-name-edit">
            <input
              v-model="editingName"
              class="doc-name-input"
              @keydown="handleEditKeydown($event, doc)"
              @blur="saveEditName(doc)"
              @click.stop
            />
          </div>
          <div class="doc-card-meta">
            <span>👁 {{ doc.views }} 次</span>
            <span>{{ formatTime(doc.created_at) }}</span>
          </div>
          <div class="doc-card-actions">
            <button @click="copyLink(doc)" class="doc-action primary">复制链接</button>
            <button @click="openPreview(doc)" class="doc-action">打开</button>
            <button @click="downloadDoc(doc)" class="doc-action">下载</button>
            <button @click="confirmDelete(doc)" class="doc-action delete">×</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="doc-modal-overlay" @click.self="closeModal">
      <div class="doc-modal">
        <div class="doc-modal-header">
          <span>新建短链文档</span>
          <button @click="closeModal" class="doc-close-btn">×</button>
        </div>
        <div class="doc-modal-tabs">
          <button @click="modalTab = 'upload'" class="doc-tab" :class="{ active: modalTab === 'upload' }">上传文件</button>
          <button @click="modalTab = 'paste'" class="doc-tab" :class="{ active: modalTab === 'paste' }">粘贴文本</button>
        </div>

        <!-- Upload -->
        <div v-if="modalTab === 'upload'" class="doc-modal-body">
          <label
            class="doc-dropzone"
            :class="{ active: dragOver }"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="handleDrop"
          >
            <input type="file" accept=".html,.htm,.md" style="display:none" @change="handleFileInput">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p style="margin: 12px 0 4px; font-size: 13px; font-weight: 500; color: var(--text);">点击或拖拽文件到此</p>
            <p style="margin: 0; font-size: 11px; color: var(--text3);">支持 .html / .htm / .md，最大 2MB</p>
          </label>
          <p v-if="uploadError" class="doc-error">{{ uploadError }}</p>
          <p v-if="isSaving" class="doc-info">上传中...</p>
        </div>

        <!-- Paste -->
        <div v-else class="doc-modal-body">
          <div class="doc-form-row">
            <label>标题</label>
            <input v-model="pasteForm.name" type="text" placeholder="可选，留空将自动命名" class="doc-input">
          </div>
          <div class="doc-form-row">
            <label>类型</label>
            <div class="doc-type-pick">
              <button @click="pasteForm.content_type = 'md'" class="doc-type-pick-btn" :class="{ active: pasteForm.content_type === 'md' }">Markdown</button>
              <button @click="pasteForm.content_type = 'html'" class="doc-type-pick-btn" :class="{ active: pasteForm.content_type === 'html' }">HTML</button>
            </div>
          </div>
          <div class="doc-form-row">
            <label>内容</label>
            <textarea v-model="pasteForm.content" class="doc-textarea" placeholder="粘贴 Markdown 或 HTML 内容..."></textarea>
          </div>
          <p v-if="pasteError" class="doc-error">{{ pasteError }}</p>
          <div class="doc-modal-footer">
            <button @click="closeModal" class="doc-btn-secondary">取消</button>
            <button @click="handlePasteSubmit" :disabled="isSaving" class="doc-btn-primary">生成短链</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div v-if="docToDelete" class="doc-modal-overlay" @click.self="cancelDelete">
      <div class="doc-confirm-modal">
        <div class="doc-confirm-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </div>
        <div class="doc-confirm-title">删除文档</div>
        <div class="doc-confirm-message">
          确定删除「<strong>{{ docToDelete.name }}</strong>」？<br>
          删除后短链将立即失效，此操作不可恢复。
        </div>
        <div class="doc-confirm-actions">
          <button @click="cancelDelete" class="doc-btn-secondary">取消</button>
          <button @click="executeDelete" class="doc-btn-danger">确认删除</button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <transition name="toast">
      <div v-if="toast" class="doc-toast">{{ toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.doc-share-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  background: var(--bg);
}
.doc-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.doc-filter-btn {
  padding: 5px 14px;
  border-radius: 18px;
  font-size: 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  transition: all 0.15s;
}
.doc-filter-btn:hover { border-color: var(--border2); color: var(--text); }
.doc-filter-btn.active {
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent);
}
.doc-add-btn {
  margin-left: auto;
  padding: 6px 16px;
  border-radius: 18px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  background: var(--accent);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: opacity 0.15s;
}
.doc-add-btn:hover { opacity: 0.85; }

.doc-list-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
.doc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 80px 20px;
  color: var(--text3);
  font-size: 12px;
  text-align: center;
}
.doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}
.doc-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  position: relative;
  cursor: grab;
}
.doc-card:active {
  cursor: grabbing;
}
.doc-card:hover {
  border-color: var(--border2);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  transform: translateY(-1px);
}
.doc-card-ghost {
  opacity: 0.4;
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 2px var(--accent-bg) !important;
}
.doc-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.doc-type-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}
.doc-type-badge.html { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
.doc-type-badge.md { background: rgba(8, 145, 178, 0.1); color: #0891b2; }
.doc-size { font-size: 11px; color: var(--text3); font-family: ui-monospace, monospace; }
.doc-card-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-height: 18px;
  cursor: text;
  border-radius: 4px;
  padding: 1px 4px;
  margin: -1px -4px;
  transition: background 0.15s;
}
.doc-card-name:hover {
  background: var(--surface2);
}
.doc-card-name-edit {
  min-height: 18px;
}
.doc-name-input {
  width: 100%;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 1px 4px;
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-bg);
  font-family: inherit;
}
.doc-card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text3);
}
.doc-card-actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.doc-action {
  flex: 1;
  padding: 5px 8px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text2);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.doc-action:hover {
  border-color: var(--border2);
  color: var(--text);
  background: var(--surface2);
}
.doc-action.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}
.doc-action.primary:hover { opacity: 0.85; }
.doc-action.delete {
  flex: 0 0 28px;
  color: var(--text3);
}
.doc-action.delete:hover {
  border-color: var(--red);
  color: var(--red);
  background: var(--red-bg);
}

/* Modal */
.doc-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.36);
  backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
}
.doc-modal {
  width: 100%;
  max-width: 480px;
  background: var(--surface);
  border-radius: 16px;
  overflow: hidden;
  animation: docModalIn 0.18s ease;
}
@keyframes docModalIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.doc-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.doc-close-btn {
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--text3);
  font-size: 20px;
  cursor: pointer;
  border-radius: 6px;
}
.doc-close-btn:hover { background: var(--surface2); }
.doc-modal-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 20px 0;
}
.doc-tab {
  padding: 6px 14px;
  border-radius: 8px 8px 0 0;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text3);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.doc-tab.active {
  background: var(--surface2);
  color: var(--text);
  border-color: var(--border);
}
.doc-modal-body {
  padding: 20px;
}
.doc-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 20px;
  border: 2px dashed var(--border2);
  border-radius: 12px;
  color: var(--text3);
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}
.doc-dropzone:hover, .doc-dropzone.active {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

.doc-form-row {
  margin-bottom: 14px;
}
.doc-form-row label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text2);
  margin-bottom: 6px;
}
.doc-input, .doc-textarea {
  width: 100%;
  padding: 8px 11px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  font-family: inherit;
}
.doc-input:focus, .doc-textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}
.doc-textarea {
  min-height: 140px;
  resize: vertical;
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 12px;
}
.doc-type-pick {
  display: flex;
  gap: 6px;
}
.doc-type-pick-btn {
  flex: 1;
  padding: 7px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text3);
  font-size: 12px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}
.doc-type-pick-btn.active {
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent);
}
.doc-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.doc-btn-secondary {
  padding: 7px 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text2);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.doc-btn-secondary:hover { background: var(--surface2); }
.doc-btn-primary {
  padding: 7px 16px;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.doc-btn-primary:hover { opacity: 0.85; }
.doc-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.doc-btn-danger {
  padding: 7px 16px;
  border-radius: 8px;
  border: none;
  background: var(--red);
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.doc-btn-danger:hover { opacity: 0.85; }

/* Confirm Modal */
.doc-confirm-modal {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border-radius: 16px;
  padding: 28px 28px 22px;
  text-align: center;
  animation: docModalIn 0.18s ease;
}
.doc-confirm-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--red-bg);
  color: var(--red);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
}
.doc-confirm-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}
.doc-confirm-message {
  font-size: 13px;
  color: var(--text2);
  line-height: 1.6;
  margin-bottom: 22px;
}
.doc-confirm-message strong {
  color: var(--text);
  font-weight: 600;
}
.doc-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.doc-error {
  margin: 8px 0 0;
  padding: 6px 10px;
  background: var(--red-bg);
  color: var(--red);
  border-radius: 6px;
  font-size: 11px;
}
.doc-info {
  margin: 8px 0 0;
  color: var(--text3);
  font-size: 11px;
}

/* Toast */
.doc-toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.85);
  color: white;
  padding: 9px 18px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  z-index: 200;
  box-shadow: 0 4px 14px rgba(0,0,0,0.2);
}
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }
</style>
