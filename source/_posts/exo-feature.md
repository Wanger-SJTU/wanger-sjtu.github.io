---
title: exo 功能列表
date: 2026-04-08 22:22:15
tags: [exo, libp2p, P2P, 功能列表]
toc: false
---


本文档详细列出了 exo 实现的所有功能。

## 📋 目录

<style>
.toc-no-bullets {
  list-style: none;
  padding-left: 0;
}
.toc-no-bullets li {
  list-style: none;
  padding-left: 0;
}
</style>

<ul class="toc-no-bullets">
<li><a href="#核心功能">核心功能</a></li>
<li><a href="#模型推理">模型推理</a></li>
<li><a href="#设备发现与网络">设备发现与网络</a></li>
<li><a href="#集群管理">集群管理</a></li>
<li><a href="#API-兼容性">API 兼容性</a></li>
<li><a href="#监控与信息收集">监控与信息收集</a></li>
<li><a href="#模型管理">模型管理</a></li>
<li><a href="#前端-dashboard">前端 Dashboard</a></li>
<li><a href="#分布式系统特性">分布式系统特性</a></li>
<li><a href="#配置与扩展">配置与扩展</a></li>
</ul>

---

## 核心功能

### 分布式 AI 推理集群

- **多设备协同**：将多台设备组成 AI 集群，共享计算资源
- **自动发现**：设备自动发现彼此，无需手动配置
- **无缝扩展**：添加设备即可提升性能
- **容错机制**：节点故障自动恢复

### 支持的任务类型

- ✅ **文本生成**：大语言模型推理
- ✅ **图像生成**：FLUX、Qwen-Image 等模型
- ✅ **图像编辑**：Qwen-Image-Edit 等模型

---

## 模型推理

### 文本生成引擎

**实现位置**：[`src/exo/worker/engines/mlx/`](src/exo/worker/engines/mlx/)

| 功能 | 说明 |
|------|------|
| **MLX 后端** | 使用 MLX 框架进行推理（Apple Silicon 优化） |
| **自动并行** | 自动决定模型如何分割到多个设备 |
| **张量并行** | 支持跨设备张量并行，2 设备 1.8x 加速，4 设备 3.2x 加速 |
| **KV Cache** | 优化 KV Cache 管理 |
| **流式生成** | 支持流式 token 生成 |
| **多量化支持** | 4bit、6bit、8bit、bf16 等 |
| **采样参数** | temperature、top_p、top_k、repetition_penalty 等 |

**支持的模型系列**：
- DeepSeek (V3.1, V3.2)
- GLM (4.5, 4.7, 5 系列)
- Kimi (K2, K2.5, K2-Thinking)
- Qwen3
- GPT-OSS
- Llama
- 更多...

### 图像生成引擎

**实现位置**：[`src/exo/worker/engines/image/`](src/exo/worker/engines/image/)

| 功能 | 说明 |
|------|------|
| **FLUX.1 系列** | dev、schnell、Kontext、Krea |
| **Qwen-Image 系列** | Qwen-Image、Qwen-Image-Edit |
| **分布式推理** | 图像生成支持跨设备分布式 |
| **输入缓存** | 支持图像编辑的输入分块缓存 |

### 推理优化

**自动并行** ([`auto_parallel.py`](src/exo/worker/engines/mlx/auto_parallel.py))

- 拓扑感知的模型分割
- 考虑设备资源和网络延迟/带宽
- 自动选择最优分割方案

**缓存系统** ([`cache.py`](src/exo/worker/engines/mlx/cache.py))

- 模型权重缓存
- KV Cache 管理
- 内存优化

---

## 设备发现与网络

### 网络发现

**实现位置**：[`rust/networking/src/discovery.rs`](rust/networking/src/discovery.rs)

| 功能 | 说明 |
|------|------|
| **mDNS 发现** | 本地网络自动发现（UDP 5353） |
| **Bootstrap Peers** | 手动配置的备选节点 |
| **网络隔离** | 通过命名空间隔离多个集群 |
| **自动重连** | 每 5 秒重试连接发现的节点 |

### libp2p 网络栈

**实现位置**：[`rust/networking/`](rust/networking/)

| 层级 | 协议 | 说明 |
|------|------|------|
| 传输 | TCP/IP + nodelay | 减少延迟 |
| 加密 | Noise Protocol | 比 TLS 快，安全性足够 |
| 多路复用 | Yamux | 单连接多流复用 |
| 隔离 | Private Network (PNet) | 预共享密钥隔离 |
| 优化 | Upgrade V1 Lazy | 零 RTT 连接 |

