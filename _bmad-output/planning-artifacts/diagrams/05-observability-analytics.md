# Observability & Analytics

How metrics flow from events to dashboards to agent-consumable APIs.

## Observability Stack Overview

```mermaid
flowchart TB
    subgraph Sources["📊 Metric Sources"]
        Lambda["⚡ Lambda Functions"]
        APIGW["🚪 API Gateway"]
        SF["⚙️ Step Functions"]
        DDB["🗄️ DynamoDB"]
    end

    subgraph Collection["📥 Collection Layer"]
        EMF["📝 Embedded Metrics<br/>(EMF)"]
        Logs["📋 Structured Logs"]
        XRay["🔍 X-Ray Traces"]
        SFMetrics["📈 Built-in Metrics"]
    end

    subgraph CloudWatch["☁️ CloudWatch"]
        Metrics["📊 Metrics"]
        LogsInsights["🔍 Logs Insights"]
        Alarms["🚨 Alarms"]
    end

    subgraph Dashboards["📺 Dashboards"]
        OpsDash["🔧 Operational<br/>(4 dashboards)"]
        AnalyticsDash["📈 Analytics<br/>(5 dashboards)"]
    end

    subgraph Consumers["🤖 Consumers"]
        Admin["👤 Admin<br/>(Stephen)"]
        Analyst["📊 Analyst<br/>(Stefania)"]
        Agents["🤖 LLM Agents"]
    end

    subgraph APIs["🛣️ Analytics APIs"]
        AnalyticsEndpoints["/analytics/*<br/>(28 endpoints)"]
    end

    %% Sources → Collection
    Lambda --> EMF
    Lambda --> Logs
    Lambda --> XRay
    APIGW --> Logs
    APIGW --> XRay
    SF --> SFMetrics
    SF --> XRay
    DDB --> Metrics

    %% Collection → CloudWatch
    EMF --> Metrics
    Logs --> LogsInsights
    SFMetrics --> Metrics

    %% CloudWatch → Dashboards
    Metrics --> OpsDash
    Metrics --> AnalyticsDash
    LogsInsights --> AnalyticsDash

    %% CloudWatch → Alarms
    Metrics --> Alarms
    Alarms -->|"P1: SMS"| Admin
    Alarms -->|"P2: Email"| Admin

    %% Dashboards → Consumers
    OpsDash --> Admin
    AnalyticsDash --> Admin
    AnalyticsDash --> Analyst

    %% Analytics API path
    Metrics --> AnalyticsEndpoints
    LogsInsights --> AnalyticsEndpoints
    AnalyticsEndpoints --> Agents
    AnalyticsEndpoints --> Admin
    AnalyticsEndpoints --> Analyst

    %% Styling
    classDef source fill:#e3f2fd,stroke:#1565c0
    classDef collection fill:#fff3e0,stroke:#ef6c00
    classDef cw fill:#f3e5f5,stroke:#7b1fa2
    classDef consumer fill:#c8e6c9,stroke:#388e3c
    classDef api fill:#ffecb3,stroke:#ff8f00

    class Lambda,APIGW,SF,DDB source
    class EMF,Logs,XRay,SFMetrics collection
    class Metrics,LogsInsights,Alarms cw
    class Admin,Analyst,Agents consumer
    class AnalyticsEndpoints api
```

## Embedded Metrics Format (EMF) Pattern

```mermaid
sequenceDiagram
    autonumber
    participant Lambda as ⚡ Lambda
    participant EMF as 📝 EMF
    participant CW as ☁️ CloudWatch
    participant Dash as 📺 Dashboard
    participant API as 🛣️ Analytics API
    participant Agent as 🤖 Agent

    Lambda->>Lambda: Handle request

    Lambda->>EMF: metrics.putMetric('SavesCreated', 1)
    Lambda->>EMF: metrics.setDimensions({<br/>  contentType: 'youtube',<br/>  userId: 'user_123'<br/>})

    Note over EMF: Outputs structured JSON<br/>to stdout

    EMF-->>CW: Auto-ingested by<br/>CloudWatch agent

    Note over CW: Metrics available<br/>within ~1 minute

    CW-->>Dash: Real-time visualization

    Agent->>API: GET /analytics/saves/by-type
    API->>CW: Query metrics
    CW-->>API: { youtube: 42, podcast: 17 }
    API-->>Agent: JSON response
```

