// 滚动到容器底部
export function scrollToBottom(container: HTMLElement | null): void {
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// 自动调整文本框高度
export function autoResizeTextarea(textarea: HTMLTextAreaElement | null): void {
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
} 