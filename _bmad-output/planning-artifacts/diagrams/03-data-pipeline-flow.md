# Data & Pipeline Flow

How data moves through the system — from user actions to enriched, searchable content.

## Data Architecture Overview

```mermaid
flowchart TB
    subgraph UserLayer["👤 User Layer (Per-User Partitioned)"]
        saves[("🔖 saves<br/>USER#userId")]
        projects[("📁 projects<br/>USER#userId")]
        links[("🔗 links<br/>USER#userId")]
        searchIdx[("🔍 search-index<br/>USER#userId")]
    end

    subgraph GlobalLayer["🌍 Global Layer (Shared)"]
        content[("📄 content<br/>CONTENT#urlHash")]
    end

    subgraph Support["🔧 Support Tables"]
        users[("👤 users<br/>USER#clerkId")]
        invites[("🎟️ invite-codes<br/>CODE#code")]
    end

    subgraph Storage["📦 Object Storage"]
        S3[("📁 S3<br/>Notes Markdown")]
    end

    %% Relationships
    saves -->|"urlHash"| content
    saves -->|"via links table"| projects
    projects -->|"notesS3Key"| S3
    saves --> searchIdx
    projects --> searchIdx
    S3 --> searchIdx

    %% Styling
    classDef userTable fill:#e3f2fd,stroke:#1565c0
    classDef globalTable fill:#fff3e0,stroke:#ef6c00
    classDef supportTable fill:#f3e5f5,stroke:#7b1fa2
    classDef storage fill:#e8f5e9,stroke:#2e7d32

    class saves,projects,links,searchIdx userTable
    class content globalTable
    class users,invites supportTable
    class S3 storage
```

## Three Async Processing Pipelines

Each pipeline is independent — failures in one don't affect others.

```mermaid
flowchart LR
    subgraph Triggers["🎯 Triggers"]
        T1["SaveCreated"]
        T2["NoteUpdated"]
        T3["SaveUpdated<br/>ProjectUpdated"]
    end

    subgraph EventBridge["📡 EventBridge"]
        EB["Event Bus"]
    end

    subgraph Pipelines["⚙️ Step Functions"]
        P1["Pipeline 1<br/>URL Enrichment"]
        P2["Pipeline 2<br/>Notes Processing"]
        P3["Pipeline 3<br/>Search Index Sync"]
    end

    subgraph Outputs["📤 Outputs"]
        O1[("content table")]
        O2[("search-index")]
        O3[("search-index")]
    end

    subgraph DLQ["☠️ Dead Letter Queues"]
        DLQ1["DLQ 1"]
        DLQ2["DLQ 2"]
        DLQ3["DLQ 3"]
    end

    T1 --> EB
    T2 --> EB
    T3 --> EB

    EB --> P1
    EB --> P2
    EB --> P3

    P1 --> O1
    P2 --> O2
    P3 --> O3

    P1 -.->|"failure"| DLQ1
    P2 -.->|"failure"| DLQ2
    P3 -.->|"failure"| DLQ3

    %% Styling
    classDef trigger fill:#ffecb3,stroke:#ff8f00
    classDef pipeline fill:#e1f5fe,stroke:#0277bd
    classDef output fill:#c8e6c9,stroke:#388e3c
    classDef dlq fill:#ffcdd2,stroke:#c62828

    class T1,T2,T3 trigger
    class P1,P2,P3 pipeline
    class O1,O2,O3 output
    class DLQ1,DLQ2,DLQ3 dlq
```

## Pipeline 1: URL Enrichment (Detailed)