## Structured Logging Pattern

```mermaid
flowchart LR
    subgraph Lambda["⚡ Lambda Handler"]
        Log["logger.info({<br/>  action: 'save_created',<br/>  userId: 'user_123',<br/>  saveId: 'save_456',<br/>  contentType: 'youtube',<br/>  durationMs: 127<br/>})"]
    end

    subgraph CloudWatch["☁️ CloudWatch Logs"]
        LogGroup["/aws/lambda/saves-api"]
    end

    subgraph Insights["🔍 Logs Insights"]
        Query["fields @timestamp, userId, action<br/>| filter action = 'save_created'<br/>| stats count() by contentType"]
    end

    subgraph Analytics["📊 Analytics API"]
        Endpoint["GET /analytics/saves/by-type"]
    end

    Lambda --> LogGroup
    LogGroup --> Query
    Query --> Endpoint
```

## X-Ray Distributed Tracing

```mermaid
flowchart TB
    subgraph Trace["🔍 Single Request Trace"]
        T1["API Gateway<br/>23ms"]
        T2["JWT Authorizer<br/>45ms"]
        T3["Saves Lambda<br/>89ms"]
        T4["DynamoDB PutItem<br/>12ms"]
        T5["EventBridge Emit<br/>8ms"]
    end

    T1 --> T2
    T2 --> T3
    T3 --> T4
    T3 --> T5

    subgraph Annotations["📝 Trace Annotations"]
        A1["userId: user_123"]
        A2["coldStart: true"]
        A3["contentType: youtube"]
    end

    T3 -.-> A1
    T3 -.-> A2
    T3 -.-> A3

    subgraph Admin["🔧 Admin API"]
        Lookup["GET /admin/traces/{traceId}"]
    end

    Trace --> Lookup
```

## Tiered Alerting System

```mermaid
flowchart TB
    subgraph Metrics["📊 Monitored Metrics"]
        M1["Error Rate > 5%"]
        M2["p99 Latency > 5s"]
        M3["DLQ Messages > 0"]
        M4["API 5xx > 10/min"]
    end

    subgraph Alarms["🚨 CloudWatch Alarms"]
        subgraph P1["🔴 P1 - Critical"]
            A1["API Down"]
            A2["Auth Failures Spike"]
            A3["DynamoDB Throttling"]
        end

        subgraph P2["🟠 P2 - High"]
            A4["Error Rate Elevated"]
            A5["Pipeline Failures"]
        end

        subgraph P3["🟡 P3 - Medium"]
            A6["Slow Responses"]
            A7["DLQ Accumulating"]
        end
    end

    subgraph Notifications["📬 Notifications"]
        SMS["📱 SMS<br/>(immediate)"]
        Email["📧 Email<br/>(batched)"]
        Dashboard["📺 Dashboard<br/>(always)"]
    end

    M1 --> A4
    M2 --> A6
    M3 --> A7
    M4 --> A1

    P1 --> SMS
    P1 --> Dashboard
    P2 --> Email
    P2 --> Dashboard
    P3 --> Dashboard

    %% Styling
    classDef p1 fill:#ffcdd2,stroke:#c62828
    classDef p2 fill:#ffe0b2,stroke:#ef6c00
    classDef p3 fill:#fff9c4,stroke:#f9a825

    class A1,A2,A3 p1
    class A4,A5 p2
    class A6,A7 p3
```

## Analytics Data Flow (API-First)

