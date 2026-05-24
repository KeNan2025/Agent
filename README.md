# 基于 Agentic AI 的上市公司扫雷预警系统

预测上市公司未来 30/60/90 天内被监管问询的概率，识别关键风险因素并生成可解释的预警报告。

## 架构

```
Frontend (React + Ant Design)  →  Backend (FastAPI)  →  Agent Pipeline (LangGraph-style)
        :3000                         :8000
```

**技术栈**：Python 3.11 / FastAPI / React 18 / TypeScript / Ant Design / CatBoost + LightGBM / Docker Compose

## 快速启动

### Docker Compose（推荐）

```bash
cd regulatory-risk-system
docker-compose up --build
```

### 手动启动

```bash
# 后端
cd regulatory-risk-system/backend
pip install -r requirements.txt
python run.py

# 前端
cd regulatory-risk-system/frontend
npm install
npm run dev
```

启动后访问：前端 http://localhost:3000 | API 文档 http://localhost:8000/docs

## 核心功能

- **风险排行榜** — 全市场公司问询概率排行，支持行业筛选与多窗口切换
- **单公司深度扫雷** — 概率仪表盘、SHAP 特征分解、风险因素证据引用、相似案例匹配
- **批量扫雷** — 批量输入公司代码，一键风险扫描
- **Agent 推理追踪** — 7 步推理链路可视化，100% 可追踪

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/scan/single` | 单公司扫雷 |
| POST | `/api/v1/scan/batch` | 批量扫雷 |
| GET | `/api/v1/ranking` | 风险排行榜 |
| GET | `/api/v1/report/{code}` | 预警报告 |
| GET | `/api/v1/trace/{code}` | Agent 推理日志 |

## 项目结构

```
regulatory-risk-system/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI 入口
│   │   ├── api/routes.py          # API 路由
│   │   ├── agents/orchestrator.py # Agent 编排引擎
│   │   ├── models/schemas.py      # 数据模型
│   │   └── mock_data/generator.py # Mock 数据生成
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   └── pages/                 # Dashboard / CompanyDetail / BatchScan
│   └── package.json
└── docker-compose.yml
```
