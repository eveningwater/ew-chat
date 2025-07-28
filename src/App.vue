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
                :isDarkMode="isDarkMode" :streamingMessageId="streamingMessageId" :streamingContent="streamingContent"
                @send-message="sendMessage" @regenerate-response="regenerateLastResponse"
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
                <ModalButton variant="cancel" @click="showModal = false">{{ translations[currentLanguage].cancel
                }}</ModalButton>
                <ModalButton variant="confirm" @click="handleModalConfirm">{{
                    translations[currentLanguage].confirm }}</ModalButton>
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
import { configureMarked } from './utils/markdown';

// 导入组件
import Sidebar from './views/Sidebar.vue';
import ChatWindow from './views/ChatWindow.vue';
import Modal from './components/Modal.vue';
import ModalButton from './components/ModalButton.vue';

// 导入类型和配置
import type { Chat, Message, Language, AppState } from './types/index';
import { API_KEY, MODEL } from './config';
import { translations } from './const';

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
const streamingMessageId = ref<string | null>(null); // 新增：跟踪正在流式接收的消息ID
const streamingContent = ref<string>(''); // 新增：当前流式接收的内容

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

        // 创建assistant消息ID，但不立即添加到消息列表
        const assistantMessageId = uuidv4();
        streamingMessageId.value = assistantMessageId;
        streamingContent.value = '';

        // 获取AI响应（流式）
        await getAIResponse(chatId, assistantMessageId);

    } catch (error: any) {
        ewMessage.error(`${translations[currentLanguage.value].errorMessage}${error.message}`);
    } finally {
        isTyping.value = false;
        streamingMessageId.value = null;
        streamingContent.value = '';
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
async function getAIResponse(chatId: string, assistantMessageId: string): Promise<void> {
    try {
        // 创建空的assistant消息用于流式更新
        const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
        };

        // 添加到消息列表
        chats.value[chatId].messages.push(assistantMessage);
        saveToStore();

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: chats.value[chatId].messages.slice(0, -1).map(msg => ({
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
        let typingBuffer = '';
        let accumulatedText = '';
        let isProcessingBuffer = false;
        const typingSpeed = 2; // 打字速度（毫秒/字符）

        // 处理打字缓冲区的函数
        function processBuffer() {
            if (typingBuffer.length > 0 && !stopGeneration.value) {
                accumulatedText += typingBuffer[0];
                typingBuffer = typingBuffer.slice(1);
                
                // 更新流式内容
                streamingContent.value = accumulatedText;
                
                // 更新消息内容
                const messageIndex = chats.value[chatId].messages.findIndex(
                    msg => msg.id === assistantMessageId
                );
                if (messageIndex !== -1) {
                    chats.value[chatId].messages[messageIndex].content = accumulatedText;
                    saveToStore();
                }
                
                setTimeout(processBuffer, typingSpeed);
            } else {
                isProcessingBuffer = false;
            }
        }

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
                                typingBuffer += text;
                                if (!isProcessingBuffer) {
                                    isProcessingBuffer = true;
                                    processBuffer();
                                }
                            }
                        }
                    } catch (e) {
                        // 忽略JSON解析错误
                    }
                }
            }
        }

        // 等待打字缓冲区完全处理完毕
        while (isProcessingBuffer) {
            await new Promise((resolve) => setTimeout(resolve, typingSpeed));
        }
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

        // 创建assistant消息ID，但不立即添加到消息列表
        const assistantMessageId = uuidv4();
        streamingMessageId.value = assistantMessageId;
        streamingContent.value = '';

        // 获取新的AI响应（流式）
        await getAIResponse(chatId, assistantMessageId);

    } catch (error: any) {
        ewMessage.error(`${translations[currentLanguage.value].errorMessage}${error.message}`);
    } finally {
        isTyping.value = false;
        streamingMessageId.value = null;
        streamingContent.value = '';
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
        ewMessage.success(translations[currentLanguage.value].clearSuccessAllHistory);
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
    ewMessage.success(translations[currentLanguage.value].deleteSuccessText);
}

// 重命名聊天
function renameChat(chatId: string, newTitle: string) {
    if (chats.value[chatId]) {
        chats.value[chatId].title = newTitle;
        saveToStore();
        ewMessage.success(translations[currentLanguage.value].renameSuccessText);
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
    configureMarked();

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