### Gossipsub 消息传播

**实现位置**：[`rust/networking/src/gossipsub_mod.rs`](rust/networking/src/gossipsub_mod.rs)

- 最大 8MB 消息支持
- 消息签名验证
- 严格验证模式

### RDMA over Thunderbolt 5

**实现位置**：[`docs/networking_discovery.md`](docs/networking_discovery.md)

| 功能 | 说明 |
|------|------|
| **99% 延迟降低** | 相比传统 TCP/IP |
| **80 Gbps 带宽** | Thunderbolt 5 理论带宽 |
| **低 CPU 开销** | 绕过内核网络栈 |
| **自动检测** | system_profiler 集成 |
| **拓扑感知** | 自动识别 RDMA 连接 |

**支持的设备**：
- M4 Pro Mac Mini
- M4 Max Mac Studio
- M4 Max MacBook Pro
- M3 Ultra Mac Studio

---

## 集群管理

### 主控器选举

**实现位置**：[`src/exo/shared/election.py`](src/exo/shared/election.py)

| 功能 | 说明 |
|------|------|
| **Bully 算法** | 分布式选举算法 |
| **动态切换** | Master 故障自动重新选举 |
| **脑裂预防** | 确定性比较函数 |
| **Seniority 机制** | 减少频繁切换 |

### 模型放置

**实现位置**：[`src/exo/master/placement.py`](src/exo/master/placement.py)

| 功能 | 说明 |
|------|------|
| **自动放置** | 自动决定在哪里放置模型实例 |
| **资源感知** | 考虑内存、CPU 资源 |
| **拓扑感知** | 考虑网络延迟和带宽 |
| **分布式放置** | 支持张量并行的跨设备放置 |

### 集群拓扑

**实现位置**：[`src/exo/shared/types/topology.py`](src/exo/shared/types/topology.py)

- RDMAConnection vs SocketConnection
- 实时拓扑视图
- 连接状态跟踪

---

## API 兼容性

**实现位置**：[`src/exo/api/adapters/`](src/exo/api/adapters/)

### OpenAI Chat Completions API

**文件**：[`chat_completions.py`](src/exo/api/adapters/chat_completions.py)

| 功能 | 支持 |
|------|------|
| 聊天补全 | ✅ |
| 流式响应 | ✅ |
| 多轮对话 | ✅ |
| 系统提示 | ✅ |
| 工具调用 | ✅ |
| 温度等参数 | ✅ |

**端点**：`POST /v1/chat/completions`

### Claude Messages API

**文件**：[`claude.py`](src/exo/api/adapters/claude.py)

| 功能 | 支持 |
|------|------|
| 消息 API | ✅ |
| 流式响应 | ✅ |
| 多轮对话 | ✅ |
| 系统提示 | ✅ |
| 工具使用 | ✅ |
| 图像理解 | ✅ |

**端点**：`POST /v1/messages`

### OpenAI Responses API

**文件**：[`responses.py`](src/exo/api/adapters/responses.py)

| 功能 | 支持 |
|------|------|
| 响应 API | ✅ |
| 流式响应 | ✅ |
| 工具调用 | ✅ |

**端点**：`POST /v1/responses`

### Ollama API

**文件**：[`ollama.py`](src/exo/api/adapters/ollama.py)

| 功能 | 支持 |
|------|------|
| 生成 API | ✅ |
| 聊天 API | ✅ |
| 流式响应 | ✅ |
| 模型列表 | ✅ |

**端点**：
- `POST /api/generate`
- `POST /api/chat`
- `GET /api/tags`

### API 端点汇总

