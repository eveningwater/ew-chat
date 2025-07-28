<template>
    <div class="chat-container">
        <!-- 聊天头部 -->
        <div class="chat-header">
            <div class="current-chat-title">
                {{ currentChat?.title || translations.newConversation }}
            </div>
            <div class="header-actions">
                <button v-if="!isTyping" @click="$emit('regenerate-response')" :title="translations.regenerateResponse">
                    <i class="fas fa-sync"></i>
                </button>
                <button v-if="isTyping" @click="$emit('stop-response')" :title="translations.stopResponse">
                    <i class="fas fa-stop"></i>
                </button>
                <button @click="$emit('export-chat')" :title="translations.exportChat">
                    <i class="fas fa-download"></i>
                </button>
                <button @click="toGithub">
                    <i class="fa-brands fa-github"></i>
                </button>
            </div>
        </div>

        <!-- 消息区域 -->
        <div class="messages" ref="messagesContainer">
            <!-- 欢迎消息 -->
            <div v-if="!currentChat || currentChat.messages.length === 0" class="intro-message">
                <h1>{{ translations.welcomeTitle }}</h1>
                <p>{{ translations.welcomeMessage }}</p>
                <div class="suggestion-chips">
                    <button v-for="suggestion in suggestions" :key="suggestion" class="suggestion-chip"
                        @click="handleSuggestion(suggestion)">
                        {{ suggestion }}
                    </button>
                </div>
            </div>

            <!-- 聊天消息 -->
            <template v-else>
                <div v-for="message in currentChat.messages" :key="message.id" class="message" :class="message.role">
                    <div class="message-content">
                        <!-- 文件消息 -->
                        <template v-if="message.file">
                            <div v-if="message.file.type.startsWith('image/')">
                                <img :src="message.file.content" :alt="message.file.name" style="max-width: 100%;" />
                            </div>
                            <pre v-else-if="message.file.type.startsWith('text/') || message.file.type === 'application/json'"
                                style="white-space: pre-wrap;">
                {{ message.file.content }}
              </pre>
                            <div v-else>{{ translations.uploadedFile }}{{ message.file.name }}</div>
                        </template>

                        <!-- 文本消息 -->
                        <template v-else>
                            <!-- 用户消息 -->
                            <template v-if="message.role === 'user'">
                                {{ message.content }}
                            </template>

                            <!-- AI消息 -->
                            <div v-else>
                                <!-- 正在流式接收的消息 -->
                                <template
                                    v-if="props.streamingMessageId && message.id === props.streamingMessageId && message.role === 'assistant'">
                                    <div v-html="getStableRendering(props.streamingContent)"></div>
                                </template>
                                <!-- 已完成的消息 -->
                                <template v-else>
                                    <div v-html="renderMarkdown(message.content)"></div>
                                </template>
                            </div>
                        </template>
                    </div>
                </div>
            </template>

            <!-- 打字指示器 -->
            <div v-if="isTyping && !props.streamingMessageId" class="message ai">
                <div class="message-content">
                    <div class="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        </div>

        <!-- 输入区域 -->
        <div class="input-area">
            <div class="input-container">
                <button class="file-upload-button" @click="triggerFileUpload" title="上传文件">
                    <i class="fas fa-paperclip"></i>
                </button>
                <input type="file" ref="fileInput" style="display: none" @change="handleFileChange" />
                <textarea ref="userInput" v-model="inputMessage" :placeholder="translations.typePlaceholder" rows="1"
                    @input="handleTextareaInput" @keydown.enter.prevent="handleEnterKey"></textarea>
                <button class="send-button" @click="sendMessage" title="发送消息">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>

            <!-- 文件预览 -->
            <div v-if="pendingFile" class="pending-file-preview">
                <div class="file-preview-content">
                    <span>{{ pendingFile.name }}</span>
                    <button @click="clearPendingFile">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <div class="disclaimer">
                {{ translations.disclaimer }}
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import type { Chat } from '../types';
import { openNewWindow } from '../utils';
import { renderMarkdown, configureMarked, getStableRendering } from '../utils/markdown';
import { scrollToBottom, autoResizeTextarea } from '../utils/dom';

