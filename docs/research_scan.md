# 初步调研：行为实验平台与 LLM 行为实验基础设施

调研日期：2026-05-21

## 1. 调研范围

本次调研围绕三类平台：

1. 人类被试招募、问卷与在线行为实验平台，例如 Prolific、Pavlovia、Gorilla、Qualtrics、MTurk、Sona、脑岛、见数 Credamo、问卷星、腾讯问卷。
2. 开放科学、预注册与研究项目管理平台，例如 OSF。
3. LLM eval、synthetic participant、agent-based simulation 相关工具，例如 OpenAI Evals、Inspect AI、lm-evaluation-harness、HELM、SweetBean、DiSCoKit、Concordia。

目标不是完整竞品报告，而是提炼：一个 LLM 行为实验平台应继承哪些成熟研究流程，以及现有工具没有覆盖的空白。

## 2. 人类实验平台观察

### 2.1 被试招募与样本质量

Prolific 的强项是高质量、可筛选的人类样本池、快速回收、与外部工具/API 的衔接。其研究者页面强调“保护免受欺诈和 bot”“平均 2 小时内获得完整数据集”“通过链接或 API 集成常用工具”。这说明平台价值不只是招募人，而是把样本质量、速度和工具链集成包装成研究基础设施。

Amazon Mechanical Turk 更像通用 crowdsourcing 基础设施。它提供按需 workforce、界面或 API 直接集成，常用于 microwork、人类洞察、机器学习数据标注与 human-in-the-loop 验证。启发是：平台需要把“批量分发任务”和“结果回收”做得足够抽象，但用于学术研究时必须额外补足质量控制、伦理和被试权益机制。

Sona Systems 代表大学内部 participant pool 管理范式：课程学分/现金激励、实验报名、到场管理、研究者和管理员协作。它提示 LLM 行为实验平台如果面向高校实验室，应支持课题组、学生、导师、项目管理员的权限分层。

国内方面，见数 Credamo、问卷星、腾讯问卷都在“样本服务 + 问卷设计 + 数据分析/质控”上做整合。Credamo 的 App Store 描述提到 300 万+自有样本、在线随机情境实验、A/B Test、随机因子实验、被试报酬发放和特定样本精准推送。腾讯问卷强调实名样本、账号验证、AI 识别无效答卷、300 万+真实样本和 100+画像标签。问卷星强调样本服务、620 万+样本、多重质控、从问卷设计到数据分析。

### 2.2 在线实验构建与运行

Pavlovia 是在线运行和分享实验的平台，和 PsychoPy 深度集成，并支持 jsPsych 与 lab.js。它说明研究者需要的不只是问卷，还包括实验任务托管、脚本运行、数据保存和跨工具兼容。

Gorilla 是无代码在线实验构建平台，强调图形界面、问卷构建、reaction-time task、实验结构设计、游戏化、多参与者任务、版本控制、协作、伦理/隐私/合规支持。它对 LLM 平台的启发是：研究者不应被迫写脚本才能完成实验设计，复杂实验也需要版本、协作、审查和模板库。

jsPsych 是浏览器中创建行为实验的 JavaScript 框架，围绕 plugin、timeline 与数据收集构建实验。它是“实验 DSL/框架”的代表，提示 LLM 行为实验也需要一个可编译、可读、可导出的实验协议格式。

脑岛是国内心理学在线实验公共平台。中国心理学会会议摘要中描述其整合了实验、问卷、研究设计、被试管理、数据质量管控、主试-被试通信、科研交流、公民科学数据收集、心理知识传播等功能，并在 Stroop、IAT、心理旋转任务上与线下实验室和 Pavlovia 比较数据质量。启发是：本土研究平台需要兼顾中文实验范式、研究社区、数据质量验证和教育传播。

### 2.3 研究项目管理与可重复性

OSF 是研究项目生命周期管理工具，支持文件、数据、代码、protocol 集中管理，访问权限控制，第三方工具集成，预注册和时间戳只读快照。对 LLM 行为实验平台而言，“prompt、模型版本、参数、评分规则、原始输出、分析脚本”的快照化，比普通问卷项目更关键。

## 3. LLM eval 与 synthetic participant 工具观察

### 3.1 LLM eval 基础设施

