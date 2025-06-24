<template>
  <el-container class="chat-page">
    <el-aside :width="sidebarWidth" class="chat-aside">
      <chat-list @toggle-sidebar="handleToggleSidebar" ref="chatListRef" />
    </el-aside>
    <el-container class="main-container">
      <el-main class="chat-main">
        <message-list :messages="messages" />
      </el-main>
      <el-footer class="chat-footer">
        <div class="input-container">
          <chat-input @send="handleSendMessage" :disabled="chatStore.isSending">
            <template #left>
              <model-select />
            </template>
          </chat-input>
          <div class="mode-switch">
            <el-switch
              v-model="useSSEMode"
              @change="handleModeChange"
              active-text="流式"
              inactive-text="普通"
              size="small"
            />
          </div>
        </div>
        <div v-if="chatStore.isSending" class="sending-controls">
          <el-button @click="stopSending" type="danger" size="small">
            <el-icon><Close /></el-icon>
            停止生成
          </el-button>
        </div>
      </el-footer>
    </el-container>
  </el-container>
</template>

<script>
import { ref, watch, onUnmounted } from 'vue';
import ChatInput from '@/components/Chat/ChatInput.vue';
import MessageList from '@/components/Chat/MessageList.vue';
import ChatList from '@/components/Chat/ChatList.vue';
import { useChatStore } from '@/store/chat';
import { Close } from '@element-plus/icons-vue';
import ModelSelect from "@/components/Chat/ModelSelect.vue";

export default {
  components: {
    ChatInput,
    MessageList,
    Close,
    ModelSelect,
    ChatList,
  },
  setup() {
    const chatStore = useChatStore();
    const messages = ref(chatStore.messages);
    const useSSEMode = ref(chatStore.useSSE);
    const sidebarWidth = ref('390px'); // 将初始宽度设置为 400px
    const chatListRef = ref(null);
    
    // SSE连接管理
    let currentEventSource = null;

    // 监听 chatStore 的 messages 变化
    watch(() => chatStore.messages, (newMessages) => {
      messages.value = newMessages;
    });
    
    // 监听 chatStore 的 useSSE 变化
    watch(() => chatStore.useSSE, (newValue) => {
      useSSEMode.value = newValue;
    });

    // 创建SSE连接
    const createSSEConnection = (userId) => {
      const url = `http://127.0.0.1:8080/sse/connect?userId=${userId}`;
      console.log('🔗 Chat组件创建SSE连接，URL:', url);
      
      try {
        const eventSource = new EventSource(url);
        console.log('✅ EventSource对象在Chat组件中创建成功');
        
        // 基础事件监听
        eventSource.onopen = function(event) {
          console.log('🎉 SSE连接在Chat组件中打开成功!');
          console.log('连接状态:', eventSource.readyState);
        };
        
        eventSource.onerror = function(event) {
          console.error('🚨 Chat组件SSE连接错误:', {
            readyState: eventSource.readyState,
            url: eventSource.url,
            error: event
          });
        };
        
        return eventSource;
      } catch (error) {
        console.error('❌ Chat组件创建EventSource失败:', error);
        throw error;
      }
    };

    const handleSendMessage = async (message, useWebSearch = false) => {
      const chatId = chatStore.chatId;
      const language = 0;
      const msg = message;

      const messagePayload = {
        chatId,
        language,
        msg,
        useWebSearch, // 添加联网搜索参数
      };

      console.log('发送消息，当前SSE模式:', chatStore.useSSE, '联网搜索:', useWebSearch);
      
      // 如果使用SSE模式，在这里创建EventSource
      if (chatStore.useSSE) {
        try {
          // 关闭之前的连接
          if (currentEventSource) {
            currentEventSource.close();
          }
          
          // 创建新的SSE连接
          currentEventSource = createSSEConnection(chatStore.uuid);
          
          // 将EventSource传递给store
          await chatStore.sendMessageToChatGPTWithSSE(messagePayload, currentEventSource);
        } catch (error) {
          console.error('SSE发送失败:', error);
          // 降级到普通模式
          chatStore.toggleSSEMode(false);
          await chatStore.sendMessageToChatGPT(messagePayload);
        }
      } else {
        await chatStore.sendMessageToChatGPT(messagePayload);
      }
    };
    
    // 处理模式切换
    const handleModeChange = (value) => {
      console.log('切换SSE模式为:', value);
      chatStore.toggleSSEMode(value);
    };
    
    // 停止发送
    const stopSending = () => {
      console.log('🛑 用户点击停止按钮');
      
      // SSE模式：关闭EventSource连接
      if (currentEventSource) {
        console.log('关闭Chat组件的SSE连接...');
        currentEventSource.close();
        currentEventSource = null;
      }
      
      // 通用：调用store的停止方法（会处理AbortController和状态重置）
      chatStore.stopCurrentSSE();
      
      // 强制更新UI以确保按钮状态正确
      console.log('停止后isSending状态:', chatStore.isSending);
    };
    
    // 组件卸载时清理连接
    onUnmounted(() => {
      if (currentEventSource) {
        console.log('Chat组件卸载，关闭SSE连接');
        currentEventSource.close();
        currentEventSource = null;
      }
    });

    // 处理侧边栏折叠/展开
    const handleToggleSidebar = (isHidden) => {
      sidebarWidth.value = isHidden ? '50px' : '400px'; // 将展开宽度设置为 400px
    };

    return { 
      messages, 
      handleSendMessage, 
      chatStore,
      useSSEMode,
      handleModeChange,
      stopSending,
      sidebarWidth,
      chatListRef,
      handleToggleSidebar
    };
  },
};
</script>

<style scoped>
.chat-page {
  display: flex;
  height: 100vh;
  overflow: hidden; /* 防止整体出现滚动条 */
}

.chat-aside {
  border-right: 1px solid #dcdfe6;
  background-color: #fff;
  transition: width 0.3s;
  overflow: hidden; /* 防止侧边栏出现横向滚动条 */
}

.main-container {
  position: relative;
  overflow: hidden; /* 防止主容器出现横向滚动条 */
  width: 100%; /* 确保容器占满可用空间 */
}

.chat-main {
  flex: 1;
  padding: 20px 0;
  overflow-x: hidden; /* 禁止横向滚动 */
  overflow-y: auto; /* 允许纵向滚动 */
  height: calc(100vh - 120px); /* 减去头部和底部的高度 */
}

.chat-footer {
  position: absolute;
  bottom: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: #fff;
  padding: 20px 0;
  border-top: 1px solid #f0f0f0;
}

.input-container {
  display: flex;
  align-items: center;
  gap: 15px;
  width: 100%;
  max-width: 800px;
}

.mode-switch {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.sending-controls {
  margin-top: 10px;
}
</style>
