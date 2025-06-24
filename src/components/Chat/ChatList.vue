<template>
  <div class="sidebar-box" :class="isHidden.value ? 'sidebar-hidden' : 'sidebar-show'">
    <MenuBox :isHidden="isHidden" @toggle-sidebar="toggleSidebar" />
    <div class="sidebar" v-if="!isHidden.value">
      <div v-for="(group, date) in groupedChats" :key="date" class="chat-group">
        <div class="date-label">
          <span>{{ date }}</span>
          <el-divider></el-divider>
        </div>
        <div v-for="chat in group" :key="chat.chatId" 
          @click="selectMenu(chat.chatId)"
          :class="{ 'active': activeMenu === chat.chatId }" 
          class="sidebar-item">
          <div class="chat-title">
            <el-icon><ChatDotRound /></el-icon>
            <template v-if="activeMenu === chat.chatId && chat.editing">
              <el-input 
                v-model="chat.title" 
                class="edit-input" 
                size="small"
                @blur="stopEditing(chat)"
                @keyup.enter="updateChatTitle(chat)" />
            </template>
            <template v-else>
              <span class="title-text">{{ chat.title }}</span>
            </template>
          </div>
          <div v-if="activeMenu === chat.chatId" class="action-icons">
            <el-tooltip content="编辑标题" placement="top">
              <el-icon @click.stop="startEditing(chat)"><EditPen /></el-icon>
            </el-tooltip>
            <el-tooltip content="删除会话" placement="top">
              <el-icon @click.stop="deleteChat(chat)"><Delete /></el-icon>
            </el-tooltip>
          </div>
        </div>
      </div>
    </div>
    <!-- 移除这部分，因为我们已经在MenuBox中添加了展开按钮 -->
    <!-- <div v-if="isHidden.value" class="mini-sidebar">
      <el-tooltip content="展开侧边栏" placement="right">
        <div class="toggle-icon" @click="toggleSidebar">
          <el-icon><ArrowRight /></el-icon>
        </div>
      </el-tooltip>
      <div class="mini-actions">
        <el-tooltip content="新建会话" placement="right">
          <el-button 
            type="primary" 
            circle 
            size="small" 
            @click="createNewChat">
            <el-icon><Plus /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div> -->
  </div>
</template>

<script>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue';
import { EditPen, Delete, ArrowRight, ChatDotRound, Plus } from "@element-plus/icons-vue";
import MenuBox from "./MenuBox.vue";
import { listChats, updateChat, deleteChat as deleteChatApi } from "@/api/chat/chat";
import { useChatStore } from '@/store/chat';

