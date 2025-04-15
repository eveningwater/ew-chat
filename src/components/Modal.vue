<template>
    <div class="modal-overlay" @click="$emit('close')">
        <div class="modal-container" @click.stop>
            <div class="modal-header">
                <slot name="header"></slot>
                <button class="modal-close" @click="$emit('close')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <slot name="body"></slot>
            </div>
            <div class="modal-footer">
                <slot name="footer">
                    <button class="modal-button" @click="$emit('close')">关闭</button>
                </slot>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
defineEmits<{
    'close': [];
}>();
</script>

<style>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    animation: fadeIn 0.3s ease;
}

.modal-container {
    background-color: var(--background-primary);
    border-radius: var(--border-radius);
    box-shadow: 0 5px 15px var(--shadow-color);
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    animation: slideIn 0.3s ease;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    border-bottom: 1px solid var(--border-color);
}

.modal-close {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 18px;
    cursor: pointer;
    transition: color 0.2s;
}

.modal-close:hover {
    color: var(--primary-color);
}

.modal-body {
    padding: 20px;
    color: var(--text-primary);
    line-height: 1.5;
}

.modal-footer {
    padding: 15px 20px;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
}

.modal-button {
    background-color: var(--primary-color);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: background-color 0.2s;
}

.modal-button.cancel {
    background-color: var(--background-secondary);
    color: var(--text-primary);
}

.modal-button.cancel:hover {
    background-color: var(--background-tertiary);
    color: var(--text-secondary);
}

.modal-button+.modal-button {
    margin-left: 10px;
}

.modal-button:hover {
    background-color: var(--secondary-color);
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes slideIn {
    from {
        transform: translateY(-50px);
        opacity: 0;
    }

    to {
        transform: translateY(0);
        opacity: 1;
    }
}
</style>