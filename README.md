# LLM Behavior Lab

LLM Behavior Lab 是一个面向社会科学、心理学、HCI 与 AI 评测研究者的“大语言模型行为实验平台”概念项目。

核心设想：研究者只输入想研究的问题，平台通过 agent 辅助澄清假设、拆分实验条件、生成可复现 prompt、调度多个模型运行、记录完整实验元数据，并输出初步统计和可视化报告。长期目标是把人类在线实验平台的研究流程严谨性，与 LLM eval 工具的自动化、可复现、跨模型运行能力结合起来。

## 当前交付物

- [调研综述](docs/research_scan.md)：人类行为/社会实验平台、国内平台、LLM eval 与 synthetic participant 工具的初步扫描。
- [产品需求文档](docs/product_requirements.md)：目标用户、问题定义、MVP 范围、需求优先级、指标与风险。
- [核心功能与架构草案](docs/core_features.md)：核心模块、实验 schema、运行流程、数据模型与分析能力。
- [可运行网站](app/public/index.html)：本地全流程 web app，支持输入研究需求、Copilot 澄清、任务拆解、协议确认、prompt 检查、preview run、正式 run、结果分析与导出。
- [交互式 Demo](demo/index.html)：一个静态前端原型，展示从研究想法、协议生成、prompt 检查、preview run 到初步结果分析的核心体验。

## 运行网站

无需安装依赖，直接运行：

```bash
node app/server.mjs
```

默认地址：

```text
http://127.0.0.1:8780/
```

当前版本默认使用内置 simulator，所以不需要外部 API 也能完整跑通。模型设置页保留了 OpenAI-compatible endpoint/API key 入口，用于后续接真实模型。

## 初步定位

一句话定位：

> 从一句自然语言研究想法，生成、运行并分析可复现的多模型行为实验。

MVP 不优先做“通用聊天机器人评测平台”，而优先做“研究协议到实验运行”的闭环：

1. 研究问题澄清与实验协议生成。
2. 条件、prompt、模型、采样参数的版本化管理。
3. 多模型/多条件批量运行与成本控制。
4. 原始响应、模型参数、时间戳、prompt hash、评分规则的可追溯存储。
5. 初步统计、可视化、可导出的研究报告。

## 建议下一步

1. 选 2-3 个代表性实验案例做概念验证，例如 trolley dilemma、ultimatum game、framing effect、IAT 文本版本。
2. 用一个轻量 schema 定义实验协议，先支持文本输入/文本输出和 forced-choice 输出。
3. 做一个最小 runner，接入 2-3 个模型提供方或 OpenAI-compatible endpoint。
4. 跑出第一份“跨模型 x 条件”的可视化分析报告。
