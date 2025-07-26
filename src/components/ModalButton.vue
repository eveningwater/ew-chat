<template>
    <button 
        :class="['modal-button', variant]" 
        @click="$emit('click')"
        :disabled="disabled"
    >
        <slot></slot>
    </button>
</template>

<script lang="ts" setup>
defineProps<{
    variant?: 'default' | 'cancel' | 'confirm';
    disabled?: boolean;
}>();

defineEmits<{
    'click': [];
}>();
</script>

<style scoped>
.modal-button {
    padding: 8px 16px;
    border-radius: var(--border-radius);
    border: none;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
    margin-left: 10px;
}

.modal-button:first-child {
    margin-left: 0;
}

.modal-button.default {
    background-color: var(--primary-color);
    color: white;
}

.modal-button.cancel {
    background-color: var(--background-secondary);
    color: var(--text-primary);
}

.modal-button.confirm {
    background-color: var(--primary-color);
    color: white;
}

.modal-button.default:hover {
    background-color: var(--secondary-color);
}

.modal-button.cancel:hover {
    background-color: var(--background-tertiary);
}

.modal-button.confirm:hover {
    background-color: var(--secondary-color);
}

.modal-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
</style> 