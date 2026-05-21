# 产品需求文档：LLM Behavior Lab

版本：0.1
日期：2026-05-21

## 1. 产品概述

LLM Behavior Lab 是一个面向大语言模型行为实验的平台。用户输入自然语言研究想法后，平台通过 agent 协助生成实验协议、条件、prompt、模型配置、运行计划和分析方案；随后自动调度多个 LLM 完成实验，收集数据，并生成初步可视化和统计报告。

产品要解决的不是“如何写一次 prompt”，而是“如何把 LLM 当作可观测、可重复、可比较的实验对象来研究”。

## 2. 问题定义

研究者进行 LLM 行为实验时常见痛点：

1. 研究意图模糊：假设、变量、条件、指标没有被明确拆解。
2. Prompt 不可复现：系统消息、用户消息、few-shot 示例、输出格式、模型参数经常散落在代码或聊天记录里。
3. 条件不平衡：不同实验条件可能因 wording、长度、顺序和上下文差异引入 confound。
4. 模型接入重复劳动：每个项目都要重新接 API、处理 rate limit、错误重试和成本记录。
5. 数据链路不完整：原始输出、解析结果、评分规则、模型版本、时间戳、token 成本没有统一记录。
6. 初步分析耗时：研究者需要快速知道条件差异、模型差异、输出分布和异常样本。
7. 研究报告不规范：方法段、材料、参数、统计结果和限制往往需要手工整理。

## 3. 目标用户

### 3.1 核心用户

- 心理学、社会学、传播学、政治学、行为经济学研究者：想把经典社会/行为实验迁移到 LLM 或比较人类与模型。
- HCI/人机交互研究者：研究 AI 角色、AI confederate、LLM 交互对人类行为的影响。
- AI safety / eval 研究者：研究模型在道德判断、偏见、合作、风险偏好、说服、策略行为等任务中的稳定性。

### 3.2 次级用户

- 企业 AI 产品团队：做 prompt/model behavior regression，理解模型更新对行为表现的影响。
- 教学场景：老师带学生快速复现实验范式，比较不同模型。
- 数据/平台管理员：管理 API key、预算、团队权限和合规审计。

## 4. 产品目标

### 4.1 MVP 目标

1. 让研究者能在 30 分钟内从研究问题生成一个可审查的实验协议。
2. 支持至少 3 种实验响应类型：forced-choice、Likert/rating、free text with coding。
3. 支持多条件、多模型、多重复采样的批量运行。
4. 完整记录每次 run 的 prompt、模型、参数、输出、解析、评分、成本和错误。
5. 生成一份包含描述统计、条件比较、模型比较和可视化图表的初步报告。

### 4.2 非目标

- MVP 不做完整人类被试招募市场。
- MVP 不承诺 LLM 结果可替代人类行为数据。
- MVP 不优先支持复杂多人 agent society simulation。
- MVP 不做通用 BI 或高级统计建模平台。
- MVP 不做闭源模型能力排行榜，除非用户明确发布公共结果。

## 5. 核心用户旅程

1. 用户输入研究想法：例如“我想比较不同模型在损失框架和收益框架下的风险偏好差异”。
2. Agent 追问/自动澄清：研究假设、因变量、条件、刺激材料、输出格式、目标模型、预算。
3. 平台生成实验协议：条件矩阵、prompt 模板、模型列表、重复次数、随机化策略、评分规则、分析计划。
4. 用户审查并编辑：对 wording、条件标签、输出 schema、伦理声明、预算做确认。
5. 平台执行小样本 preview run：检查输出可解析性、成本、异常和 prompt confound。
6. 用户启动正式 run：runner 调度模型 API，记录原始响应和元数据。
7. 平台生成结果：可视化、统计比较、异常样本、模型差异摘要、导出数据。
8. 用户导出：实验协议、prompt、原始数据、分析报告、方法段、OSF/论文补充材料包。

## 6. MVP 功能需求

### P0：必须有

- 自然语言研究意图输入与结构化 protocol draft。
- 条件矩阵生成：between/within factors、levels、stimuli、trial 列表。
- Prompt 模板管理：system/developer/user message、变量插值、输出 schema、版本 hash。
- 模型配置：provider、model id、temperature、top_p、max_tokens、seed/重复采样策略。
- API key 管理：用户自带 key 与平台 key 两种模式；至少提供加密存储与不回显。
- 实验 runner：并发、rate limit、重试、错误记录、成本估算与限额。
- 数据记录：raw response、parsed response、condition、trial、model config、timestamp、token usage、prompt version。
- 基础分析：频数/均值/置信区间、条件差异、模型差异、响应分布、异常输出列表。
- 报告导出：Markdown/CSV/JSON，包含方法、参数、图表和限制。

### P1：应该有