```mermaid
flowchart TD
    Start["SaveCreated Event"]

    Start --> Check{"Content exists?<br/>GET /content/{urlHash}"}

    Check -->|"No"| Detect["Detect Content Type<br/>(domain analysis)"]
    Check -->|"Yes"| Link["Link save to content"]

    Detect --> FetchMeta["Fetch Metadata"]

    subgraph Sources["📡 External Sources"]
        YT["YouTube API<br/>(38 fields)"]
        GH["GitHub API<br/>(39 fields)"]
        RSS["RSS/Podcast<br/>(29 fields)"]
        HTML["HTML Parse<br/>(og tags, meta)"]
    end

    FetchMeta --> YT
    FetchMeta --> GH
    FetchMeta --> RSS
    FetchMeta --> HTML

    YT --> Sanitize
    GH --> Sanitize
    RSS --> Sanitize
    HTML --> Sanitize

    Sanitize["Sanitize & Validate"]
    Sanitize --> Create["PUT /content<br/>(conditional write)"]
    Create --> Link

    Link["PATCH /saves/{id}<br/>(link urlHash)"]
    Link --> Done["✅ Complete"]

    %% Failure path
    FetchMeta -.->|"API error"| Retry["Retry with backoff"]
    Retry -.->|"max retries"| DLQ["Dead Letter Queue"]
```

## Pipeline 2: Notes Processing

```mermaid
flowchart TD
    Start["NoteUpdated Event"]

    Start --> Fetch["Fetch from S3<br/>GET s3://bucket/notes/{key}"]

    Fetch --> Parse["Parse Markdown"]

    subgraph V1["V1 Processing (No LLM)"]
        Extract1["Extract code blocks"]
        Extract2["Extract tools mentioned"]
        Extract3["Build searchableText"]
    end

    Parse --> Extract1
    Parse --> Extract2
    Parse --> Extract3

    Extract1 --> Combine
    Extract2 --> Combine
    Extract3 --> Combine

    Combine["Combine into<br/>search index record"]

    subgraph V2["V2 Processing (Future)"]
        LLM["LLM Analysis"]
        Topics["Extract topics"]
        Concepts["Extract concepts"]
        Questions["Key questions"]
    end

    Combine --> Upsert["PUT /search-index"]
    Upsert --> Done["✅ Complete"]

    %% Styling
    classDef v1 fill:#e8f5e9,stroke:#388e3c
    classDef v2 fill:#f3e5f5,stroke:#7b1fa2,stroke-dasharray: 5 5

    class Extract1,Extract2,Extract3 v1
    class LLM,Topics,Concepts,Questions v2
```

## Pipeline 3: Search Index Sync

```mermaid
flowchart TD
    Start["SaveUpdated or<br/>ProjectUpdated Event"]

    Start --> Fetch["Fetch entity<br/>GET /saves/{id} or<br/>GET /projects/{id}"]

    Fetch --> IsSave{"Is Save?"}

    IsSave -->|"Yes"| FetchContent["Fetch content metadata<br/>GET /content/{urlHash}"]
    IsSave -->|"No"| BuildProject["Build project record"]

    FetchContent --> Merge["Merge user + content data"]

    Merge --> Build["Build searchableText blob"]
    BuildProject --> Build

    Build --> Upsert["PUT /search-index<br/>{<br/>  pk: USER#{userId}<br/>  sk: INDEX#{type}#{id}<br/>  searchableText: ...<br/>}"]

    Upsert --> Done["✅ Complete"]
```

## Data Flow Summary

| Event | Pipeline | Input | Output | External Calls |
|-------|----------|-------|--------|----------------|
| SaveCreated | URL Enrichment | URL | content table | YouTube, GitHub, RSS |
| NoteUpdated | Notes Processing | S3 key | search-index | None |
| SaveUpdated | Search Index Sync | Save ID | search-index | None |
| ProjectUpdated | Search Index Sync | Project ID | search-index | None |

## Failure Isolation

```
┌─────────────────────────────────────────────────────────┐
│           PIPELINE FAILURE ISOLATION                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  YouTube API down?                                       │
│  └─▶ URL Enrichment fails → DLQ                         │
│  └─▶ Notes Processing continues ✓                        │
│  └─▶ Search Index Sync continues ✓                       │
│  └─▶ User's saves still work ✓                           │
│                                                          │
│  S3 temporarily unavailable?                             │
│  └─▶ Notes Processing fails → DLQ                        │
│  └─▶ URL Enrichment continues ✓                          │
│  └─▶ Search Index Sync continues ✓                       │
│  └─▶ User's saves still work ✓                           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```
