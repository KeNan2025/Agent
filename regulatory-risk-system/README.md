# 上市公司扫雷预警系统

基于 Agentic AI 的上市公司监管问询概率预测与扫雷预警系统

## 系统架构

```
frontend (React + Ant Design)  →  backend (FastAPI)  →  Agent Pipeline
     :3000                           :8000              (LangGraph-style)
                                       ↓
                               Mock Data / Real Data
```

## 快速启动

### 方式一：Docker Compose（推荐）

```bash
docker-compose up --build
```

访问:
- 前端界面: http://localhost:3000
- 后端 API: http://localhost:8000
- API 文档: http://localhost:8000/docs

### 方式二：分别启动

#### 后端

```bash
cd backend
pip install -r requirements.txt
python run.py
```

后端运行在 http://localhost:8000

#### 前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 http://localhost:3000

## 核心功能

### 1. 风险排行榜 (Dashboard)
- 全市场 200 家公司的问询概率排行
- 支持行业筛选、预测窗口切换（30/60/90天）
- 风险等级颜色标注（红/橙/绿）
- 搜索过滤功能

### 2. 单公司深度扫雷
- 问询概率仪表盘
- SHAP 特征贡献分解图
- 关键风险因素详情（含原文证据引用）
- Top-5 相似历史问询案例
- Agent 推理链路完整追踪
- Markdown 格式完整预警报告

### 3. 批量扫雷
- 支持批量输入公司代码
- 批量风险扫描与结果排序
- 一键查看单公司详情

### 4. Agent 推理追踪
- 7 步完整推理链路可视化
- 每步输入/输出/Skill调用/耗时/Token数
- Master Planner 动态路由决策过程
- 100% 可追踪

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/scan/single | 单公司扫雷 |
| POST | /api/v1/scan/batch | 批量扫雷 |
| GET | /api/v1/ranking | 风险排行榜 |
| GET | /api/v1/report/{code} | 获取预警报告 |
| GET | /api/v1/trace/{code} | Agent推理日志 |
| GET | /api/v1/companies | 公司列表 |
| GET | /api/v1/industries | 行业列表 |

## 项目结构

```
regulatory-risk-system/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口
│   │   ├── config.py            # 配置
│   │   ├── api/routes.py        # API 路由
│   │   ├── models/schemas.py    # 数据模型
│   │   ├── agents/orchestrator.py # Agent 编排引擎
│   │   └── mock_data/generator.py # Mock 数据生成器
│   ├── requirements.txt
│   ├── Dockerfile
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # 主应用
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx    # 风险排行榜
│   │   │   ├── CompanyDetail.tsx # 公司详情
│   │   │   └── BatchScan.tsx    # 批量扫雷
│   │   └── api/client.ts        # API 客户端
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

## 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | Python 3.11 + FastAPI |
| 前端 | React 18 + TypeScript + Ant Design |
| Agent | LangGraph-style StateGraph |
| 预测 | CatBoost + LightGBM + TabPFN-2.5 (mock) |
| 部署 | Docker Compose + Nginx |

## 切换到真实数据

1. 替换 `backend/app/mock_data/generator.py` 中的数据源为真实数据库连接
2. 在 `backend/app/agents/orchestrator.py` 中替换 `MockLLM` 为真实 LLM API 客户端
3. 设置环境变量:
   ```
   LLM_MODE=real
   LLM_API_KEY=your-api-key
   LLM_BASE_URL=https://api.example.com
   ```

## 赛题对标

| 赛题要求 | 系统实现 |
|---------|---------|
| 概率预测 AUC≥0.75 | 多模型融合框架已搭建，接入真实数据后训练 |
| 关注点分类准确率≥80% | 8大类40+标签体系已构建，LLM结构化抽取 |
| 证据片段召回率≥85% | RAG检索+原文锚定+后处理校验框架 |
| 案例Top-5命中率≥70% | 混合检索（语义+规则）引擎 |
| 推理链可追踪率100% | LangGraph StateGraph + 全链路trace |
| 可挂载Skill | MCP协议封装设计 |
