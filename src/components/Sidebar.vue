<template>
    <div class="sidebar" :class="{ 'active': isActive }">
        <div class="logo">
            <i class="fas fa-robot"></i>
            <span>ewChat</span>
        </div>

        <button class="new-chat-btn" @click="$emit('new-chat')">
            <i class="fas fa-plus"></i>
            <span>{{ translations.newChat }}</span>
        </button>

        <div class="history-container">
            <h3>{{ translations.chatHistory }}</h3>
            <div class="chat-history">
                <div v-for="chat in sortedChats" :key="chat.id" class="chat-history-item"
                    :class="{ 'active': chat.id === currentChatId }" @click="$emit('load-chat', chat.id)">
                    <i class="fas fa-comment"></i>
                    <span>{{ chat.title }}</span>
                    <div class="chat-options">
                        <button class="chat-option-button" @click.stop="deleteChat(chat.id)">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="chat-option-button" @click.stop="renameChat(chat.id)">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="settings">
            <button @click="$emit('clear-history')">
                <i class="fas fa-trash"></i>
                <span>{{ translations.clearHistory }}</span>
            </button>
            <button @click="$emit('toggle-theme')">
                <i :class="isDarkMode ? 'fas fa-sun' : 'fas fa-moon'"></i>
                <span>{{ isDarkMode ? translations.lightMode : translations.darkMode }}</span>
            </button>
            <button @click="$emit('toggle-language')">
                <i class="fas fa-language"></i>
                <span>{{ translations.language }}</span>
            </button>
        </div>
    </div>

    <!-- 删除确认对话框 -->
    <Modal v-if="showDeleteModal" @close="showDeleteModal = false">
        <template #header>
            <h3>{{ translations.deleteText || '删除聊天' }}</h3>
        </template>
        <template #body>
            <p>{{ translations.confirmDelete || '确定要删除这个聊天吗？' }}</p>
        </template>
        <template #footer>
            <button class="modal-button cancel" @click="showDeleteModal = false">{{ translations.cancel || '取消'
            }}</button>
            <button class="modal-button confirm" @click="confirmDeleteChat">{{ translations.confirm || '确认' }}</button>
        </template>
    </Modal>

    <!-- 重命名对话框 -->
    <Modal v-if="showRenameModal" @close="showRenameModal = false">
        <template #header>
            <h3>{{ translations.renameText || '重命名聊天' }}</h3>
        </template>
        <template #body>
            <div class="rename-input-container">
                <label for="new-chat-title">{{ translations.newChatTitle || '新的聊天标题' }}</label>
                <input id="new-chat-title" v-model="newChatTitle" type="text" class="rename-input"
                    @keyup.enter="confirmRenameChat" />
            </div>
        </template>
        <template #footer>
            <button class="modal-button cancel" @click="showRenameModal = false">{{ translations.cancel || '取消'
            }}</button>
            <button class="modal-button confirm" @click="confirmRenameChat">{{ translations.confirm || '确认' }}</button>
        </template>
    </Modal>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import Modal from './Modal.vue';
import { Chat } from '../types';

const props = defineProps<{
    isActive: boolean;
    chats: Record<string, Chat>;
    currentChatId: string | null;
    translations: Record<string, string>;
}>();

const emit = defineEmits<{
    'new-chat': [];
    'load-chat': [chatId: string];
    'clear-history': [];
    'toggle-theme': [];
    'toggle-language': [];
    'delete-chat': [chatId: string];
    'rename-chat': [chatId: string, newTitle: string];
}>();

// 计算属性：按时间戳排序的聊天列表
const sortedChats = computed(() => {
    return Object.values(props.chats).sort((a, b) => b.timestamp - a.timestamp);
});

// 计算属性：是否为深色模式
const isDarkMode = computed(() => {
    return document.body.classList.contains('dark-mode');
});

// 删除聊天相关状态
const showDeleteModal = ref(false);
const chatToDelete = ref<string | null>(null);

// 重命名聊天相关状态
const showRenameModal = ref(false);
const chatToRename = ref<string | null>(null);
const newChatTitle = ref('');