export default {
  components: {
    EditPen,
    Delete,
    MenuBox,
    ArrowRight,
    ChatDotRound,
    Plus
  },
  emits: ['toggle-sidebar'], // 添加这一行，定义组件可以发出的事件
  setup(props, { emit }) { // 添加 emit 参数
    const isHidden = ref(false);
    const activeMenu = ref(null);
    const chatStore = useChatStore();
    const chats = ref(chatStore.chatList);
    const projectId = ref(chatStore.projectId);
    const chatId = ref(chatStore.chatId);

    // 监听 chatStore 的 chatList 变化
    watch(() => chatStore.chatList, (newChatList) => {
      chats.value = newChatList;
      if (newChatList.length > 0) {
        activeMenu.value = newChatList[0].chatId;
      }
    });

    const groupedChats = computed(() => {
      const groups = {};
      chats.value.forEach((chat) => {
        const dateLabel = getDateLabel(chat.createTime);
        if (!groups[dateLabel]) {
          groups[dateLabel] = [];
        }
        groups[dateLabel].push(chat);
      });

      const sortedGroups = {};
      const todayChats = groups["今天"] || [];
      if (todayChats.length > 0) sortedGroups["今天"] = todayChats;

      Object.keys(groups)
        .filter((date) => date !== "今天")
        .forEach((date) => {
          sortedGroups[date] = groups[date];
        });

      return sortedGroups;
    });

    const toggleSidebar = () => {
      isHidden.value = !isHidden.value;
      // 向父组件发送折叠状态变化事件
      emit('toggle-sidebar', isHidden.value);
    };

    const fetchChats = async () => {
      try {
        await chatStore.fetchChatList();
        if (chats.value.length > 0) {
          activeMenu.value = chats.value[0].chatId; // 默认选择第一个会话
          chatStore.fetchMessages(activeMenu.value);
        }
      } catch (error) {
        console.error("获取会话列表失败:", error);
      }
    };

    const selectMenu = async (chatId) => {
      activeMenu.value = chatId;
      chatStore.chatId = chatId;
      await chatStore.fetchMessages(chatId);
    };

    const startEditing = (chat) => {
      activeMenu.value = chat.chatId;
      chat.editing = true;
    };

    const stopEditing = (chat) => {
      chat.editing = false;
      updateChatTitle(chat);
    };

    const updateChatTitle = async (chat) => {
      try {
        await updateChat({ projectId: projectId.value, chatId: chat.chatId, title: chat.title });
        chat.editing = false;
        activeMenu.value = chat.chatId;
      } catch (error) {
        console.error("更新会话标题失败:", error);
      }
    };

    const deleteChat = async (chat) => {
      try {
        await deleteChatApi(projectId.value, chat.chatId);
        chats.value = chats.value.filter((c) => c.chatId !== chat.chatId);
        if (chats.value.length > 0) {
          activeMenu.value = chats.value[0].chatId;
        }
      } catch (error) {
        console.error("删除会话失败:", error);
      }
    };

    const createNewChat = async () => {
      try {
        await chatStore.createNewChat();
      } catch (error) {
        console.error("创建新聊天失败:", error);
      }
    };

    const getDateLabel = (createTime) => {
      const now = new Date();
      const chatDate = new Date(createTime);
      const diffInDays = Math.floor((now - chatDate) / (1000 * 3600 * 24));

      if (diffInDays === 0) {
        return "今天";
      } else if (diffInDays === 1) {
        return "昨天";
      } else {
        return `${diffInDays}天前`;
      }
    };

    const checkWindowSize = () => {
      isHidden.value = window.innerWidth <= 768;
    };

    onMounted(() => {
      checkWindowSize();
      window.addEventListener('resize', checkWindowSize);
      fetchChats();
    });

    onBeforeUnmount(() => {
      window.removeEventListener('resize', checkWindowSize);
    });

    return {
      isHidden,
      activeMenu,
      groupedChats,
      toggleSidebar,
      selectMenu,
      startEditing,
      stopEditing,
      updateChatTitle,
      deleteChat,
      createNewChat
    };
  },
};
</script>

<style scoped>
.sidebar-box {
  height: 100vh;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.sidebar-show {
  width: 400px; /* 将宽度从 300px 增加到 400px */
  border-right: 1px solid #ebeef5;
  background-color: #fff;
}

.sidebar-hidden {
  width: 50px;
  border-right: 1px solid #ebeef5;
  background-color: #fff;
}

.sidebar {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  margin: 0;
  width: 400px; /* 将宽度从 300px 增加到 400px */
}

.chat-group {
  margin-bottom: 10px;
}

.date-label {
  font-weight: bold;
  font-size: 13px;
  color: #606266;
  padding: 10px 16px 0;
  display: flex;
  align-items: center;
}

.date-label span {
  margin-right: 8px;
}

.date-label .el-divider {
  margin: 8px 0;
}

.sidebar-item {
  padding: 10px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 4px;
  margin: 0 8px;
  transition: all 0.2s ease;
  width: 350px;
}

.sidebar-item:hover {
  background-color: #f5f7fa;
}

.active {
  background-color: #ecf5ff;
  color: #409eff;
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  flex: 1;
}

.title-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.edit-input {
  flex: 1;
  margin-right: 10px;
}

.action-icons {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 1; /* 修改为完全不透明 */
}

.action-icons .el-icon {
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  color: #606266; /* 确保图标颜色可见 */
}

.action-icons .el-icon:hover {
  transform: scale(1.1);
  color: #409eff;
}

/* 迷你侧边栏样式 */
.mini-sidebar {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  height: 100%;
}

.toggle-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 20px;
  color: #606266;
}

.toggle-icon:hover {
  background-color: #f2f6fc;
  color: #409eff;
}

.mini-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
