<template>
  <div class="app-container">
    <el-table :data="knowledgeList" style="width: 100%">
      <el-table-column prop="name" label="知识库名称" />
      <el-table-column prop="type" label="类型" />
      <el-table-column prop="documentCount" label="文档数量" />
      <el-table-column prop="createTime" label="创建时间" />
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <el-tag :type="row.status === '1' ? 'success' : 'info'">{{ row.status === '1' ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const knowledgeList = ref([
  {
    name: '通用知识库',
    type: 'PDF文档',
    documentCount: 10,
    createTime: '2024-01-01',
    status: '1'
  },
  {
    name: '技术文档库',
    type: 'Markdown',
    documentCount: 5,
    createTime: '2024-01-02',
    status: '0'
  }
])
</script>