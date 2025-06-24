<template>
  <ul class="message-list" ref="messaggListRef">
    <li :class="message.sender === 'user' ? 'ask' : 'answer'" v-for="(message, index) in messages" :key="index">
      <div :class="message.sender === 'user' ? 'askIcon' : 'answerIcon'">
        <el-icon v-if="message.sender === 'user'">
          <User />
        </el-icon>
        <el-icon v-else>
          <img v-if="message.text == '努力思考中，请稍后'" src="../assets/loading.gif" alt="" width="70px"
            style="background-color: transparent;">
          <Service v-else />
        </el-icon>
      </div>
      <div :class="message.sender === 'user' ? 'askContent' : 'answerContent'" v-html="message.text">
      </div>
      <span v-if="message.isTyping" class="cursor">_</span>
    </li>
  </ul>
</template>

<script>
import { ChatLineRound, Bottom, ChatSquare, User, Link, Position, Service } from "@element-plus/icons-vue"
import { onMounted, watch, ref } from "vue";
export default {
  //   props: {
  //     messages: {
  //       type: Array,
  //       default: () => [],
  //     },
  //   },

};
</script>


<script setup>
const messaggListRef = ref()
const scrollTop = ref()
const props = defineProps(["messages"])

onMounted(() => {
  setInterval(() => {
    scrollTop.value = messaggListRef.value.scrollHeight
  }, 300);
})

watch(scrollTop, () => {
  messaggListRef.value.scrollTop = messaggListRef.value.scrollHeight
})


// watch
</script>

<style scoped>
.message-list {
  max-height: 100%;
  overflow-y: auto; /* 只在需要时显示纵向滚动条 */
  overflow-x: hidden; /* 禁止横向滚动 */
  padding: 10px;
  list-style: none; /* 移除列表样式 */
  margin: 0; /* 移除默认外边距 */
}

.user .message-content {
  background-color: #d1eaff;
}

.cursor {
  display: inline-block;
  animation: blink 1s step-end infinite;
  position: absolute;
  bottom: 5px;
  right: 10px;
}

.code-block {
  background-color: #f5f5f5;
  border-radius: 5px;
  padding: 10px;
  margin: 10px 0;
  overflow-x: auto; /* 代码块允许横向滚动 */
  max-width: 100%; /* 限制最大宽度 */
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 响应式布局：适配不同屏幕 */
@media (max-width: 768px) {
  .message-content {
    max-width: 80%;
    font-size: 14px;
  }
}
</style>

<style lang="scss" scoped>
li {
  margin-bottom: 20px;
  max-width: 100%; /* 限制最大宽度 */
}

li.ask {
  display: flex;
  flex-direction: row-reverse;
  text-align: right;

  .askIcon {
    margin-left: 20px;
    font-size: 30px;
    flex-shrink: 0; /* 防止图标缩小 */
  }

  .askContent {
    border: 1px solid #aaa;
    border-radius: 20px;
    padding: 20px 20px 0 20px;
    background-color: #eee;
    line-height: 20px;
    max-width: 80%; /* 限制消息内容宽度 */
    word-wrap: break-word; /* 允许长单词换行 */
    overflow-wrap: break-word; /* 现代浏览器的长单词换行 */
  }
}

li.answer {
  display: flex;
  text-align: left;

  .answerIcon {
    margin-right: 20px;
    font-size: 30px;
    flex-shrink: 0; /* 防止图标缩小 */

    :deep(.el-loading-spinner) {
      left: -5px;
    }
  }

  .answerContent {
    border: 1px solid #aaa;
    border-radius: 20px;
    padding: 20px;
    background-color: #eee;
    line-height: 25px;
    max-width: 80%; /* 限制消息内容宽度 */
    word-wrap: break-word; /* 允许长单词换行 */
    overflow-wrap: break-word; /* 现代浏览器的长单词换行 */
  }
}
</style>
