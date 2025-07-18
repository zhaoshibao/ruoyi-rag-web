<template>
    <div class="knowledge-graph">
      <el-card>
        <template #header>
          <span>知识图谱管理</span>
        </template>
        
        <el-form :inline="true">
          <!-- <el-form-item>
            <el-upload
              class="upload-demo"
              :action="uploadUrl"
              :headers="headers"
              :data="uploadData"
              :before-upload="beforeUpload"
              :on-success="handleUploadSuccess"
              :on-error="handleUploadError">
              <el-button type="primary">上传CSV文件</el-button>
            </el-upload>
          </el-form-item> -->
          
          <el-form-item>
            <el-input
              v-model="searchKeyword"
              placeholder="请输入搜索关键词"
              @keyup.enter="handleSearch">
              <template #append>
                <el-button type="primary" icon="Search" @click="handleSearch"></el-button>
              </template>
            </el-input>
          </el-form-item>
        </el-form>
  
        <div ref="container" class="graph-container"></div>
      </el-card>
    </div>
  </template>
  
  <script setup>
  import { ref, watch, computed, onMounted, onBeforeUnmount,  defineExpose } from 'vue';
  import G6 from '@antv/g6';
  import { getToken } from "@/utils/auth";
  import { getGraphData, searchGraph, uploadCsv } from "@/api/neo4j/neo4j";

  const { proxy } = getCurrentInstance()

  const props = defineProps({
    projectId: {
      type: [String, Number],
      required: true
    }
  });

  const headers = {Authorization: 'Bearer ' + getToken()};

  const uploadUrl = import.meta.env.VITE_APP_BASE_API + '/neo4j/upload';
  const uploadData = {projectId: props.projectId};
  const searchKeyword = ref('');
  const graph = ref(null);
  const graphData = ref({
    nodes: [],
    edges: []
  });

  watch(() => props.projectId, () => {
    uploadData.projectId = props.projectId;
    loadGraphData();
  });

  onMounted(() => {
    initGraph();
  });

  onBeforeUnmount(() => {
    if (graph.value) {
      graph.value.destroy();
    }
  });

  function handleUploadSuccess(response) {
      proxy.$modal.msgSuccess('上传成功');
      // 上传成功后立即重新加载图谱数据
      loadGraphData();
  };

    function handleUploadError(error) {
      proxy.$modal.msgError('上传失败：' + (error.message || '未知错误'));
    };

    function initGraph() {
        const container = proxy.$refs.container;
        const width = container.scrollWidth || 800;
        const height = container.scrollHeight || 600;

        graph.value = new G6.Graph({
            container,
            width,
            height,
            modes: {
              default: [
                'zoom-canvas',
                'drag-canvas',
                'drag-node',
                'click-select'
              ]
            },
            layout: {
              type: 'dagre',
              rankdir: 'LR',        // 从左到右布局
              align: 'DL',         // 对齐方式
              nodesep: 60,         // 节点间水平间距
              ranksep: 80,         // 层级间垂直间距
              controlPoints: true,  // 是否保留边的控制点
              nodeSize: [150, 40],  // 节点大小
              // 特殊节点层级约束
              nodesepFunc: (node) => {
                return 60;  // 固定节点间距
              },
              ranksepFunc: (node) => {
                return 80;  // 固定层间距
              }
            },
            defaultNode: {
              type: 'rect',
              size: [120, 40],
              style: {
                fill: '#fff',
                stroke: '#40a9ff',
                lineWidth: 1.5,
                radius: 8,
                shadowColor: 'rgba(0,0,0,0.1)',
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowOffsetY: 5,
                cursor: 'pointer'
              },
              labelCfg: {
                position: 'center',
                style: {
                  fill: '#333',
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: 'Microsoft YaHei'
                }
              }
            },
            defaultEdge: {
              type: 'polyline',
              style: {
                radius: 10,
                offset: 30,
                stroke: '#40a9ff',
                lineWidth: 1.5,
                startArrow: false,
                endArrow: {
                  path: G6.Arrow.triangle(8, 10, 3),
                  fill: '#40a9ff',
                  stroke: '#40a9ff'
                }
              },
              labelCfg: {
                autoRotate: true,
                refY: -10,
                style: {
                  fill: '#666666',
                  fontSize: 12
                }
              }
            },
            fitView: true,
            fitViewPadding: 10,
            animate: true,
            minZoom: 0.1,
            maxZoom: 1,
            zoom: 0.1,  // 设置初始缩放比例
            plugins: [new G6.Minimap()]
        });

        window.addEventListener('resize', () => {
            if (!graph.value || graph.value.get('destroyed')) return;
            const container = proxy.$refs.container;
            const width = container.scrollWidth || 800;
            const height = container.scrollHeight || 800;
            graph.value.changeSize(width, height);
            // 重新布局并适应视图，保持缩放比例
            graph.value.updateLayout();
            graph.value.fitView(10);
            graph.value.zoomTo(0.1);
        });
    };
  
      
    async function loadGraphData() {
        try {
          const res = await getGraphData(props.projectId);
          console.log('Graph data response:', res.data);
          
          if (!res.data || !res.data.nodes || !res.data.edges) {
            proxy.$message.error('返回的数据格式不正确');
            return;
          }

          // 转换数据格式以适应G6
          const nodes = res.data.nodes.map(node => ({
            id: node.id.toString(),
            label: node.label || '未命名节点',
            type: 'circle',
            style: {
              fill: '#C6E5FF',
              stroke: '#5B8FF9',
              lineWidth: 1
            },
            labelCfg: {
              position: 'bottom',
              offset: 5,
              style: {
                fill: '#000000',
                fontSize: 12
              }
            }
          }));
          
          const edges = res.data.edges.map(edge => ({
            source: edge.from.toString(),
            target: edge.to.toString(),
            label: edge.label || '',
            style: {
              stroke: '#aaa',
              lineWidth: 1,
              endArrow: {
                path: G6.Arrow.triangle(8, 8, 0),
                fill: '#aaa'
              }
            },
            labelCfg: {
              autoRotate: true,
              style: {
                fill: '#666',
                fontSize: 12
              }
            }
          }));

          console.log('Processed nodes:', nodes);
          console.log('Processed edges:', edges);

          if (nodes.length === 0) {
            proxy.$modal.msgWarning('没有节点数据');
            return;
          }

          graphData.value = { nodes, edges };
          
          // 确保图形容器已经准备好
          proxy.$nextTick(() => {
            if (!graph.value) {
              proxy.$modal.msgError('Graph instance not initialized');
              return;
            }
            
            const container = proxy.$refs.container;
            if (!container) {
              proxy.$modal.msgError('Graph container not found');
              return;
            }

            // 更新图形大小
            const width = container.scrollWidth || 800;
            const height = container.scrollHeight || 600;
            graph.value.changeSize(width, height);
            
            // 设置数据并渲染
            graph.value.data(graphData.value);
            graph.value.render();
            
            // 自动调整布局和视图
            graph.value.fitView();
          });
        } catch (error) {
          console.error('加载图谱数据失败:', error);
          proxy.$modal.msgError('加载图谱数据失败');
        }
      };
      
      async function handleSearch() {
        if (!searchKeyword.value) {
          await loadGraphData();
          return;
        }
        try {
          const res = await searchGraph({
            keyword: searchKeyword.value,
            projectId: props.projectId
          });

          console.log('Search response:', res.data);
          
          // 转换数据格式以适应G6
          const nodes = res.data.nodes.map(node => ({
            id: node.id.toString(),
            label: node.label,
            type: 'circle'
          }));
          
          const edges = res.data.edges.map(edge => ({
            source: edge.from.toString(),
            target: edge.to.toString(),
            label: edge.label
          }));
  
          graphData.value = { nodes, edges };
          graph.value.data(graphData.value);
          graph.value.render();
          graph.value.fitView();
        } catch (error) {
          proxy.$modal.msgError('搜索失败');
        }
      };
 
  // 暴露方法给父组件
  defineExpose({
    loadGraphData
  });
  </script>
  
  <style scoped>
  .knowledge-graph {
    padding: 20px;
    height: 100%;
  }
  .graph-container {
    height: 700px;
    border: none;
    margin-top: 20px;
    background-color: #ffffff;
    position: relative;
    border-radius: 8px;
    box-shadow: 0 4px 20px 0 rgba(0,0,0,0.1);
  }

  /* 缩放按钮样式 */
  .g6-component-toolbar {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: #fff;
    padding: 4px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  /* 小地图样式 */
  .g6-minimap {
    position: absolute;
    bottom: 10px;
    right: 10px;
    background: #fff;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  </style>