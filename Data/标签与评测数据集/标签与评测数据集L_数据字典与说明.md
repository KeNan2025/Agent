# 标签与评测数据集说明文档

本数据集以历史监管问询发生情况作为预测标签，按时间切分了训练集、验证集和测试集（比例 7:1:2），同时提供了基于真实监管问询函的评测参考答案（Ground Truth），用于评估大模型的语义抽取、归因解释和案例匹配能力。

## 文件说明

### 1. `dataset_split_labels.csv`
核心分类标签与数据集切分文件。
- **secucode (公司代码)**：目标企业的证券代码。
- **is_risky (是否风险企业)**：预测标签（1代表有被监管问询的风险，0代表合规安全）。
- **company_type (企业类型)**：企业的属性（如国有企业、民营企业等）。
- **split (数据集切分)**：标记当前企业所属的集合，分别为 `Train` (训练集 70%)、`Validation` (验证集 10%)、`Test` (测试集 20%)。

### 2. `evaluation_ground_truth.csv`
面向验证集和测试集企业提取的“标准答案”（Ground Truth），源于底层 PostgreSQL 数据库中的人工标注和规则提取结果。
- **secucode (公司代码)**：被问询的企业代码。
- **publish_date (发布日期)**：问询函的下发日期。
- **announcement_title (公告标题)**：监管函件的完整官方标题。
- **regulatory_focus_points_json (监管关注点/风险诱因 JSON)**：结构化的问询问题详情，包含具体的监管关注点、证据片段、相关财务指标质询等。作为评测系统打分的标准参考答案。

## 使用建议
1. 参赛者不得在模型训练阶段将 `Validation` 和 `Test` 集合的数据喂给模型。
2. 评测系统的构建可直接读取 `evaluation_ground_truth.csv` 中的 JSON 结构，与参赛大模型生成的归因解释进行 ROUGE/BLEU 或 LLM-as-a-Judge 相似度对比。