```mermaid
flowchart TB
    subgraph Events["📊 Events"]
        SaveEvents["SaveCreated<br/>SaveUpdated"]
        ProjectEvents["ProjectCreated<br/>ProjectUpdated"]
        AuthEvents["Login<br/>API Key Used"]
        SearchEvents["SearchPerformed"]
    end

    subgraph Processing["⚡ Processing"]
        EMF["EMF Metrics"]
        Logs["Structured Logs"]
    end

    subgraph Storage["☁️ CloudWatch"]
        MetricsStore["Metrics<br/>(15 months)"]
        LogsStore["Logs<br/>(30 days)"]
    end

    subgraph Analytics["🛣️ Analytics API"]
        subgraph UserMetrics["User Metrics"]
            U1["GET /analytics/users/summary"]
            U2["GET /analytics/users/active"]
            U3["GET /analytics/users/retention"]
        end

        subgraph SaveMetrics["Save Metrics"]
            S1["GET /analytics/saves/volume"]
            S2["GET /analytics/saves/by-type"]
            S3["GET /analytics/saves/by-domain"]
        end

        subgraph ProjectMetrics["Project Metrics"]
            P1["GET /analytics/projects/volume"]
            P2["GET /analytics/projects/activity"]
        end
    end

    subgraph Consumers["🤖 API Consumers"]
        Agents["LLM/AI Agents"]
        Dashboards["Custom Dashboards"]
        Automation["Automation Scripts"]
    end

    Events --> Processing
    Processing --> Storage

    Storage --> UserMetrics
    Storage --> SaveMetrics
    Storage --> ProjectMetrics

    Analytics --> Consumers

    %% Styling
    classDef api fill:#c8e6c9,stroke:#388e3c

    class U1,U2,U3,S1,S2,S3,P1,P2 api
```

## Dashboard Organization

### Operational Dashboards (4)

```mermaid
flowchart LR
    subgraph Ops["🔧 Operational Dashboards"]
        D1["📊 API Health<br/>• Request rate<br/>• Error rate<br/>• Latency p50/p95/p99"]

        D2["⚙️ Pipeline Status<br/>• Executions/hour<br/>• Success rate<br/>• DLQ depth"]

        D3["🗄️ Database Health<br/>• Read/Write capacity<br/>• Throttling events<br/>• Item counts"]

        D4["💰 Cost Tracking<br/>• Lambda invocations<br/>• DynamoDB RCU/WCU<br/>• S3 storage"]
    end
```

### Analytics Dashboards (5)

```mermaid
flowchart LR
    subgraph Analytics["📈 Analytics Dashboards"]
        D1["👥 User Engagement<br/>• DAU/WAU/MAU<br/>• Session duration<br/>• Feature usage"]

        D2["📦 Content Metrics<br/>• Saves by type<br/>• Top domains<br/>• Enrichment success"]

        D3["📁 Project Activity<br/>• Active projects<br/>• Saves per project<br/>• Status distribution"]

        D4["📚 Tutorial Funnel<br/>• saved → started<br/>• started → completed<br/>• Completion rate"]

        D5["🔍 Search Analytics<br/>• Query volume<br/>• Zero results<br/>• Top terms"]
    end
```

## Analytics API → Agent Integration

```mermaid
sequenceDiagram
    autonumber
    participant Agent as 🤖 LLM Agent
    participant API as 🛣️ API Gateway
    participant Lambda as ⚡ Analytics Lambda
    participant CW as ☁️ CloudWatch

    Agent->>API: GET /analytics/users/active<br/>x-api-key: alh_...

    API->>Lambda: Invoke

    Lambda->>CW: StartQuery (Logs Insights)<br/>"stats count_distinct(userId)<br/>by bin(1d)"

    CW-->>Lambda: { results: [...] }

    Lambda->>Lambda: Format response

    Lambda-->>API: {<br/>  dau: [<br/>    { date: "2026-02-03", count: 8 },<br/>    { date: "2026-02-02", count: 12 }<br/>  ],<br/>  wau: 15,<br/>  mau: 18<br/>}

    API-->>Agent: JSON response

    Note over Agent: Agent can now reason<br/>about user activity trends
```

## Summary

| Layer | Component | Purpose |
|-------|-----------|---------|
| Collection | EMF | Custom metrics from Lambda |
| Collection | Structured Logs | Query-able event logs |
| Collection | X-Ray | Distributed tracing |
| Storage | CloudWatch Metrics | Time-series data (15 months) |
| Storage | CloudWatch Logs | Event logs (30 days) |
| Alerting | CloudWatch Alarms | Tiered notifications |
| Visualization | Dashboards | Real-time monitoring |
| API | /analytics/* | Programmatic access for agents |

**Key Principle (ADR-014):** Analytics APIs exist for agent consumption, not just human dashboards. Every metric accessible via dashboard is also accessible via API.