OpenAI Evals / Evals API 把 eval 流程拆为：描述任务、用测试输入运行 eval、分析结果并迭代 prompt。其文档也指出 eval 需要 data source schema 和 testing criteria/graders。这为本项目提供了基础模型：实验不是一次 prompt 调用，而是“数据源 + prompt 模板 + 模型 + grader + run + report”的组合。

Inspect AI 是 UK AI Security Institute 与 Meridian Labs 开发的开源 LLM evaluation 框架，支持 coding、agentic task、reasoning、knowledge、behavior、多模态评测；核心概念包含 dataset、solver、scorer；也提供日志、可视化、并发、批处理、agent eval、sandbox 等能力。它证明“行为评测”已经成为 LLM eval 的明确方向，但它仍偏开发者/脚本工作流。

EleutherAI 的 lm-evaluation-harness 是标准化 LLM benchmark 运行框架，支持大量学术 benchmark、商业 API、本地模型、自定义 prompt 和 metrics，并强调公开 prompt 带来的可复现性和论文可比性。它适合作为底层执行引擎或参考，但不覆盖“从研究问题自动生成实验设计”的上层产品体验。

HELM 强调 holistic evaluation：多场景、多指标、统一条件、公开原始 prompt 与 completions。它对本平台最重要的启发是：LLM 行为实验必须避免只看单一 accuracy，应同时记录 robustness、bias、toxicity、efficiency、calibration 等维度，并让原始输出可复查。

Promptfoo、LangSmith 等更偏应用开发者的 prompt/model/RAG 测试与回归；可作为“prompt 对比、CI、回归测试”的参考，但本项目的差异是社会科学实验范式、条件设计、统计分析和研究报告。

### 3.2 Synthetic participant 与人机实验桥接

SweetBean 是一个 Python DSL，可声明式定义刺激序列，并编译为 jsPsych 人类实验或 text-based synthetic participant 实验。它已经直接触及本项目核心命题：同一实验协议应能跑人类被试，也能跑 LLM 被试。区别在于 SweetBean 更像代码工具，本项目要把它产品化、agent 化、可视化和多模型化。

DiSCoKit 针对 survey research 中嵌入 live LLM 体验的困难，提出把 LLM 交互部署到 JavaScript-enabled survey 平台（如 Qualtrics）的工具。它说明人类实验平台和 LLM API 的桥接已成为实际研究痛点，尤其是日志、AI 行为操纵和实验设计。

Concordia 代表生成式 agent-based modeling：使用 LLM 作为 agent 的常识、行动和记忆组件，在物理、社会或数字环境中进行模拟。它说明本项目未来可从“单模型回答实验题”扩展到“多 agent 社会互动实验”，但这不应是 MVP 起点。

“Out of One, Many” 等 silicon sample 研究提出 LLM 可以在一定条件下模拟特定人群反应分布，但也引发 algorithmic fidelity、代表性、偏差和因果解释问题。本项目必须默认把 LLM 实验结果标注为“模型行为证据”，而不是直接等同于人类行为证据。

## 4. 竞品/参考能力矩阵

| 类型 | 代表平台 | 核心能力 | 对本项目的启发 | 未覆盖空白 |
|---|---|---|---|---|
| 被试招募 | Prolific, MTurk, CloudResearch, Sona | 样本池、筛选、报酬、API、质量控制 | 样本质量和流程控制是平台核心价值 | 不生成 LLM 实验条件和 prompt |
| 问卷/调研 | Qualtrics, 问卷星, 腾讯问卷, Credamo | 问卷设计、样本服务、统计图表、协作 | 低门槛设计、样本服务和可视化是标配 | 缺少跨模型运行与 prompt 版本追踪 |
| 行为实验 | Pavlovia, Gorilla, jsPsych, 脑岛 | 在线实验任务、reaction time、随机化、实验托管 | 需要实验结构、条件、block/trial、数据质量管控 | LLM synthetic participant 支持有限或偏代码化 |
| 开放科学 | OSF | 项目管理、预注册、权限、时间戳快照 | prompt/模型/分析方案需要可冻结、可引用 | 不执行模型实验 |
| LLM eval | OpenAI Evals, Inspect AI, lm-eval-harness, HELM | 数据集、solver/prompt、grader、模型运行、日志 | 可复现运行、模型参数和 grader 是底层骨架 | 对非工程研究者不够友好，社会实验设计弱 |
| Synthetic participant | SweetBean, DiSCoKit, Concordia | LLM 被试、survey/实验桥接、agent simulation | 同一协议跑人类/模型是关键方向 | 需要产品化、权限、报告、成本和团队协作 |

