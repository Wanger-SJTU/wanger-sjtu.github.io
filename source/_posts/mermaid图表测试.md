---
title: mermaid图表测试
date: 2026-04-07 11:21:04
tags: [测试, Mermaid]
---

本文用于测试 Mermaid 图表渲染功能。

## 流程图

基础流程图示例：

```mermaid
graph LR
    A[开始] --> B{判断条件}
    B -->|是| C[执行操作A]
    B -->|否| D[执行操作B]
    C --> E[结束]
    D --> E
```

## 时序图

展示交互顺序：

```mermaid
sequenceDiagram
    participant 用户
    participant 系统
    participant 数据库

    用户->>系统: 发送请求
    系统->>数据库: 查询数据
    数据库-->>系统: 返回结果
    系统-->>用户: 响应数据
```

## 状态图

状态转换示例：

```mermaid
stateDiagram-v2
    [*] --> 待处理
    待处理 --> 处理中: 开始处理
    处理中 --> 已完成: 处理成功
    处理中 --> 失败: 处理失败
    失败 --> 待处理: 重试
    已完成 --> [*]
```

## 类图

UML 类图示例：

```mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +eat()
        +sleep()
    }
    class Dog {
        +bark()
        +fetch()
    }
    class Cat {
        +meow()
        +scratch()
    }
    Animal <|-- Dog
    Animal <|-- Cat
```

## 饼图

数据分布示例：

```mermaid
pie title 技术栈分布
    "JavaScript" : 40
    "Python" : 25
    "Go" : 20
    "Rust" : 15
```

## 甘特图

项目时间线示例：

```mermaid
gantt
    title 项目开发计划
    dateFormat  YYYY-MM-DD
    section 设计阶段
    需求分析     :a1, 2026-04-01, 7d
    架构设计     :after a1, 5d
    section 开发阶段
    后端开发     :2026-04-13, 14d
    前端开发     :2026-04-13, 10d
    section 测试阶段
    集成测试     :2026-04-27, 7d
```

## 思维导图

层次结构示例：

```mermaid
mindmap
  root((编程))
    前端
      HTML
      CSS
      JavaScript
    后端
      Python
      Go
      Java
    数据库
      SQL
      NoSQL
```

## ER图

实体关系图示例：

```mermaid
erDiagram
    USER ||--o{ POST : creates
    USER ||--o{ COMMENT : writes
    POST ||--o{ COMMENT : has
    USER {
        int id PK
        string name
        string email
    }
    POST {
        int id PK
        string title
        string content
        int user_id FK
    }
    COMMENT {
        int id PK
        string content
        int user_id FK
        int post_id FK
    }
```

## 总结

以上展示了 Mermaid 支持的主要图表类型。如果所有图表都能正常渲染，说明 Mermaid 配置成功！
