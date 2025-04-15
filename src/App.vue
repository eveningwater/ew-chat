<template>
    <div class="container" :class="{ 'dark-mode': isDarkMode }">
        <div class="app-container">
            <!-- 移动端菜单按钮 -->
            <div class="mobile-menu-button" :class="{ 'active': isSidebarActive }" @click="toggleSidebar">
                <i class="fas fa-bars"></i>
            </div>

            <!-- 侧边栏组件 -->
            <Sidebar :isActive="isSidebarActive" :chats="chats" :currentChatId="currentChatId"
                :translations="translations[currentLanguage]" @new-chat="createNewChat" @load-chat="loadChat"
                @clear-history="clearAllHistory" @toggle-theme="toggleTheme" @toggle-language="toggleLanguage"
                @delete-chat="deleteChat" @rename-chat="renameChat" />

            <!-- 聊天窗口组件 -->
            <ChatWindow :currentChat="currentChat" :isTyping="isTyping" :translations="translations[currentLanguage]"
                :isDarkMode="isDarkMode" @send-message="sendMessage" @regenerate-response="regenerateLastResponse"
                @stop-response="stopResponse" @export-chat="exportCurrentChat" @upload-file="handleFileUpload" />
        </div>

        <!-- 模态框组件 -->
        <Modal v-if="showModal" @close="showModal = false">
            <template #header>
                <h3>{{ modalTitle }}</h3>
            </template>
            <template #body>
                <div>{{ modalContent }}</div>
            </template>
            <template #footer>
                <button class="modal-button cancel" @click="showModal = false">{{ translations[currentLanguage].cancel
                    }}</button>
                <button class="modal-button confirm" @click="handleModalConfirm">{{
                    translations[currentLanguage].confirm }}</button>
            </template>
        </Modal>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useStorage } from 'ew-responsive-store';
import ewMessage from 'ew-message';
import 'ew-message/dist/ew-message.min.css';
import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';
import hljs from 'highlight.js';

// 导入组件
import Sidebar from './components/Sidebar.vue';
import ChatWindow from './components/ChatWindow.vue';
import Modal from './components/Modal.vue';

// 导入类型和配置
import type { Chat, Message, Language, Translations, AppState } from './types/index';
import { API_KEY, MODEL } from './config';

// 创建响应式存储
const store = useStorage<Partial<AppState>>('ew-chat-storage', {
    chats: {},
    currentChatId: null,
    theme: 'light',
    language: 'en'
});

// 响应式状态
const chats = ref<Record<string, Chat>>(store.value.chats || {});
const currentChatId = ref<string | null>(store.value.currentChatId || null);
const isDarkMode = ref<boolean>(store.value.theme === 'dark');
const currentLanguage = ref<Language>(store.value.language || 'en');
const isTyping = ref<boolean>(false);
const isSidebarActive = ref<boolean>(false);
const stopGeneration = ref<boolean>(false);
const pendingFile = ref<File | null>(null);

// 模态框状态
const showModal = ref<boolean>(false);
const modalTitle = ref<string>('');
const modalContent = ref<string>('');
const modalConfirmAction = ref<(() => void) | null>(null);

// 处理模态框确认
function handleModalConfirm() {
    if (modalConfirmAction.value) {
        modalConfirmAction.value();
    }
}

// 计算属性
const currentChat = computed<Chat | null>(() => {
    return currentChatId.value ? chats.value[currentChatId.value] : null;
});