## 5. 机会点

当前工具链存在明显断层：

1. 社会科学研究者会提出自然语言研究问题，但现有 LLM eval 工具多要求手写数据集、prompt 和代码。
2. 人类实验平台成熟处理招募、随机化、质控、伦理和报告，但不擅长多模型 API 调度、prompt 版本追踪、模型漂移记录。
3. LLM 行为实验特别容易受 prompt wording、temperature、模型版本、系统消息、输出解析规则影响；这些必须成为一等公民。
4. 研究者需要的不只是“跑结果”，而是“生成可审查的实验设计、预注册材料、方法段、结果图表和复现实验包”。

因此，本项目最有价值的定位是：

> LLM 行为实验的 protocol compiler + experiment runner + analysis workspace。

## 6. 初步产品假设

1. 研究者愿意用自然语言描述研究问题，但会要求 agent 产出的实验设计可编辑、可审查、可导出。
2. MVP 应支持 forced-choice、Likert、free text coding 三类响应格式，覆盖大部分早期行为实验。
3. 相比“接入最多模型”，早期更重要的是完整记录模型、prompt、参数、成本、错误、重试和原始输出。
4. 平台应默认支持“人类基线”接口：把同一协议导出到 Qualtrics/jsPsych/Pavlovia/脑岛或生成被试问卷材料。
5. 初步统计报告必须谨慎表达，只做 exploratory analysis，并明确模型结果不等同于人类数据。

## 7. 主要风险

- 研究有效性风险：agent 自动生成的条件可能混入 confound，需要 protocol review 和设计检查清单。
- Prompt 偏差风险：prompt wording 可能诱导模型；需要多 prompt variants、blind condition labels 和版本化。
- 模型漂移风险：API 模型更新后结果不可复现；需要记录 provider model id、run time、参数和 raw outputs。
- 成本风险：全因子、多模型、多重复采样会快速放大 API 成本；需要预算估计、限额和 preview run。
- 伦理风险：把 LLM 输出误称为人类行为证据；需要报告模板中强制区分 model behavior、human baseline、synthetic participant。
- 数据安全风险：用户自带 API key 和实验数据需要加密、最小权限、审计日志和可删除策略。

## 8. 来源链接

- Prolific research platform: https://www.prolific.com/researchers
- Prolific API participant targeting: https://docs.prolific.com/documentation/core-concepts/finding-the-right-participants
- MTurk: https://www.mturk.com/
- Sona Systems: https://www.sona-systems.com/
- Pavlovia overview via Yale BrainWorks: https://research.yale.edu/cores/brainworks/pavlovia
- Gorilla Experiment Builder: https://gorilla.sc/
- jsPsych: https://www.jspsych.org/v7/
- 脑岛官网: https://www.naodao.com/
- 脑岛平台与数据质量摘要: https://xlxy.zjnu.edu.cn/_upload/article/files/25/49/0f6f028a4bc8883ca072287791fb/6abb8b76-432d-43eb-b21d-6768aa23c614.pdf
- Credamo 见数 App Store 描述: https://apps.apple.com/cn/app/credamo%E8%A7%81%E6%95%B0/id1562273737
- 腾讯问卷: https://cloud.tencent.com/product/survey
- 问卷星样本服务: https://www.wjx.cn/app/themehtml/sample.aspx
- Qualtrics survey platform: https://www.qualtrics.com/en-gb/lp/survey-platform/
- OSF: https://www.cos.io/products/osf
- OpenAI Evals API guide: https://developers.openai.com/api/docs/guides/evals
- OpenAI Evals GitHub: https://github.com/openai/evals
- Inspect AI: https://inspect.aisi.org.uk/
- lm-evaluation-harness: https://github.com/EleutherAI/lm-evaluation-harness
- HELM paper: https://arxiv.org/abs/2211.09110
- Stanford HAI HELM brief: https://hai.stanford.edu/policy/improving-transparency-in-ai-language-models-a-holistic-evaluation
- SweetBean: https://autoresearch.github.io/sweetbean/
- SweetBean LLM synthetic participant guide: https://autoresearch.github.io/sweetbean/User%20Guide/llm_synthetic_participant/
- DiSCoKit: https://arxiv.org/abs/2602.11230
- Concordia: https://deepmind.google/research/publications/64717/
- Out of One, Many: https://arxiv.org/abs/2209.06899
