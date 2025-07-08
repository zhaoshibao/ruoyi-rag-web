import { defineStore } from 'pinia';
import { sendMessage, sendMessageV2, createChat, listMessages, listChats, saveMessage } from '@/api/chat/chat';
import Prism from 'prismjs';
import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [],
    projectId: '118abc',
    chatId: 5,
    chatList: [],
    isSending: false,
    uuid: '',
    useSSE: false, // 默认普通模式
    currentEventSource: null,
    currentAbortController: null, // 新增：当前请求的AbortController
  }),
  actions: {
    uuidToNumber(uuid) {
      let number = 0;
      for (let i = 0; i < uuid.length && i < 6; i++) {
        const hexValue = uuid[i];
        let digit = 0;
        if (/[0-9a-fA-F]/.test(hexValue)) {
          digit = parseInt(hexValue, 16);
        }
        number = number * 16 + digit;
      }
      return number % 1000000; // 取模得到 6 位数字
    },
    // 初始化时检查UUID是否存在，如果没有则生成新的UUID
    initUUID() {
      let storedUUID = localStorage.getItem('user_uuid');
      if (!storedUUID) {
        // 生成新的UUID并转换为数字
        const newUUID = uuidv4();
        const numericUUID = this.uuidToNumber(newUUID);
        localStorage.setItem('user_uuid', numericUUID.toString());
        this.uuid = numericUUID;
      } else {
        // 从localStorage读取已存在的数字UUID
        this.uuid = parseInt(storedUUID, 10);
      }
    },

    // 获取会话列表
    async fetchChatList() {
      try {
        const response = await listChats(this.projectId,this.uuid);
        console.log(response.data);
        
        this.chatList = response.data.map(item => {
          item.chatId = BigInt(item.chatId).toString()
          return item;
        }); // 假设 API 返回会话列表
        
      } catch (error) {
        console.error('获取会话列表失败:', error);
      }
    },

    // 选择会话，切换当前会话
    async selectChat(chatId) {
      this.chatId = chatId;
      await this.fetchMessages(chatId); // 加载选中会话的消息
    },

    // 格式化消息
    formatMessage(message) {
      console.log('=================格式化消息方法——>原始消息:===============', message);
      const codeBlockMatches = [];
      
      // 1. 先处理代码块，避免 marked 解析代码块
      let formattedMessage = message.replace(/```(?:\s*(\w+))?\n([\s\S]*?)```/g, (match, language, codeContent, index) => {
        const lang = (language || 'plaintext').trim();
        codeBlockMatches.push({ codeContent, lang });
        return `__CODE_BLOCK_${codeBlockMatches.length - 1}__`;
      });
      
      // 2. 使用 marked 处理其他 Markdown 语法
      formattedMessage = marked.parse(formattedMessage);
      
      // 3. 恢复代码块并应用语法高亮
      codeBlockMatches.forEach((block, index) => {
        const highlightedCode = Prism.highlight(
          block.codeContent.trim(),
          Prism.languages[block.lang] || Prism.languages.plaintext,
          block.lang
        );
        formattedMessage = formattedMessage.replace(
          `__CODE_BLOCK_${index}__`,
          `<pre><code class="language-${block.lang}">${highlightedCode}</code></pre>`
        );
      });
      
      return formattedMessage;
    },

    // 添加消息
    addMessage(message) {
      message.text = this.formatMessage(message.text);
      this.messages.push(message);
    },

    // 新增：切换SSE模式
    toggleSSEMode(useSSE = true) {
      this.useSSE = useSSE;
      console.log('SSE模式已切换为:', useSSE ? '开启' : '关闭');
    },
    
    // 修改：发送消息到ChatGPT（支持SSE和传统模式）
    async sendMessageToChatGPT(userMessage) {
      // 如果是SSE模式，不在这里处理，由Chat组件的sendMessageToChatGPTWithSSE处理
      if (this.useSSE) {
        console.log('SSE模式下，消息应由Chat组件处理');
        return;
      }
      
      // 添加用户消息
      this.addMessage({ sender: 'user', text: userMessage.msg });
      
      this.isSending = true;
      
      console.log('=== 发送消息调试信息 ===');
      console.log('当前SSE模式:', this.useSSE);
      console.log('用户消息:', userMessage);
      console.log('用户ID:', this.uuid);
      
      try {
        console.log('使用传统模式发送消息');
        await this.sendMessageTraditional(userMessage);
      } catch (error) {
        console.error('发送消息时出错:', error);
        this.handleSendError(error);
      }
    },
    
    // 新增：专门处理Chat组件传递的SSE连接
    async sendMessageToChatGPTWithSSE(userMessage, eventSource) {
      // 创建新的AbortController
      this.currentAbortController = new AbortController();
      
      // 添加用户消息
      this.addMessage({ sender: 'user', text: userMessage.msg });
      
      this.isSending = true;
      this.currentEventSource = eventSource;
      
      console.log('=== 使用Chat组件提供的SSE连接 ===');
      console.log('用户消息:', userMessage);
      console.log('EventSource:', eventSource);
      
      // 添加AI回复消息（流式显示）
      const chatGptReply = { 
        userId: this.uuid,
        sender: 'chatgpt', 
        text: '', 
        isTyping: true, 
        isStreaming: true,
        isThinking: false
      };
      this.addMessage(chatGptReply);
      
      // 构建查询对象
      const queryVo = {
        userId: this.uuid,
        projectId: this.projectId,
        chatId: this.chatId,
        language: userMessage.language || 0,
        msg: userMessage.msg,
      };
      
      return new Promise((resolve, reject) => {
        let fullResponse = '';
        
        // 监听AbortController信号
        this.currentAbortController.signal.addEventListener('abort', () => {
          console.log('SSE请求被取消');
          if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
            eventSource.close();
          }
          this.handleSSEError('用户取消了请求');
          reject(new Error('用户取消了请求'));
        });
        
        // 设置连接超时
        const connectionTimeout = setTimeout(() => {
          if (eventSource && eventSource.readyState === EventSource.CONNECTING) {
            console.warn('⏰ SSE连接超时（15秒）');
            eventSource.close();
            this.handleSSEError('SSE连接超时，请检查网络连接');
            reject(new Error('SSE连接超时'));
          }
        }, 15000);
        
        // 监听连接打开
        eventSource.onopen = (event) => {
          clearTimeout(connectionTimeout);
          console.log('🎉 SSE连接成功打开!');
          console.log('连接事件详情:', event);
          console.log('当前连接状态:', eventSource.readyState);
          
          // 连接建立后发送消息
          console.log('📤 开始发送消息到后端...');
          sendMessageV2(queryVo, this.currentAbortController)
            .then((response) => {
              console.log('✅ 消息发送成功，响应:', response);
              console.log('等待SSE数据流...');
            })
            .catch((error) => {
              console.error('❌ 发送消息失败:', error);
              if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
                eventSource.close();
              }
              this.handleSSEError('发送消息失败: ' + error.message);
              reject(error);
            });
        };
        
        // 监听 'add' 事件 - 接收消息内容片段
        eventSource.addEventListener('add', (event) => {
          try {
            const content = event.data;
            console.log('📨 收到add事件数据:', content);
            
            fullResponse += content;
            console.log('当前完整响应长度:', fullResponse.length);
            
            // 更新UI
            chatGptReply.text = this.formatMessage(fullResponse);
            this.messages = [...this.messages];
          } catch (error) {
            console.error('❌ 处理add事件失败:', error);
          }
        });
        
        // 监听 'finish' 事件 - 消息发送完成
        eventSource.addEventListener('finish', (event) => {
          console.log('🏁 收到finish事件，消息发送完成');
          console.log('最终响应长度:', fullResponse.length);
          
          if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
            eventSource.close();
          }
          
          chatGptReply.text = this.formatMessage(fullResponse);
          chatGptReply.isTyping = false;
          chatGptReply.isStreaming = false;
          this.isSending = false;
          this.currentEventSource = null;
          
          // 保存消息到后端
          saveMessage({
            "chatId": this.chatId,
            "content": fullResponse
          }).catch(err => {
            console.error('保存消息失败:', err);
          });
          
          // 高亮代码
          setTimeout(() => {
            Prism.highlightAll();
          }, 100);
          
          this.messages = [...this.messages];
          this.currentAbortController = null;
          resolve(fullResponse);
        });
        
        // 监听 'error' 事件 - 处理错误
        eventSource.addEventListener('error', (event) => {
          console.error('❌ 收到error事件:', event.data);
          
          if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
            eventSource.close();
          }
          const errorMsg = event.data || 'SSE接收过程中发生错误';
          this.handleSSEError(errorMsg);
          reject(new Error(errorMsg));
        });
        
        // 监听连接错误（网络层面的错误）
        // 在 sendMessageToChatGPTWithSSE 方法中的 onerror 处理
        eventSource.onerror = (error) => {
        console.error('🚨 SSE连接发生错误:');
        console.error('错误对象:', error);
        console.error('连接状态:', eventSource.readyState);
        console.error('连接URL:', eventSource.url);
        
        if (eventSource.readyState === EventSource.CONNECTING) {
        console.warn('⚠️ SSE正在尝试重连...');
        } else if (eventSource.readyState === EventSource.CLOSED) {
        console.error('💀 SSE连接已关闭');
        clearTimeout(connectionTimeout);
        this.handleSSEError('SSE连接已关闭');
        reject(new Error('SSE连接已关闭'));
        } else {
        console.error('💥 SSE连接发生未知错误');
        eventSource.close();
        clearTimeout(connectionTimeout);
        this.handleSSEError('SSE连接失败，请检查网络或后端服务');
        reject(error);
        }
        
        // 确保状态重置
        this.isSending = false;
        this.currentEventSource = null;
        this.currentAbortController = null;
        };
      });
    },
    
    // 新增：处理SSE错误
    // 修改：处理SSE错误
    handleSSEError(errorMessage) {
    console.log('🚨 处理SSE错误:', errorMessage);
    
    if (this.messages.length > 0) {
    const lastMessage = this.messages[this.messages.length - 1];
    if (lastMessage.sender === 'chatgpt' && (lastMessage.isStreaming || lastMessage.isThinking || lastMessage.isTyping)) {
    lastMessage.text = `抱歉，接收消息时出现错误：${errorMessage}`;
    lastMessage.isTyping = false;
    lastMessage.isStreaming = false;
    lastMessage.isThinking = false;
    this.messages = [...this.messages];
    }
    }
    
    // 确保状态重置
    this.isSending = false;
    this.currentEventSource = null;
    this.currentAbortController = null;
    },
    
    // 修改：停止当前请求
    // 修改：停止当前请求
    stopCurrentSSE() {
      console.log('🛑 停止当前请求...');
      
      // 停止HTTP请求
      if (this.currentAbortController) {
        console.log('取消HTTP请求');
        this.currentAbortController.abort();
        this.currentAbortController = null;
      }
      
      // 停止SSE连接（由Chat组件管理）
      if (this.currentEventSource) {
        console.log('关闭SSE连接');
        this.currentEventSource.close();
        this.currentEventSource = null;
      }
      
      // 确保状态重置
      this.isSending = false;
      
      // 更新最后一条消息状态
      if (this.messages.length > 0) {
        const lastMessage = this.messages[this.messages.length - 1];
        if (lastMessage.sender === 'chatgpt' && (lastMessage.isStreaming || lastMessage.isThinking || lastMessage.isTyping)) {
          lastMessage.isStreaming = false;
          lastMessage.isTyping = false;
          lastMessage.isThinking = false;
          if (!lastMessage.text || lastMessage.text.trim() === '') {
            lastMessage.text = '[用户停止了生成]';
          } else {
            lastMessage.text += '\n\n[用户停止了生成]';
          }
          this.messages = [...this.messages];
        }
      }
    },
    
    // 修改：传统模式发送消息（支持取消）
    async sendMessageTraditional(userMessage) {
      // 创建新的AbortController
      this.currentAbortController = new AbortController();
      
      try {
        // 添加思考中的消息
        const thinkingMessage = { sender: 'chatgpt', text: "努力思考中，请稍后", isThinking: true };
        this.addMessage(thinkingMessage);
        
        const messagePayload = {
          projectId: this.projectId,
          language: 0,
          ...userMessage,
        };
        
        // 发送请求（支持取消）
        const response = await sendMessage(messagePayload, this.currentAbortController);
        
        // 检查是否被取消
        if (this.currentAbortController?.signal.aborted) {
          console.log('请求已被取消');
          return;
        }
        
        this.messages.splice(this.messages.length - 1, 1);
        
        const chatGptMessage = response.data;
        const formattedMessage = this.formatMessage(chatGptMessage);
        const chatGptReply = { sender: 'chatgpt', text: '', isTyping: true, isThinking: true };
        this.addMessage(chatGptReply);
        
        // 保存消息（支持取消）
        await saveMessage({
          "chatId": this.chatId,
          "content": chatGptMessage
        }, this.currentAbortController);
        
        // 检查是否被取消
        if (this.currentAbortController?.signal.aborted) {
          console.log('保存消息请求已被取消');
          return;
        }
        
        // 逐字显示逻辑
        const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;
        
        while ((match = codeRegex.exec(formattedMessage)) !== null) {
          // 检查是否被取消
          if (this.currentAbortController?.signal.aborted) {
            console.log('显示过程已被取消');
            return;
          }
          
          const [fullMatch, language, codeContent] = match;
          const nonCodeText = formattedMessage.slice(lastIndex, match.index);
          if (nonCodeText) {
            await this.outputMessagePart(nonCodeText, chatGptReply);
          }
          
          chatGptReply.text += `<pre><code class="language-${language || 'plaintext'}">`;
          this.messages = [...this.messages];
          await this.outputMessagePart(codeContent, chatGptReply);
          chatGptReply.text += `</code></pre>`;
          this.messages = [...this.messages];
          
          lastIndex = codeRegex.lastIndex;
        }
        
        if (lastIndex < formattedMessage.length) {
          const remainingText = formattedMessage.slice(lastIndex);
          await this.outputMessagePart(remainingText, chatGptReply);
        }
        
        // 检查是否被取消
        if (this.currentAbortController?.signal.aborted) {
          console.log('最终处理已被取消');
          return;
        }
        
        setTimeout(() => {
          Prism.highlightAll();
        }, 0);
        
        chatGptReply.isThinking = false;
        chatGptReply.isTyping = false;
        this.isSending = false;
        this.currentAbortController = null;
        this.messages = [...this.messages];
        
        return chatGptMessage;
        
      } catch (error) {
        // 处理取消错误
        if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
          console.log('请求被用户取消');
          this.isSending = false;
          this.currentAbortController = null;
          return;
        }
        
        console.error('发送消息失败:', error);
        this.handleSendError(error);
        throw error;
      }
    },
    
    // 修改：SSE模式也支持AbortController
    async sendMessageToChatGPTWithSSE(userMessage, eventSource) {
      // 创建新的AbortController
      this.currentAbortController = new AbortController();
      
      // 添加用户消息
      this.addMessage({ sender: 'user', text: userMessage.msg });
      
      this.isSending = true;
      this.currentEventSource = eventSource;
      
      console.log('=== 使用Chat组件提供的SSE连接 ===');
      console.log('用户消息:', userMessage);
      console.log('EventSource:', eventSource);
      
      // 添加AI回复消息（流式显示）
      const chatGptReply = { 
        userId: this.uuid,
        sender: 'chatgpt', 
        text: '', 
        isTyping: true, 
        isStreaming: true,
        isThinking: false
      };
      this.addMessage(chatGptReply);
      
      // 构建查询对象
      const queryVo = {
        userId: this.uuid,
        projectId: this.projectId,
        chatId: this.chatId,
        language: userMessage.language || 0,
        msg: userMessage.msg,
      };
      
      return new Promise((resolve, reject) => {
        let fullResponse = '';
        
        // 设置连接超时
        const connectionTimeout = setTimeout(() => {
          if (eventSource && eventSource.readyState === EventSource.CONNECTING) {
            console.warn('⏰ SSE连接超时（15秒）');
            eventSource.close();
            this.handleSSEError('SSE连接超时，请检查网络连接');
            reject(new Error('SSE连接超时'));
          }
        }, 15000);
        
        // 监听连接打开
        eventSource.onopen = (event) => {
          clearTimeout(connectionTimeout);
          console.log('🎉 SSE连接成功打开!');
          console.log('连接事件详情:', event);
          console.log('当前连接状态:', eventSource.readyState);
          
          // 连接建立后发送消息
          console.log('📤 开始发送消息到后端...');
          sendMessageV2(queryVo)
            .then((response) => {
              console.log('✅ 消息发送成功，响应:', response);
              console.log('等待SSE数据流...');
            })
            .catch((error) => {
              console.error('❌ 发送消息失败:', error);
              if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
                eventSource.close();
              }
              this.handleSSEError('发送消息失败: ' + error.message);
              reject(error);
            });
        };
        
        // 监听 'add' 事件 - 接收消息内容片段
        eventSource.addEventListener('add', (event) => {
          try {
            const content = event.data;
            console.log('📨 收到add事件数据:', content);
            
            fullResponse += content;
            console.log('当前完整响应长度:', fullResponse.length);
            
            // 更新UI
            chatGptReply.text = this.formatMessage(fullResponse);
            this.messages = [...this.messages];
          } catch (error) {
            console.error('❌ 处理add事件失败:', error);
          }
        });
        
        // 监听 'finish' 事件 - 消息发送完成
        eventSource.addEventListener('finish', (event) => {
          console.log('🏁 收到finish事件，消息发送完成');
          console.log('最终响应长度:', fullResponse.length);
          
          if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
            eventSource.close();
          }
          
          chatGptReply.text = this.formatMessage(fullResponse);
          chatGptReply.isTyping = false;
          chatGptReply.isStreaming = false;
          this.isSending = false;
          this.currentEventSource = null;
          
          // 保存消息到后端
          saveMessage({
            "chatId": this.chatId,
            "content": fullResponse
          }).catch(err => {
            console.error('保存消息失败:', err);
          });
          
          // 高亮代码
          setTimeout(() => {
            Prism.highlightAll();
          }, 100);
          
          this.messages = [...this.messages];
          this.currentAbortController = null;
          resolve(fullResponse);
        });
        
        // 监听 'error' 事件 - 处理错误
        eventSource.addEventListener('error', (event) => {
          console.error('❌ 收到error事件:', event.data);
          
          if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
            eventSource.close();
          }
          const errorMsg = event.data || 'SSE接收过程中发生错误';
          this.handleSSEError(errorMsg);
          reject(new Error(errorMsg));
        });
        
        // 监听连接错误（网络层面的错误）
        eventSource.onerror = (error) => {
          console.error('🚨 SSE连接发生错误:');
          console.error('错误对象:', error);
          console.error('连接状态:', eventSource.readyState);
          console.error('连接URL:', eventSource.url);
          
          if (eventSource.readyState === EventSource.CONNECTING) {
            console.warn('⚠️ SSE正在尝试重连...');
          } else if (eventSource.readyState === EventSource.CLOSED) {
            console.error('💀 SSE连接已关闭');
            clearTimeout(connectionTimeout);
            this.handleSSEError('SSE连接已关闭');
            reject(new Error('SSE连接已关闭'));
          } else {
            console.error('💥 SSE连接发生未知错误');
            eventSource.close();
            clearTimeout(connectionTimeout);
            this.handleSSEError('SSE连接失败，请检查网络或后端服务');
            reject(error);
          }
        };
      });
    },
    
    // 新增：处理发送错误
    handleSendError(error) {
      console.log('🚨 处理发送错误:', error);
      
      const errorMessage = '抱歉，我现在无法响应。请检查网络连接后重试。';
      
      // 移除可能存在的思考中消息
      if (this.messages.length > 0) {
        const lastMessage = this.messages[this.messages.length - 1];
        if (lastMessage.sender === 'chatgpt' && (lastMessage.isThinking || lastMessage.isStreaming || lastMessage.isTyping)) {
          lastMessage.text = errorMessage;
          lastMessage.isTyping = false;
          lastMessage.isStreaming = false;
          lastMessage.isThinking = false;
          this.messages = [...this.messages];
        } else {
          this.addMessage({ sender: 'chatgpt', text: errorMessage, isTyping: false });
        }
      } else {
        this.addMessage({ sender: 'chatgpt', text: errorMessage, isTyping: false });
      }
      
      // 确保状态重置
      this.isSending = false;
      this.currentEventSource = null;
      this.currentAbortController = null;
    },
    
    async outputMessagePart(part, chatGptReply) {
      let buffer = '';
      for (const char of part) {
        buffer += char;
        chatGptReply.text = buffer + '_';
        this.messages = [...this.messages];
        await new Promise(resolve => setTimeout(resolve, 50));
        chatGptReply.text = buffer;
        this.messages = [...this.messages];
      }
    },

    // 创建新会话
    async createNewChat() {
      try {
        const response = await createChat({
          userId:this.uuid,
          projectId: this.projectId,
          title: '新会话' + Math.random().toString(36).substring(2, 7),
        });
        this.messages = [];
        this.chatId = response.data;
        this.chatId = BigInt(response.data).toString()
        console.log(this.chatId);
        
        
        await this.fetchChatList(); // 创建新会话后更新会话列表
      } catch (error) {
        console.error('创建新聊天失败:', error);
      }
    },

    // 获取指定会话的消息
    async fetchMessages(chatId) {
      try {
        const response = await listMessages(chatId);
        this.messages = response.data.map(msg => ({
          ...msg,
          text: this.formatMessage(msg.content),
          sender: msg.type ===0?'user':'chatgpt'
        }));
      } catch (error) {
        console.error('获取消息失败:', error);
      }
    },
  },
});
