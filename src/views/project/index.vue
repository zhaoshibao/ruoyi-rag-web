<template>
  <div class="app-container">
    <!-- 搜索表单 -->
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="项目名称" prop="projectName">
        <el-input v-model="queryParams.projectName" placeholder="请输入项目名称" clearable style="width: 240px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 操作按钮 -->
    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete">删除</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" :columns="columns"></right-toolbar>
    </el-row>

    <!-- 项目列表 -->
    <el-table v-loading="loading" :data="projectList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" align="center" />
      <el-table-column label="项目编号" align="center" prop="projectId" width="80" />
      <el-table-column label="项目名称" align="center" prop="projectName" width="120" />
      <el-table-column label="模型类型" align="center" prop="type" width="100" />
      <el-table-column label="具体模型" align="center" prop="model" width="150" />
      <el-table-column label="嵌入模型" align="center" prop="embeddingModel" width="150" />
      <el-table-column label="基础url" align="center" prop="baseUrl" width="150">
        <template #default="scope">
          <el-tooltip class="item" effect="dark" :content="scope.row.baseUrl" placement="top">
            <div class="ellipsis-text">{{ scope.row.baseUrl }}</div>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="apiKey" align="center" prop="apiKey" width="120">
        <template #default="scope">
          <el-tooltip class="item" effect="dark" :content="scope.row.apiKey" placement="top">
            <div class="ellipsis-text">{{ scope.row.apiKey }}</div>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="系统提示词" align="center" prop="systemPrompt" width="300">
        <template #default="scope">
          <el-tooltip class="item" effect="dark" :content="scope.row.systemPrompt" placement="top-start">
            <div class="ellipsis-text">{{ scope.row.systemPrompt }}</div>
          </el-tooltip>
        </template>
      </el-table-column>
       <el-table-column label="PDF增强解析" align="center" prop="pdfAnalysis" width="120">
        <template #default="scope">
            <span v-if="scope.row.pdfAnalysis == 1">是</span>
            <span v-else>否</span>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
    
      <el-table-column label="操作" align="center"  class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" >删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    
    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 添加或修改项目对话框 -->
    <el-dialog :title="title" v-model="open" width="800px" append-to-body>
      <el-form ref="projectRef" :model="form" :rules="rules" label-width="180px">
        <el-form-item label="项目名称" prop="projectName">
          <el-input v-model="form.projectName" placeholder="请输入项目名称" />
        </el-form-item>
        <el-form-item label="模型类型" prop="type">
            <el-select
            v-model="form.type"
            placeholder="选择模型类型"
            clearable
            style="width: 240px">
            <el-option
              v-for="item in modelTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="具体模型" prop="model">
           <el-input v-model="form.model" placeholder="请输入具体模型" />
        </el-form-item>
          <el-form-item label="嵌入模型" prop="embeddingModel">
           <el-input v-model="form.embeddingModel" placeholder="请输入嵌入模型" />
        </el-form-item>
         <el-form-item label="基础url" prop="baseUrl">
           <el-input v-model="form.baseUrl" placeholder="请输入基础url" />
        </el-form-item>
         <el-form-item label="apiKey" prop="apiKey">
           <el-input v-model="form.apiKey" placeholder="请输入apiKey" />
        </el-form-item>
         <el-form-item label="系统提示词" prop="systemPrompt">
           <el-input type="textarea" 
            :autosize="{ minRows: 10, maxRows: 10}" v-model="form.systemPrompt" placeholder="请输入系统提示词" />
        </el-form-item>
         <el-form-item label="是否开启pdf增强解析" prop="pdfAnalysis">
           <el-switch v-model="form.pdfAnalysis" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { listProject, getProject, addProject, updateProject, delProject } from '@/api/project/project'
import { parseTime } from '@/utils/ruoyi'

const { proxy } = getCurrentInstance()

//模型类型
const modelTypeOptions = ref([
      {
        label: "openai",
        value: "openai"
       },
       {
        label: "ollama",
        value: "ollama"
       },
       {
        label: "zhipuai",
        value: "zhipuai"
       }
])

// 遮罩层
const loading = ref(false)
// 选中数组
const ids = ref([])
const names = ref([])
// 非单个禁用
const single = ref(true)
// 非多个禁用
const multiple = ref(true)
// 显示搜索条件
const showSearch = ref(true)
// 总条数
const total = ref(0)
// 项目表格数据
const projectList = ref([])
// 弹出层标题
const title = ref("")
// 是否显示弹出层
const open = ref(false)

// 表单参数
const form = ref({
})

// 查询参数
const queryParams = ref({
  pageNum: 1,
  pageSize: 10,
  projectName: undefined
})

// 列显示控制
const columns = ref([
 
])

// 表单校验
const rules = ref({
      projectName: [
        { required: true, message: "项目名称不能为空", trigger: "blur" }
      ],
      type: [
        { required: true, message: "请选择模型类型", trigger: "blur" }
      ],
      model: [
        { required: true, message: "请选择模型", trigger: "blur" }
      ],
      baseUrl: [
        { required: true, message: "请输入基础url", trigger: "blur" }
      ],
})

/** 查询项目列表 */
function getList() {
  loading.value = true
  listProject(queryParams.value).then(response => {
    projectList.value = response.rows
    total.value = response.total
    loading.value = false
  })
}

/** 取消按钮 */
function cancel() {
  open.value = false
  reset()
}

/** 表单重置 */
function reset() {
  form.value = {
    id: undefined,
    name: undefined,
    description: undefined
  }
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

/** 重置按钮操作 */
function resetQuery() {
  proxy.resetForm("queryRef")
  handleQuery()
}

/** 多选框选中数据 */
function handleSelectionChange(selection) {
  console.log('selection',selection)
  ids.value = selection.map(item => item.projectId)
  names.value = selection.map(item => item.projectName)
  single.value = selection.length != 1
  multiple.value = !selection.length
}

/** 新增按钮操作 */
function handleAdd() {
  reset()
  form.value.type = "openai"
  open.value = true
  title.value = "添加项目"
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset()
  const projectId = row.projectId || ids.value
  getProject(projectId).then(response => {
    form.value = response.data
    open.value = true
    title.value = "修改项目"
  })
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["projectRef"].validate(valid => {
    if (valid) {
      if (form.value.projectId != undefined) {
        updateProject(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功")
          open.value = false
          getList()
        })
      } else {
        addProject(form.value).then(response => {
          proxy.$modal.msgSuccess("新增成功")
          open.value = false
          getList()
        })
      }
    }
  })
}

/** 删除按钮操作 */
function handleDelete(row) {
  const projectIds = row.projectId || ids.value;
  const projectNames = row.projectName || names.value;
  proxy.$modal.confirm('是否确认删除项目名称为"' + projectNames + '"的数据项？').then(function() {
    return delProject(projectIds)
  }).then(() => {
    getList()
    proxy.$modal.msgSuccess("删除成功")
  }).catch(() => {
    proxy.$modal.msgSuccess("删除失败")
  })
}


onMounted(() => {
  getList()
})


</script>

<style scoped>
.el-tag + .el-tag {
  margin-left: 10px;
}
.mb8 {
  margin-bottom: 8px;
}

.ellipsis-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  display: inline-block;
}

</style>