const props = defineProps<{
    currentChat: Chat | null;
    isTyping: boolean;
    translations: Record<string, string>;
    isDarkMode: boolean;
    streamingMessageId: string | null;
    streamingContent: string;
}>();

const emit = defineEmits<{
    'send-message': [content: string, file?: File];
    'regenerate-response': [];
    'stop-response': [];
    'export-chat': [];
    'upload-file': [file: File];
}>();

// 响应式状态
const inputMessage = ref<string>('');
const pendingFile = ref<File | null>(null);
const messagesContainer = ref<HTMLElement | null>(null);
const userInput = ref<HTMLTextAreaElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

// 建议消息
const suggestions = computed(() => [
    props.translations.suggestionTellStory,
    props.translations.suggestionQuantum,
    props.translations.suggestionPoem,
    props.translations.suggestionJavaScript
]);

// 处理Enter键
function handleEnterKey(e: KeyboardEvent) {
    if (!e.shiftKey) {
        sendMessage();
    }
}

// 发送消息
function sendMessage() {
    const message = inputMessage.value.trim();
    if (!message && !pendingFile.value) return;

    emit('send-message', message, pendingFile.value || undefined);
    inputMessage.value = '';
    pendingFile.value = null;

    // 重置文本框高度
    if (userInput.value) {
        userInput.value.style.height = 'auto';
    }
}

// 处理建议点击
function handleSuggestion(suggestion: string) {
    inputMessage.value = suggestion;
    sendMessage();
}

// 处理文本框输入
function handleTextareaInput() {
    autoResizeTextarea(userInput.value);
}

// 触发文件上传
function triggerFileUpload() {
    if (fileInput.value) {
        fileInput.value.click();
    }
}

// 处理文件选择
function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
        pendingFile.value = input.files[0];
    }
}

// 清除待发送文件
function clearPendingFile() {
    pendingFile.value = null;
    if (fileInput.value) {
        fileInput.value.value = '';
    }
}

function toGithub() {
    openNewWindow('https://github.com/eveningwater/ew-chat');
}
// 监听消息变化，自动滚动到底部
watch(
    () => props.currentChat?.messages.length,
    () => {
        nextTick(() => {
            scrollToBottom(messagesContainer.value);
        });
    }
);

// 监听流式内容变化，自动滚动到底部
watch(
    () => props.streamingContent,
    () => {
        nextTick(() => {
            scrollToBottom(messagesContainer.value);
        });
    }
);

// 监听打字状态变化，自动滚动到底部
watch(
    () => props.isTyping,
    () => {
        nextTick(() => {
            scrollToBottom(messagesContainer.value);
        });
    }
);

// 组件挂载后初始化
onMounted(() => {
    // 配置marked和highlight.js
    configureMarked();

    // 初始滚动到底部
    scrollToBottom(messagesContainer.value);
});
</script>

<style scoped>
.chat-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}

.chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    border-bottom: 1px solid var(--border-color);
    background-color: var(--background-primary);
}

.current-chat-title {
    font-weight: 600;
    font-size: 16px;
    color: var(--text-primary);
}

.header-actions {
    display: flex;
    gap: 10px;
}

.header-actions button {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
}

.header-actions button:hover {
    background-color: var(--background-tertiary);
    color: var(--primary-color);
}

.messages {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    background-color: var(--background-secondary);
}

.intro-message {
    text-align: center;
    max-width: 600px;
    margin: auto;
    padding: 40px 20px;
}

.intro-message h1 {
    font-size: 24px;
    margin-bottom: 10px;
    color: var(--text-primary);
}

.intro-message p {
    color: var(--text-secondary);
    margin-bottom: 20px;
}

.suggestion-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
}

.suggestion-chip {
    background-color: var(--background-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    padding: 8px 16px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--text-primary);
}

.suggestion-chip:hover {
    background-color: var(--primary-color);
    color: white;
    transform: translateY(-2px);
}