// 翻译字典
const translations: Translations = {
    en: {
        newChat: "New Chat",
        clearHistory: "Clear History",
        darkMode: "Dark Mode",
        lightMode: "Light Mode",
        welcomeTitle: "Welcome to ewChat AI",
        welcomeMessage: "Ask me anything. I'm powered by deepseek-r1.",
        suggestionTellStory: "Tell me a story",
        suggestionQuantum: "Explain quantum computing",
        suggestionPoem: "Write a poem",
        suggestionJavaScript: "Help me learn JavaScript",
        newConversation: "New Conversation",
        waitMessage: "Please wait until the current response is completed.",
        errorMessage: "Sorry, I encountered an error: ",
        typePlaceholder: "Type your message here...",
        disclaimer: "ewChat may produce inaccurate information. Messages are stored locally.",
        chatHistory: "Chat History",
        confirmClearAllHistory: "Are you sure you want to clear all history?",
        uploadedFile: "Uploaded file: ",
        deleteText: "Delete",
        renameText: "Rename",
        confirmDelete: "Are you sure you want to delete this chat?",
        language: "English",
        cancel: "Cancel",
        confirm: "Sure",
        newChatTitle: "New Chat Title",
    },
    zh: {
        newChat: "新对话",
        clearHistory: "清除历史",
        darkMode: "深色模式",
        lightMode: "浅色模式",
        welcomeTitle: "欢迎使用 ewChat AI",
        welcomeMessage: "有问题尽管问我。我由deepseek-r1提供支持。",
        suggestionTellStory: "讲个故事",
        suggestionQuantum: "解释量子计算",
        suggestionPoem: "写一首诗",
        suggestionJavaScript: "帮我学习JavaScript",
        newConversation: "新对话",
        waitMessage: "请等待当前回复完成。",
        errorMessage: "抱歉，我遇到了一个错误：",
        typePlaceholder: "在此输入您的消息...",
        disclaimer: "ewChat 可能会产生不准确的信息，消息存储在本地。",
        chatHistory: "聊天历史",
        uploadedFile: "上传的文件：",
        deleteText: "删除",
        renameText: "重命名",
        confirmDelete: "确定要删除这个聊天吗？",
        confirmClearAllHistory: "确定要清除历史吗？",
        newChatTitle: "新的聊天标题",
        cancel: "取消",
        confirm: "确认",
        language: "中文",
    },
};


// 创建新聊天
function createNewChat() {
    const newChatId = uuidv4();
    const newChat: Chat = {
        id: newChatId,
        title: translations[currentLanguage.value].newConversation,
        messages: [],
        timestamp: Date.now(),
    };

    chats.value = { ...chats.value, [newChatId]: newChat };
    currentChatId.value = newChatId;
    saveToStore();
}

// 加载聊天
function loadChat(chatId: string) {
    if (isTyping.value) {
        ewMessage.warning(translations[currentLanguage.value].waitMessage);
        return;
    }
    currentChatId.value = chatId;
    isSidebarActive.value = false;
    saveToStore();
}

// 发送消息
async function sendMessage(content: string, file?: File) {
    if (isTyping.value) {
        ewMessage.warning(translations[currentLanguage.value].waitMessage);
        return;
    }

    if (!content && !file) return;

    // 确保有当前聊天
    if (!currentChatId.value) {
        createNewChat();
    }

    const chatId = currentChatId.value as string;

    // 添加用户消息
    if (content) {
        const userMessage: Message = {
            id: uuidv4(),
            role: 'user',
            content,
            timestamp: Date.now(),
        };

        chats.value[chatId].messages.push(userMessage);

        // 如果是第一条消息，更新聊天标题
        if (chats.value[chatId].messages.length === 1) {
            const title = content.split(' ').slice(0, 4).join(' ') +
                (content.split(' ').length > 4 ? '...' : '');
            chats.value[chatId].title = title;
        }
    }

    // 处理文件上传
    if (file) {
        await processFile(file, chatId);
    }

    saveToStore();

    try {
        isTyping.value = true;
        stopGeneration.value = false;

        // 获取AI响应
        const response = await getAIResponse(chatId);

        // 保存AI响应
        const assistantMessage: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: response,
            timestamp: Date.now(),
        };

        chats.value[chatId].messages.push(assistantMessage);
        saveToStore();

    } catch (error: any) {
        ewMessage.error(`${translations[currentLanguage.value].errorMessage}${error.message}`);
    } finally {
        isTyping.value = false;
    }
}

