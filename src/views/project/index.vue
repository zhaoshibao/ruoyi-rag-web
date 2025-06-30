<template>
  <div class="app-container">
    <el-table :data="projectList" style="width: 100%">
      <el-table-column prop="name" label="项目名称" />
      <el-table-column prop="description" label="项目描述" />
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

const projectList = ref([
  {
    name: '示例项目1',
    description: '这是一个示例项目',
    createTime: '2024-01-01',
    status: '1'
  },
  {
    name: '示例项目2',
    description: '这是另一个示例项目',
    createTime: '2024-01-02',
    status: '0'
  }
])
</script>