**实现位置**：[`src/exo/api/main.py`](src/exo/api/main.py)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/v1/chat/completions` | POST | OpenAI 聊天补全 |
| `/v1/messages` | POST | Claude 消息 |
| `/v1/responses` | POST | OpenAI 响应 |
| `/api/generate` | POST | Ollama 生成 |
| `/api/chat` | POST | Ollama 聊天 |
| `/api/tags` | GET | 模型列表 |
| `/v1/models` | GET | 模型列表 |
| `/health` | GET | 健康检查 |
| `/instances` | GET | 实例列表 |
| `/instances/{id}` | DELETE | 删除实例 |

---

## 监控与信息收集

**实现位置**：[`src/exo/utils/info_gatherer/`](src/exo/utils/info_gatherer/)

### 系统监控

| 功能 | 说明 | 采集频率 |
|------|------|----------|
| **内存使用** | RAM/Swap 使用情况 | 1 秒 (Linux) |
| **CPU 性能** | macmon 集成 (macOS) | 1 秒 |
| **磁盘使用** | 模型目录空间 | 30 秒 |
| **网络接口** | IP 地址、接口类型 | 10 秒 |
| **节点身份** | 主机名、型号、芯片 | 60 秒 |
| **OS 信息** | 版本、构建号 | 60 秒 |

### Thunderbolt 监控 (macOS)

| 功能 | 说明 | 采集频率 |
|------|------|----------|
| **Thunderbolt 标识** | domain_uuid、接口映射 | 5 秒 |
| **Thunderbolt 连接** | 物理线缆连接状态 | 5 秒 |
| **Bridge 状态** | Thunderbolt Bridge 配置 | 10 秒 |
| **RDMA 状态** | rdma_ctl 状态 | 10 秒 |

### 性能分析

**实现位置**：[`src/exo/shared/types/profiling.py`](src/exo/shared/types/profiling.py)

- SystemPerformanceProfile（系统性能配置）
- ThunderboltBridgeStatus（Thunderbolt Bridge 状态）
- NodeThunderboltInfo（节点 Thunderbolt 信息）
- RdmaCtlStatus（RDMA 控制状态）

---

## 模型管理

### 模型卡片系统

**实现位置**：[`src/exo/shared/models/model_cards.py`](src/exo/shared/models/model_cards.py)

| 功能 | 说明 |
|------|------|
| **TOML 配置** | 基于 TOML 的模型元数据 |
| **内置模型** | 预置 100+ 模型卡片 |
| **自定义模型** | 支持用户添加自定义模型 |
| **模型发现** | 自动扫描模型目录 |

**模型卡片字段**：
```toml
model_id = "mlx-community/DeepSeek-V3.2-4bit"
n_layers = 64
hidden_size = 7168
supports_tensor = true
tasks = ["text-generation"]
family = "deepseek"
quantization = "4bit"
base_model = "deepseek/DeepSeek-V3"
capabilities = ["chat", "code"]
```

### 模型下载

**实现位置**：[`src/exo/download/`](src/exo/download/)

| 功能 | 说明 |
|------|------|
| **HuggingFace 集成** | 从 HF Hub 下载模型 |
| **分片下载** | 支持模型分片下载 |
| **断点续传** | 下载中断后可继续 |
| **校验验证** | SHA256 校验确保完整性 |
| **离线模式** | 支持完全离线运行 |
| **进度追踪** | 实时下载进度 |
| **并发下载** | 多模型并发下载 |

**下载协调器** ([`coordinator.py`](src/exo/download/coordinator.py))：
- 管理下载任务队列
- 处理下载命令
- 广播下载进度

### 模型目录

**默认位置**：
- Linux：`~/.local/share/exo/models/`
- macOS：`~/.exo/models/`

**环境变量**：
- `EXO_DEFAULT_MODELS_DIR`：默认模型目录
- `EXO_MODELS_DIRS`：额外可写目录（冒号分隔）
- `EXO_MODELS_READ_ONLY_DIRS`：只读目录（冒号分隔）

---

## 前端 Dashboard

**实现位置**：[`dashboard/`](dashboard/)

### 技术栈

- **框架**：Svelte 5
- **语言**：TypeScript
- **构建**：npm/Vite

### 主要功能

| 页面/组件 | 功能 |
|-----------|------|
| **集群视图** | 显示所有节点、连接、模型实例 |
| **聊天界面** | 与模型对话，支持流式响应 |
| **模型选择** | 浏览和加载模型 |
| **节点详情** | 查看节点资源使用、性能指标 |
| **实时监控** | 实时更新集群状态 |
| **响应式设计** | 支持桌面和移动设备 |

### 仪表板特性

- 🎨 现代化 UI 设计
- 📊 实时数据更新
- 🔄 流式响应显示
- 📱 响应式布局
- 🌙 深色模式支持

**访问地址**：`http://localhost:52415`

---

## 分布式系统特性

### 事件溯源架构

**实现位置**：[`src/exo/shared/apply.py`](src/exo/shared/apply.py)

