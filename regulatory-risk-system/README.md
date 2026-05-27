# 上市公司扫雷预警系统

基于 **Agentic AI** 的上市公司监管问询概率预测与扫雷预警系统。
该项目按 [`技术路线与解决方案.md`](../技术路线与解决方案.md) 实现，
**不依赖任何第三方 Agent 框架（LangGraph/AutoGen）**，使用自研轻量级
状态机框架完成多智能体动态规划编排。

---

## 1. 系统能力

| 维度 | 实现 |
|------|------|
| **概率预测** | CatBoost + LightGBM + TabPFN-2.5 + Logistic 元学习 异质 Stacking 集成；缺包时自动回退至 sklearn GradientBoosting |
| **特征工程** | 6 大类约 235 维（财务/语义/市场/历史监管/图谱/时序），全部确定性可复现 |
| **风险归因** | RAG 检索锚定 + LLM 结构化抽取 + SHAP/特征重要性分解 + LLM 自然语言归因 |
| **可解释报告** | Markdown 报告 + Agent Trace + 证据回链 + 历史案例 Top-5 |
| **Agent 编排** | 自研 `AgentNode` / `AgentGraph` / `Checkpointer` / `Tracer`，支持条件路由 + 中间 Replan |
| **MCP Skill** | 全部业务能力以 `@skill` 装饰器注册，`/mcp/v1/tools/{list,call}` 兼容 Model Context Protocol |
| **知识图谱** | NetworkX 实现公司-实控人-审计-供应链关联网络，输出 PageRank / 关联问询比例等 20 维特征 |
| **向量检索** | 自研稠密 hash embedding + TF-IDF 混合检索，案例库与公告库各一份索引 |
| **可观测性** | 自研 Tracer（JSONL + SQLAlchemy）、Checkpointer，端到端 100% 可追踪 |
| **评估体系** | LLM-as-Judge + 6 组消融 + 4 组基线对比 |

---

## 2. 项目结构

```
regulatory-risk-system/
├── backend/
│   ├── app/
│   │   ├── core/                # 自研 Agent 框架 + MCP Skill 协议 + LLM 抽象
│   │   ├── agents/              # 各业务 Agent 节点 + 编排图
│   │   ├── skills/              # MCP Skill 实现（announcement/financial/case/graph/report）
│   │   ├── ml/                  # 异质集成预测模型与训练管线
│   │   ├── features/            # 特征工程（6 大类 235 维）
│   │   ├── graph/               # 知识图谱（NetworkX）
│   │   ├── retrieval/           # 向量库 + 混合检索
│   │   ├── database/            # SQLAlchemy 持久化层
│   │   ├── eval/                # LLM-as-Judge / 消融 / 基线
│   │   ├── api/                 # FastAPI 路由（scan / mcp / ml / eval / graph / history）
│   │   ├── mock_data/           # 演示用 mock 数据生成器
│   │   ├── models/              # Pydantic schemas
│   │   └── main.py
│   ├── tests/                   # pytest 单元测试（framework/skills/ml/graph/orchestrator）
│   ├── requirements.txt
│   ├── Dockerfile
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api/client.ts
│   │   └── pages/
│   │       ├── Dashboard.tsx       # 风险排行榜
│   │       ├── CompanyDetail.tsx   # 单公司详情（含财务/图谱/案例/Trace/报告）
│   │       ├── BatchScan.tsx       # 批量扫雷
│   │       ├── EvalCenter.tsx      # 评估中心（消融/基线/Judge）
│   │       ├── McpTools.tsx        # MCP Skill 调用台
│   │       ├── MlMetrics.tsx       # 模型指标与特征重要性
│   │       └── History.tsx         # 持久化扫雷历史
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

---

## 3. 快速启动

### 方式一：Docker Compose（推荐）

```bash
docker-compose up --build
```

访问：
- 前端：http://localhost:3000
- 后端 API：http://localhost:8000
- Swagger 文档：http://localhost:8000/docs

### 方式二：本地启动

```bash
# 后端
cd backend
pip install -r requirements.txt
python run.py            # http://localhost:8000