// 删除聊天
function deleteChat(chatId: string) {
    chatToDelete.value = chatId;
    showDeleteModal.value = true;
}

// 确认删除聊天
function confirmDeleteChat() {
    if (chatToDelete.value) {
        emit('delete-chat', chatToDelete.value);
        showDeleteModal.value = false;
        chatToDelete.value = null;
    }
}

// 重命名聊天
function renameChat(chatId: string) {
    const chat = props.chats[chatId];
    chatToRename.value = chatId;
    newChatTitle.value = chat.title;
    showRenameModal.value = true;
}

// 确认重命名聊天
function confirmRenameChat() {
    if (chatToRename.value && newChatTitle.value.trim() !== '') {
        emit('rename-chat', chatToRename.value, newChatTitle.value.trim());
        showRenameModal.value = false;
        chatToRename.value = null;
        newChatTitle.value = '';
    }
}
</script>

<style scoped>
.sidebar {
    width: 260px;
    background-color: var(--background-tertiary);
    padding: 20px;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border-color);
    transition: transform 0.3s ease;
}

.logo {
    display: flex;
    align-items: center;
    font-size: 22px;
    font-weight: bold;
    margin-bottom: 24px;
    color: var(--primary-color);
}

.logo i {
    margin-right: 10px;
    font-size: 24px;
}

.new-chat-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--primary-color);
    color: white;
    border: none;
    padding: 12px;
    border-radius: var(--border-radius);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    margin-bottom: 20px;
    transition: background-color 0.2s, transform 0.1s;
}

.new-chat-btn:hover {
    background-color: var(--secondary-color);
    transform: translateY(-2px);
}

.new-chat-btn i {
    margin-right: 8px;
}

.history-container {
    flex: 1;
    overflow-y: auto;
    margin-bottom: 20px;
}

.history-container h3 {
    font-size: 14px;
    color: var(--text-secondary);
    margin-bottom: 10px;
    padding-left: 5px;
}

.chat-history {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.chat-history-item {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: background-color 0.2s;
    font-size: 14px;
    position: relative;
}

.chat-history-item:hover {
    background-color: var(--background-secondary);
}

.chat-history-item.active {
    background-color: rgba(33, 150, 243, 0.1);
    font-weight: 500;
}

.chat-history-item i {
    margin-right: 10px;
    color: var(--text-secondary);
    font-size: 14px;
}

.chat-history-item span {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.chat-options {
    display: none;
    position: absolute;
    right: 10px;
    gap: 5px;
    background: var(--background-primary);
}

.chat-history-item:hover .chat-options {
    display: flex;
}

.chat-option-button {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 2px 5px;
    border-radius: 4px;
    transition: background-color 0.2s;
}

.chat-option-button:hover {
    transform: scale(1.1);
}

.settings {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.settings button {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    color: var(--text-secondary);
    padding: 10px;
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: background-color 0.2s;
    font-size: 14px;
}

.settings button:hover {
    background-color: var(--background-secondary);
}

.settings button i {
    margin-right: 10px;
    width: 16px;
    text-align: center;
}

/* 重命名输入框样式 */
.rename-input-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.rename-input {
    padding: 10px;
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
    background-color: var(--background-secondary);
    color: var(--text-primary);
    font-size: 14px;
    width: 100%;
}

.rename-input:focus {
    outline: none;
    border-color: var(--primary-color);
}

/* 模态框按钮样式 */
.modal-button {
    padding: 8px 16px;
    border-radius: var(--border-radius);
    border: none;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
    margin-left: 10px;
}

.modal-button.cancel {
    background-color: var(--background-secondary);
    color: var(--text-primary);
}

.modal-button.confirm {
    background-color: var(--primary-color);
    color: white;
}

.modal-button.cancel:hover {
    background-color: var(--background-tertiary);
}

.modal-button.confirm:hover {
    background-color: var(--secondary-color);
}

@media (max-width: 768px) {
    .sidebar {
        position: fixed;
        top: 0;
        left: 0;
        height: 100vh;
        z-index: 1000;
        transform: translateX(-100%);
    }

    .sidebar.active {
        transform: translateX(0);
    }
}
</style>