| 功能 | 说明 |
|------|------|
| **不可变事件** | 所有状态变更是不可变事件 |
| **事件索引** | 每个事件有唯一索引 |
| **事件应用** | `apply()` 函数应用事件到状态 |
| **状态重建** | 可从事件流重建完整状态 |

**事件类型**：
- NodeGatheredInfo（节点信息收集）
- InstanceCreated（实例创建）
- InstanceDeleted（实例删除）
- TaskCreated（任务创建）
- TaskStatusUpdated（任务状态更新）
- TopologyEdgeCreated（拓扑边创建）
- TopologyEdgeDeleted（拓扑边删除）

### 消息路由

**实现位置**：[`src/exo/routing/`](src/exo/routing/)

**主题系统** ([`topics.py`](src/exo/routing/topics.py))：

| 主题 | 用途 | 发布策略 |
|------|------|----------|
| `GLOBAL_EVENTS` | Master 广播事件 | Always |
| `LOCAL_EVENTS` | Worker 发送事件 | Always |
| `COMMANDS` | 命令消息 | Always |
| `ELECTION_MESSAGES` | 选举消息 | Always |
| `CONNECTION_MESSAGES` | 连接消息 | Never |
| `DOWNLOAD_COMMANDS` | 下载命令 | Always |

**TopicRouter**：类型安全的发布/订阅路由

### 分布式追踪

**实现位置**：[`src/exo/shared/tracing.py`](src/exo/shared/tracing.py)

| 功能 | 说明 |
|------|------|
| **OpenTelemetry** | 标准追踪协议 |
| **性能分析** | 分布式性能监控 |
| **调试支持** | 跨请求追踪 |

**启用**：`EXO_TRACING_ENABLED=true`

---

## 配置与扩展

### 命令行参数

**实现位置**：[`src/exo/main.py`](src/exo/main.py)

| 参数 | 说明 |
|------|------|
| `--no-worker` | 不运行 Worker（仅协调器模式） |
| `--force-master` | 强制成为 Master |
| `--spawn-api` | 启动 API 服务 |
| `--no-downloads` | 禁用下载协调器 |
| `--api-port` | API 端口（默认 52415） |
| `--offline` | 离线模式 |
| `--bootstrap-peers` | Bootstrap peers 地址 |
| `-v, -vv` | 日志级别 |

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `EXO_DEFAULT_MODELS_DIR` | 模型目录 | `~/.local/share/exo/models/` |
| `EXO_MODELS_DIRS` | 额外模型目录 | 无 |
| `EXO_MODELS_READ_ONLY_DIRS` | 只读模型目录 | 无 |
| `EXO_OFFLINE` | 离线模式 | `false` |
| `EXO_ENABLE_IMAGE_MODELS` | 启用图像模型 | `false` |
| `EXO_LIBP2P_NAMESPACE` | 网络命名空间 | 无 |
| `EXO_TRACING_ENABLED` | 启用追踪 | `false` |
| `EXO_FAST_SYNCH` | MLX 快速同步 | Auto |

### 自定义命名空间

**用途**：
- 在同一网络运行多个独立集群
- 隔离开发/测试集群
- 防止意外加入其他集群

**配置**：
```bash
export EXO_LIBP2P_NAMESPACE=my-dev-cluster
uv run exo
```

### 离线模式

**功能**：
- 完全断网运行
- 不尝试下载模型
- 仅使用本地模型

**启用**：`uv run exo --offline`

---

## 支持的模型

### 文本生成模型

**内置支持** (部分列表)：

| 模型 | 量化 | 支持的任务 |
|------|------|-----------|
| DeepSeek-V3.2 | 4bit, 8bit | 聊天、代码 |
| DeepSeek-V3.1 | 4bit, 8bit | 聊天、代码 |
| GLM-4.7 | 4bit, 5bit, 6bit, 8bit | 聊天、工具 |
| GLM-4.5 | 8bit, bf16 | 聊天 |
| GLM-5 | 8bit, bf16, MXFP4-Q8 | 聊天 |
| Kimi-K2.5 | - | 聊天 |
| Kimi-K2-Thinking | 4bit | 思维链 |
| Qwen3-235B | - | 聊天 |
| GPT-OSS-120B | MXFP4-Q8 | 聊天 |
| Llama 系列 | 多种量化 | 聊天 |

### 图像生成模型

**内置支持**：