// 处理文件上传
async function processFile(file: File, chatId: string): Promise<void> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;

            // 创建文件消息
            const fileMessage: Message = {
                id: uuidv4(),
                role: 'user',
                content: `${translations[currentLanguage.value].uploadedFile}${file.name}`,
                timestamp: Date.now(),
                file: {
                    name: file.name,
                    type: file.type,
                    content: result
                }
            };

            chats.value[chatId].messages.push(fileMessage);
            pendingFile.value = null;
            resolve();
        };

        if (file.type.startsWith('image/')) {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    });
}

// 获取AI响应
async function getAIResponse(chatId: string): Promise<string> {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: chats.value[chatId].messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                stream: true
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to get response');
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done || stopGeneration.value) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice('data: '.length).trim();
                    if (jsonStr === '[DONE]') break;

                    try {
                        const obj = JSON.parse(jsonStr);
                        if (obj.choices && obj.choices[0] && obj.choices[0].delta) {
                            const delta = obj.choices[0].delta;
                            const text = (delta.content || '') + (delta.reasoning || '');
                            if (text) {
                                accumulatedText += text;
                                // 这里可以添加事件发射，通知UI更新
                            }
                        }
                    } catch (e) {
                        // 忽略JSON解析错误
                    }
                }
            }
        }

        return accumulatedText;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// 重新生成最后一个响应
async function regenerateLastResponse() {
    if (isTyping.value || !currentChatId.value) return;

    const chatId = currentChatId.value;
    const messages = chats.value[chatId].messages;

    if (messages.length === 0) return;

    // 如果最后一条消息是AI的，则删除它
    if (messages[messages.length - 1].role === 'assistant') {
        messages.pop();
    }

    // 如果没有用户消息，则不需要重新生成
    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') return;

    saveToStore();

    try {
        isTyping.value = true;
        stopGeneration.value = false;

        // 获取新的AI响应
        const response = await getAIResponse(chatId);

        // 保存新的AI响应
        const assistantMessage: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: response,
            timestamp: Date.now(),
        };

        chats.value[chatId].messages.push(assistantMessage);
        saveToStore();

    } catch (error: any) {
        ewMessage.error(`${translations[currentLanguage.value].errorMessage}${error.message}`);
    } finally {
        isTyping.value = false;
    }
}

// 停止响应生成
function stopResponse() {
    stopGeneration.value = true;
}

// 清除所有历史记录
function clearAllHistory() {
    if (isTyping.value) {
        ewMessage.warning(translations[currentLanguage.value].waitMessage);
        return;
    }

    showModal.value = true;
    modalTitle.value = translations[currentLanguage.value].clearHistory;
    modalContent.value = translations[currentLanguage.value].confirmClearAllHistory;
    modalConfirmAction.value = () => {
        chats.value = {};
        currentChatId.value = null;
        saveToStore();
        createNewChat();
        showModal.value = false;
        ewMessage.success(translations[currentLanguage.value].clearHistory + '已完成');
    };
}