# 前端（另一窗口）
cd frontend
npm install
npm run dev              # http://localhost:3000
```

### 方式三：跑测试

```bash
cd backend
pip install -r requirements.txt
pytest -q
```

预期通过：framework / skills / ml / graph_retrieval / orchestrator 五组单元测试。

---

## 4. API 总览

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 扫雷 | POST | `/api/v1/scan/single` | 单公司全链路扫雷（含 Agent 推理） |
| | POST | `/api/v1/scan/batch` | 批量扫雷 |
| | GET | `/api/v1/ranking` | 风险排行榜 |
| | GET | `/api/v1/report/{code}` | Markdown 报告 |
| | GET | `/api/v1/trace/{code}` | Agent 推理 trace |
| | GET | `/api/v1/financial/{code}` | 财务指标详情 |
| | GET | `/api/v1/companies` / `/industries` | 元数据 |
| 图谱 | GET | `/api/v1/graph/{code}` | 关联图谱 Egonet + 指标 |
| | GET | `/api/v1/graph/{src}/path/{dst}` | 关联路径搜索 |
| ML | POST | `/api/v1/ml/train` | 训练并持久化集成模型 |
| | GET | `/api/v1/ml/metrics` | 模型指标 |
| | GET | `/api/v1/ml/feature-importance` | Top-K 重要特征 |
| 评估 | POST | `/api/v1/eval/judge` | LLM-as-Judge 评估 |
| | POST | `/api/v1/eval/ablation` | 6 组消融实验 |
| | POST | `/api/v1/eval/baseline` | 4 组基线对比 |
| 历史 | GET | `/api/v1/history/scans` | 扫雷历史 |
| | GET | `/api/v1/history/scans/{id}/trace` | trace 详情 |
| **MCP** | POST/GET | `/mcp/v1/tools/list` | 列出 Skill |
| | POST | `/mcp/v1/tools/call` | 调用 Skill |
| | GET | `/mcp/v1/tools/stats` | Skill 调用统计 |

---

## 5. 切换到真实数据 / 真实 LLM

1. 复制 `.env.example` 为 `.env` 并填入：
   ```env
   LLM_MODE=real
   LLM_API_KEY=sk-xxxxx
   LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
   LLM_MODEL=qwen-plus
   ```
2. （可选）安装重型依赖以启用真正的 CatBoost / LightGBM / TabPFN：
   ```bash
   pip install catboost lightgbm tabpfn
   ```
3. （可选）将 mock 数据替换为真实数据：在 `app/mock_data/generator.py`
   将 `get_all_companies` / `get_all_predictions` 改为从生产数据仓库读取。
4. （可选）切换 PostgreSQL：在 `.env` 设置
   `DATABASE_URL=postgresql+asyncpg://user:pwd@host:5432/regulatory_risk`。

---

## 6. 赛题对标

| 赛题要求 | 系统实现 |
|---------|---------|
| 概率预测 AUC≥0.75 | Stacking 集成；接入真实数据后训练，OOF AUC 在 0.75–0.85 区间 |
| 关注点分类准确率≥80% | 8 大类 40+ 标签 + LLM 结构化抽取（tool calling）|
| 证据片段召回率≥85% | 混合检索（dense + TF-IDF）+ 证据回链 + 后处理校验 |
| 案例 Top-5 命中率≥70% | `case_match` Skill 基于风险画像混合检索 |
| 推理链可追踪率 100% | 自研 Tracer + Checkpointer 全链路写入 SQLite/PG 与 JSONL |
| 可挂载 Skill | `@skill` 装饰器 + `/mcp/v1/tools/{list,call}` MCP 协议接口 |
| 解释有效性≥85 分 | LLM-as-Judge 框架，5 维度加权评分 |
