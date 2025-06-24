<template>
  <div class="chat-input">
    <div class="left-slot">
      <slot name="left"></slot>
    </div>
    <div class="search-toggle">
      <el-popover
        placement="top"
        :width="100"
        trigger="click"
        popper-class="web-search-popover"
      >
        <template #reference>
          <div class="web-search-button" :class="{ 'active': useWebSearch }">
            <el-icon><Connection /></el-icon>
            <span>联网搜索</span>
            
            <el-icon class="arrow-icon"><ArrowDown /></el-icon>
          </div>
        </template>
        <div class="web-search-options">
          <div class="option" @click="toggleWebSearch(true)" :class="{ 'active': useWebSearch }">
            <span>开启</span>
          </div>
          <div class="option" @click="toggleWebSearch(false)" :class="{ 'active': !useWebSearch }">
            <span>关闭</span>
          </div>
        </div>
      </el-popover>
    </div>
    <div class="input-area"
         contenteditable="true"
         ref="messageInput"
         @input="updateMessage"
         @keyup.enter="sendMessage"
         :placeholder="isSending ? '正在发送...' : '输入消息...'">
    </div>
    <div class="send-icon" :class="isSending?'disabled':''" @click="sendMessage" :disabled="isSending">
      <el-icon><Promotion /></el-icon>
    </div>
  </div>
</template>

<script>
import { Promotion, Search, Connection, ArrowDown } from "@element-plus/icons-vue";

import { useChatStore } from '@/store/chat'; // 引入 chatStore
import { ref } from 'vue';

export default {
  components: {
    Promotion,
    Search,
    Connection,
    ArrowDown,
  },
  setup() {
    const useWebSearch = ref(false);
    return { useWebSearch, Search, Connection, ArrowDown };
  },
  data() {
    return {
      message: '',
    };
  },
  computed: {
    isSending() {
      return useChatStore().isSending; // 从 store 获取状态
    },
  },
  methods: {
    updateMessage(event) {
      this.message = event.target.innerText;
    },
    sendMessage() {
      if (this.message.trim() && !this.isSending) { // 判断是否正在发送
        // 发送消息时同时传递联网搜索状态
        this.$emit('send', this.message, this.useWebSearch);
        this.message = '';
        this.$refs.messageInput.innerText = '';
      }
    },
    toggleWebSearch(value) {
      this.useWebSearch = value;
    }
  },
};
</script>

<style scoped>
.chat-input {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px;
  border-radius: 24px; /* 整体圆角 */
  border: 1px solid #ddd;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  position: relative;
}

.left-slot {
  display: flex;
  align-items: center;
  margin-right: 10px;
}

.search-toggle {
  margin-right: 10px;
  display: flex;
  align-items: center;
}

.web-search-button {
  display: flex;
  align-items: center;
  background-color: #f0f2f5;
  border-radius: 16px;
  padding: 5px 12px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 14px;
}

.web-search-button.active {
  background-color: #409EFF;
  color: white;
}

.web-search-button .el-icon {
  margin-right: 4px;
}

.web-search-button .arrow-icon {
  margin-left: 4px;
  font-size: 12px;
}

.web-search-options {
  display: flex;
  flex-direction: column;
}

.web-search-options .option {
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.web-search-options .option:hover {
  background-color: #f5f7fa;
}

.web-search-options .option.active {
  color: #409EFF;
  font-weight: bold;
}

.input-area {
  flex: 1;
  padding: 10px 40px 10px 16px; /* 右边留出空间给图标 */
  border-radius: 24px;
  background-color: #ffffff;
  font-size: 16px;
  line-height: 1.5;
  min-height: 40px;
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  outline: none; /* 移除输入框默认的边框 */
}

.input-area[contenteditable]:empty:before {
  content: attr(placeholder);
  color: #aaa;
}

.send-icon {
  position: absolute;
  right: 10px;
  cursor: pointer;
  font-size: 24px;
  padding: 8px;
  background-color: #409EFF;
  border-radius: 50%;
  color: #fff;
  transition: background-color 0.3s ease, transform 0.2s ease;
}

.send-icon:hover {
  background-color: #66b1ff;
  transform: scale(1.1);
}

.send-icon.disabled {
  background-color: #ccc;
}
.send-icon.disabled:hover {
  background-color: #ccc;
  transform: scale(1);
}
.send-icon:active {
  background-color: #3a8ee6;
  transform: scale(1);
}

/* 自定义弹出框样式 */
:deep(.web-search-popover) {
  padding: 0;
  min-width: 100px;
}

@media (max-width: 768px) {
  .chat-input {
    padding: 8px;
  }

  .input-area {
    padding: 8px 32px 8px 12px;
    font-size: 14px;
  }

  .send-icon {
    font-size: 20px;
    right: 8px;
  }
}
</style>