.message {
    display: flex;
    max-width: 80%;
    border-radius: var(--border-radius);
    padding: 12px 16px;
    animation: fadeIn 0.3s ease;
}

.message.user {
    align-self: flex-end;
    background-color: var(--user-message-bg);
    color: var(--user-message-text);
}

.message.assistant {
    align-self: flex-start;
    background-color: var(--ai-message-bg);
    color: var(--text-primary);
}

.message-content {
    word-break: break-word;
    line-height: 1.5;
}

.message-content :deep(pre) {
    margin: 10px 0;
    border-radius: 8px;
    overflow: auto;
}

.message-content :deep(code) {
    font-family: 'Fira Code', monospace;
    font-size: 14px;
}

.message-content :deep(a) {
    color: var(--primary-color);
    text-decoration: none;
    border-bottom: 1px solid var(--primary-color);
    transition: opacity 0.2s;
}

.message-content :deep(a:hover) {
    opacity: 0.8;
}

.message-content :deep(ul),
.message-content :deep(ol) {
    padding-left: 20px;
    margin: 10px 0;
}

.message-content :deep(li) {
    margin-bottom: 5px;
}

.message-content :deep(blockquote) {
    border-left: 4px solid var(--border-color);
    padding-left: 15px;
    margin: 10px 0;
    color: var(--text-secondary);
}

.message-content :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 15px 0;
}

.message-content :deep(th),
.message-content :deep(td) {
    border: 1px solid var(--border-color);
    padding: 8px 12px;
    text-align: left;
}

.message-content :deep(th) {
    background-color: var(--background-tertiary);
}

.message-content :deep(.code-block) {
    margin: 15px 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border-color);
}

.message-content :deep(.code-block pre) {
    margin: 0;
    padding: 16px;
    background-color: var(--background-tertiary);
}

.message-content :deep(.code-block code) {
    font-family: 'Fira Code', monospace;
    font-size: 14px;
    line-height: 1.6;
}

.message-content :deep(.code-header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background-color: #2d2d3d;
    color: #e0e0e0;
}

.message-content :deep(.code-language) {
    font-size: 12px;
    text-transform: uppercase;
}

.message-content :deep(.code-copy-button) {
    background: none;
    border: none;
    color: #aaa;
    cursor: pointer;
    transition: color 0.2s;
}

.message-content :deep(.code-copy-button:hover) {
    color: white;
}

.typing-indicator {
    display: flex;
    align-items: center;
    gap: 5px;
}

.typing-indicator span {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--typing-indicator-color);
    animation: typing 1.4s infinite both;
}

.typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
}

.input-area {
    padding: 15px 20px;
    border-top: 1px solid var(--border-color);
    background-color: var(--background-primary);
}

.input-container {
    display: flex;
    align-items: flex-end;
    background-color: var(--background-tertiary);
    border-radius: var(--border-radius);
    padding: 10px 15px;
    gap: 10px;
}

.file-upload-button,
.send-button {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 18px;
    padding: 5px;
    transition: color 0.2s;
}

.file-upload-button:hover,
.send-button:hover {
    color: var(--primary-color);
}

textarea {
    flex: 1;
    border: none;
    background: none;
    resize: none;
    padding: 5px 0;
    max-height: 150px;
    color: var(--text-primary);
    font-size: 14px;
    line-height: 1.5;
    outline: none;
}

.pending-file-preview {
    margin-top: 10px;
    padding: 8px 12px;
    background-color: var(--background-tertiary);
    border-radius: var(--border-radius);
    font-size: 14px;
}

.file-preview-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.file-preview-content button {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
}

.disclaimer {
    margin-top: 10px;
    font-size: 12px;
    color: var(--text-secondary);
    text-align: center;
}

@keyframes typing {

    0%,
    100% {
        transform: translateY(0);
        opacity: 0.5;
    }

    50% {
        transform: translateY(-5px);
        opacity: 1;
    }
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@media (max-width: 768px) {
    .message {
        max-width: 100%;
    }

    .message-content {
        width: 100%;
    }
}
</style>