| 模型 | 量化 | 类型 |
|------|------|------|
| FLUX.1-dev | 4bit, 8bit, bf16 | 文本生成图像 |
| FLUX.1-schnell | 4bit, 8bit, bf16 | 快速生成 |
| FLUX.1-Kontext-dev | 4bit, 8bit, bf16 | 上下文生成 |
| FLUX.1-Krea-dev | 4bit, 8bit, bf16 | 创意生成 |
| Qwen-Image | 4bit, 8bit, bf16 | 文本生成图像 |
| Qwen-Image-Edit | 4bit, 8bit, bf16 | 图像编辑 |

---

## 平台支持

### macOS

**要求**：
- macOS 12.0+ (基本功能)
- macOS 26.2+ (RDMA 支持)
- Apple Silicon (M1/M2/M3/M4)
- Xcode (Metal Toolchain)

**推荐配置**：
- M4 Pro Mac Mini
- M4 Max Mac Studio
- M3 Ultra Mac Studio

### Linux

**要求**：
- Python 3.13+
- 支持 MLX 的 GPU（可选）

**注意**：
- Linux 不支持 RDMA over Thunderbolt
- 不支持 macmon 性能监控

---

## 安全特性

| 功能 | 说明 |
|------|------|
| **Noise 协议** | 加密所有节点间通信 |
| **PNet 隔离** | 预共享密钥网络隔离 |
| **消息签名** | Gossipsub 消息签名验证 |
| **私有网络** | 通过命名空间隔离集群 |

---

## 性能优化

### 已实现优化

| 优化 | 效果 |
|------|------|
| **零 RTT 连接** | 减少握手延迟 |
| **TCP_NODELAY** | 禁用 Nagle 算法 |
| **RDMA 通信** | 99% 延迟降低 |
| **张量并行** | 2 设备 1.8x，4 设备 3.2x |
| **KV Cache** | 减少重复计算 |
| **模型缓存** | 避免重复加载 |
| **事件溯源** | 优化状态管理 |

### 性能监控

- 实时资源使用监控
- 请求延迟追踪
- 分布式追踪支持

---

## 故障恢复

### 自动故障检测

| 功能 | 说明 |
|------|------|
| **Ping 机制** | 2.5 秒超时检测 |
| **连接重试** | 每 5 秒重试 |
| **Master 选举** | 自动重新选举 |
| **任务重调度** | 实例自动迁移 |

### 数据恢复

- 事件溯源确保状态一致性
- 从事件流重建状态
- 下载断点续传

---

## 开发工具

### 代码质量

| 工具 | 用途 |
|------|------|
| **basedpyright** | 类型检查 |
| **ruff** | 代码检查 |
| **pytest** | 单元测试 |
| **nix** | 代码格式化 |

### 测试

**测试覆盖**：
- 单元测试
- 集成测试
- 性能测试

**运行测试**：
```bash
# 运行所有测试
uv run pytest

# 运行特定测试
uv run pytest src/exo/shared/tests/test_election.py
```

---

## 文档

### 用户文档

- [README.md](../README.md) - 快速开始
- [docs/networking_discovery.md](networking_discovery.md) - 网络发现详解
- [CLAUDE.md](../CLAUDE.md) - 开发指南

### API 文档

- OpenAI API 兼容
- Claude API 兼容
- Ollama API 兼容

### 示例代码

**Python 客户端**：
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:52415/v1",
    api_key="any"
)

response = client.chat.completions.create(
    model="mlx-community/DeepSeek-V3.2-4bit",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

**curl 示例**：
```bash
curl http://localhost:52415/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mlx-community/DeepSeek-V3.2-4bit",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## 贡献

### 开发环境

```bash
# 克隆仓库
git clone https://github.com/exo-explore/exo

# 构建仪表板
cd dashboard && npm install && npm run build && cd ..

# 运行测试
uv run pytest

# 类型检查
uv run basedpyright

# 代码检查
uv run ruff check

# 格式化代码
nix fmt
```

### 提交前检查

```bash
# 按顺序运行所有检查
uv run basedpyright && uv run ruff check && nix fmt && uv run pytest
```

---

## 许可证

Apache License 2.0

---

## 联系方式

- **Discord**: [https://discord.gg/TJ4P57arEm](https://discord.gg/TJ4P57arEm)
- **X (Twitter)**: [https://x.com/exolabs](https://x.com/exolabs)
- **GitHub**: [https://github.com/exo-explore/exo](https://github.com/exo-explore/exo)

---

*最后更新：2026-04-08*