- Prompt 平衡检查：长度、敏感词、条件标签泄漏、leading wording。
- Preview run 诊断：解析失败率、拒答率、重复率、成本预测。
- Grader 支持：规则评分、正则/JSON schema、LLM-as-judge、人工复核字段。
- 实验模板库：道德困境、ultimatum game、framing effect、anchoring、trust game、IAT 文本版。
- 协作权限：owner/editor/viewer，协议 review 与评论。
- Human baseline 导出：Qualtrics/jsPsych/Pavlovia/脑岛可用材料或问卷结构。
- 预注册/开放科学导出：protocol snapshot、analysis plan、OSF 友好结构。

### P2：未来增强

- 人类被试平台集成：Prolific、Credamo、问卷星、腾讯问卷等样本服务或跳转管理。
- 多轮互动实验：conversation task、negotiation、persuasion、social exchange。
- 多 agent simulation：角色、记忆、环境、互动规则和 emergent behavior。
- 高级统计：mixed-effects model、Bayesian model、power simulation、multiple comparison correction。
- 公共实验库：可复现实验、复现包、公共结果、引用 DOI。
- 组织级成本、合规和审计。

## 7. 非功能需求

### 7.1 可复现性

- 每个实验协议、prompt、模型配置、评分规则和分析计划都必须有版本号。
- 每次 run 都要保存不可变快照。
- 导出包必须包含足以重跑实验的机器可读配置。

### 7.2 安全与隐私

- API key 加密存储，不在日志、导出、前端响应中明文出现。
- 支持用户删除 key、删除实验数据、导出审计记录。
- 对上传 stimuli、human baseline 数据和敏感研究材料做访问控制。

### 7.3 成本控制

- 运行前展示预计 token、费用、最大费用和模型调用次数。
- 支持硬预算上限和 run 中止。
- 对失败重试、解析失败重跑和 LLM grader 额外成本单独计量。

### 7.4 可靠性

- 所有模型调用都要有 retry、timeout、rate limit 和错误分类。
- 部分模型失败不应导致整个实验不可用。
- 支持恢复 interrupted run。

### 7.5 研究表达

- 报告必须区分 exploratory 和 confirmatory。
- 报告必须区分 model behavior、synthetic participant 和 human participant。
- 自动生成结论时避免因果过度解释。

## 8. 核心指标

- Time to first protocol：从输入想法到生成可审查协议的时间。
- Preview pass rate：preview run 中输出可解析率。
- Reproducibility completeness：run 是否包含完整 prompt/model/scoring/data 元数据。
- Cost prediction error：预计成本与实际成本偏差。
- User edit burden：用户对 agent 生成协议的平均修改比例。
- Experiment completion rate：正式 run 成功完成比例。
- Report usefulness：用户是否认为初步分析足以决定下一步。

## 9. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| Agent 生成错误实验设计 | 结论无效 | 强制 protocol review、设计 checklist、条件平衡诊断 |
| Prompt 引入 confound | 条件差异不可解释 | prompt diff、长度检查、blind labels、多 prompt variants |
| LLM-as-judge 偏差 | 评分不稳定 | 保留规则评分优先、抽样人工复核、judge calibration |
| 模型版本漂移 | 结果难复现 | 记录 model id、provider、run timestamp、raw outputs、参数 |
| 成本爆炸 | 用户不敢运行 | preview、预算上限、抽样建议、批处理 |
| 用户误读 synthetic data | 学术风险 | 报告模板强制 limitation 和 model behavior 标签 |
| API key 泄漏 | 安全事故 | 加密、最小权限、日志脱敏、key 不可导出 |

## 10. 开放问题

1. MVP 是否应优先做 SaaS web app，还是先做本地/私有部署工具？
2. 目标用户第一阶段更偏社会科学研究者，还是 AI eval 工程研究者？
3. 平台 key 模式如何定价和控制滥用？
4. Human baseline 是只导出材料，还是直接集成 Prolific/Credamo/问卷星？
5. 是否需要在 MVP 中支持中文和英文双语实验？
6. LLM 模型输出的“重复采样 n”应如何推荐，是否提供默认统计功效提示？

## 11. 初步路线图

### Phase 0：概念验证

- 定义 experiment protocol schema。
- 手工接入 2-3 个模型。
- 跑 2 个经典实验范式。
- 输出 CSV + Markdown 报告。

### Phase 1：MVP

- Web workspace。
- Agent protocol builder。
- Prompt/version/model/run 数据链路。
- 基础图表和分析报告。
- 用户自带 API key。

### Phase 2：研究工作流

- 模板库。
- 协作 review。
- OSF/预注册导出。
- Human baseline 材料导出。
- LLM grader 和人工复核。

### Phase 3：平台化

- 多组织权限。
- 公共实验库。
- 人类样本平台集成。
- 高级统计和多 agent 实验。