// 导出当前聊天
async function exportCurrentChat() {
    if (!currentChat.value) return;

    // 生成Markdown格式的聊天记录
    let markdown = `# ${currentChat.value.title}\n\n`;

    for (const message of currentChat.value.messages) {
        const role = message.role === 'user' ? '👤 User' : '🤖 Assistant';
        markdown += `### ${role}\n\n${message.content}\n\n`;
    }

    // 创建Blob对象
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);

    // 创建下载链接
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentChat.value.title}.md`;
    document.body.appendChild(a);
    a.click();

    // 清理
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
// function exportCurrentChat() {
//     if (!currentChatId.value) return;

//     const chat = chats.value[currentChatId.value];
//     const exportData = {
//         title: chat.title,
//         messages: chat.messages.map(msg => ({
//             role: msg.role,
//             content: msg.content,
//             timestamp: new Date(msg.timestamp).toLocaleString()
//         }))
//     };

//     const jsonStr = JSON.stringify(exportData, null, 2);
//     const blob = new Blob([jsonStr], { type: 'application/json' });
//     const url = URL.createObjectURL(blob);

//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `${chat.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
//     URL.revokeObjectURL(url);
// }

// 切换主题
function toggleTheme() {
    isDarkMode.value = !isDarkMode.value;
    store.value.theme = isDarkMode.value ? 'dark' : 'light';
    document.body.classList.toggle('dark-mode', isDarkMode.value);
}

// 切换语言
function toggleLanguage() {
    currentLanguage.value = currentLanguage.value === 'en' ? 'zh' : 'en';
    store.value.language = currentLanguage.value;
}

// 删除聊天
function deleteChat(chatId: string) {
    if (isTyping.value) {
        ewMessage.warning(translations[currentLanguage.value].waitMessage);
        return;
    }

    // 删除聊天
    const { [chatId]: deletedChat, ...remainingChats } = chats.value;
    chats.value = remainingChats;

    // 如果删除的是当前聊天，则切换到最近的聊天或创建新聊天
    if (currentChatId.value === chatId) {
        const chatIds = Object.keys(chats.value);
        if (chatIds.length > 0) {
            currentChatId.value = chatIds.sort((a, b) => chats.value[b].timestamp - chats.value[a].timestamp)[0];
        } else {
            currentChatId.value = null;
            createNewChat();
        }
    }

    saveToStore();
    ewMessage.success('聊天已删除');
}

// 重命名聊天
function renameChat(chatId: string, newTitle: string) {
    if (chats.value[chatId]) {
        chats.value[chatId].title = newTitle;
        saveToStore();
        ewMessage.success('聊天已重命名');
    }
}

// 切换侧边栏（移动端）
function toggleSidebar() {
    isSidebarActive.value = !isSidebarActive.value;
}

// 处理文件上传
function handleFileUpload(file: File) {
    pendingFile.value = file;
    sendMessage('', file);
}

// 保存到存储
function saveToStore() {
    store.value.chats = chats.value;
    store.value.currentChatId = currentChatId.value;
}

// 初始化
onMounted(() => {
    marked.setOptions({
        highlight: function (code: string, lang: string) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true
    });

    // 应用主题
    document.body.classList.toggle('dark-mode', isDarkMode.value);

    // 如果没有聊天记录则创建新聊天
    if (Object.keys(chats.value).length === 0) {
        createNewChat();
    } else if (!currentChatId.value) {
        // 加载最近的聊天
        const mostRecentChatId = Object.keys(chats.value).sort((a, b) => {
            return chats.value[b].timestamp - chats.value[a].timestamp;
        })[0];

        if (mostRecentChatId) {
            currentChatId.value = mostRecentChatId;
        } else {
            createNewChat();
        }
    }
});

// 监听状态变化
watch([chats, currentChatId], () => {
    saveToStore();
}, { deep: true });
</script>

<style>
@import './style.css';

.container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--background-primary);
}

.app-container {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
}

.mobile-menu-button {
    display: none;
    position: fixed;
    top: 15px;
    left: 15px;
    z-index: 1000;
    background: none;
    border: none;
    color: var(--text-primary);
    font-size: 24px;
    cursor: pointer;
    padding: 8px;
    border-radius: 4px;
    background-color: var(--background-tertiary);
}

.mobile-menu-button.active {
    left: 260px;
}

.mobile-menu-button:hover {
    background-color: var(--background-secondary);
}

@media (max-width: 768px) {
    .mobile-menu-button {
        display: block;
    }

    .app-container::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s, visibility 0.3s;
    }

    .app-container.sidebar-active::before {
        opacity: 1;
        visibility: visible;
    }
}
</style>