# Authentication & Access Control

How authentication works across different client types and how access is controlled.

## Two Authentication Paths

```mermaid
flowchart TB
    subgraph Clients["📱 Client Types"]
        PWA["🌐 React PWA"]
        Shortcut["📲 iOS Shortcut"]
        Agent["🤖 LLM Agent"]
    end

    subgraph AuthMethods["🔐 Auth Methods"]
        JWT["JWT Path<br/>(Clerk-issued)"]
        APIKey["API Key Path<br/>(User-generated)"]
    end

    subgraph APIGW["🚪 API Gateway"]
        JWTAuth["JWT Authorizer<br/>(Lambda)"]
        KeyAuth["API Key Authorizer<br/>(Lambda)"]
    end

    subgraph External["☁️ External"]
        Clerk["🔐 Clerk"]
    end

    subgraph DB["🗄️ DynamoDB"]
        Users[("users table<br/>API key hashes")]
    end

    %% Client → Auth Method
    PWA --> JWT
    Shortcut --> APIKey
    Agent --> APIKey

    %% Auth Method → Authorizer
    JWT --> JWTAuth
    APIKey --> KeyAuth

    %% Authorizer → Verification
    JWTAuth -->|"verify"| Clerk
    KeyAuth -->|"lookup hash"| Users

    %% Styling
    classDef client fill:#e3f2fd,stroke:#1565c0
    classDef jwt fill:#c8e6c9,stroke:#388e3c
    classDef apikey fill:#fff3e0,stroke:#ef6c00

    class PWA client
    class Shortcut,Agent client
    class JWT,JWTAuth jwt
    class APIKey,KeyAuth apikey
```

## JWT Authentication Flow (Web App)

```mermaid
sequenceDiagram
    autonumber
    participant User as 👤 User
    participant PWA as 🌐 React PWA
    participant Clerk as 🔐 Clerk
    participant API as 🚪 API Gateway
    participant Auth as ⚡ JWT Authorizer
    participant Lambda as ⚡ Handler

    User->>PWA: Click "Sign In"
    PWA->>Clerk: Redirect to Clerk UI

    alt Social Login (Google/GitHub)
        User->>Clerk: OAuth flow
    else Email/Password
        User->>Clerk: Enter credentials
    end

    Clerk-->>PWA: JWT + Session

    Note over PWA: JWT stored in memory<br/>(not localStorage)

    User->>PWA: Make API request
    PWA->>API: GET /saves<br/>Authorization: Bearer {jwt}

    API->>Auth: Invoke authorizer

    Auth->>Clerk: verifyToken(jwt)
    Clerk-->>Auth: { sub: userId, publicMetadata: { role } }

    Auth-->>API: Policy: Allow<br/>Context: { userId, role }

    API->>Lambda: Invoke with context
    Lambda-->>API: Response
    API-->>PWA: Response
```

## API Key Authentication Flow (Shortcut/Agents)

```mermaid
sequenceDiagram
    autonumber
    participant User as 👤 User
    participant PWA as 🌐 Web App
    participant API as 🚪 API Gateway
    participant Lambda as ⚡ Handler
    participant DDB as 🗄️ DynamoDB
    participant Shortcut as 📲 iOS Shortcut

    Note over User,PWA: One-time setup

    User->>PWA: Settings → Generate API Key
    PWA->>API: POST /users/api-keys<br/>{ name: "iPhone Shortcut" }
    API->>Lambda: Generate key

    Lambda->>Lambda: key = crypto.randomBytes(32)
    Lambda->>Lambda: hash = sha256(key)
    Lambda->>DDB: Store hash + metadata
    Lambda-->>API: { key: "alh_..." } (shown once)
    API-->>PWA: Display key
    User->>Shortcut: Paste key into Shortcut

    Note over Shortcut: Key stored securely in Shortcut

    rect rgb(240, 248, 255)
        Note over Shortcut,DDB: Every subsequent request

        Shortcut->>API: POST /saves<br/>x-api-key: alh_...

        API->>Lambda: API Key Authorizer
        Lambda->>Lambda: hash = sha256(key)
        Lambda->>DDB: Query by hash
        DDB-->>Lambda: User record

        alt Key valid & not revoked
            Lambda-->>API: Policy: Allow<br/>Context: { userId, authMethod: "api-key" }
            API->>Lambda: Invoke handler
            Lambda-->>API: Response
            API-->>Shortcut: ✅ Success
        else Key invalid or revoked
            Lambda-->>API: Unauthorized
            API-->>Shortcut: ❌ 401
        end
    end
```

## Role-Based Access Control

```mermaid
flowchart TB
    subgraph Roles["👥 Roles"]
        Admin["🔑 admin<br/>(Stephen)"]
        Analyst["📊 analyst<br/>(Stefania)"]
        User["👤 user<br/>(Everyone else)"]
    end

    subgraph Endpoints["🛣️ API Endpoints"]
        subgraph Core["Core APIs"]
            Saves["/saves/*"]
            Projects["/projects/*"]
            Search["/search"]
            Me["/users/me"]
        end

        subgraph AdminOnly["Admin Only"]
            AdminUsers["/admin/users/*"]
            AdminCodes["/admin/invite-codes/*"]
            AdminHealth["/admin/health"]
            AdminPipelines["/admin/pipelines/*"]
        end

        subgraph AnalyticsAPIs["Analytics APIs"]
            AnalyticsUsers["/analytics/users/*"]
            AnalyticsSaves["/analytics/saves/*"]
            AnalyticsProjects["/analytics/projects/*"]
        end

        subgraph Internal["Internal (IAM Auth)"]
            Content["/content/*"]
            SearchIndex["/search-index/*"]
        end
    end

    %% Admin access
    Admin -->|"✅ own data"| Core
    Admin -->|"✅ full"| AdminOnly
    Admin -->|"✅ full"| AnalyticsAPIs

    %% Analyst access
    Analyst -->|"✅ own data"| Core
    Analyst -->|"❌"| AdminOnly
    Analyst -->|"✅ read"| AnalyticsAPIs

    %% User access
    User -->|"✅ own data"| Core
    User -->|"❌"| AdminOnly
    User -->|"❌"| AnalyticsAPIs

    %% Internal - no user access
    Internal -.->|"Step Functions<br/>only"| Content
    Internal -.->|"Step Functions<br/>only"| SearchIndex

    %% Styling
    classDef admin fill:#ffcdd2,stroke:#c62828
    classDef analyst fill:#fff3e0,stroke:#ef6c00
    classDef user fill:#e3f2fd,stroke:#1565c0
    classDef internal fill:#f3e5f5,stroke:#7b1fa2

    class Admin admin
    class Analyst analyst
    class User user
    class Content,SearchIndex internal
```

## API Key Scopes

```mermaid
flowchart LR
    subgraph KeyTypes["🔑 API Key Types"]
        FullKey["Full Access Key<br/>scopes: ['*']"]
        LimitedKey["Limited Key<br/>scopes: ['saves:write']"]
    end

    subgraph Operations["📝 Operations"]
        SavesWrite["POST /saves"]
        SavesRead["GET /saves"]
        ProjectsAll["Projects CRUD"]
        SearchOp["Search"]
    end

    FullKey -->|"✅"| SavesWrite
    FullKey -->|"✅"| SavesRead
    FullKey -->|"✅"| ProjectsAll
    FullKey -->|"✅"| SearchOp

    LimitedKey -->|"✅"| SavesWrite
    LimitedKey -->|"❌"| SavesRead
    LimitedKey -->|"❌"| ProjectsAll
    LimitedKey -->|"❌"| SearchOp

    %% Styling
    classDef full fill:#c8e6c9,stroke:#388e3c
    classDef limited fill:#fff3e0,stroke:#ef6c00

    class FullKey full
    class LimitedKey limited
```

## Access Control Summary

| Path | Admin | Analyst | User | API Key | Step Function |
|------|-------|---------|------|---------|---------------|
| `/saves/*` | ✅ own | ✅ own | ✅ own | ✅ (scoped) | ❌ |
| `/projects/*` | ✅ own | ✅ own | ✅ own | ✅ (scoped) | ❌ |
| `/search` | ✅ own | ✅ own | ✅ own | ✅ (scoped) | ❌ |
| `/users/me` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/admin/*` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/analytics/*` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/content/*` | ❌ | ❌ | ❌ | ❌ | ✅ (IAM) |
| `/search-index/*` | ❌ | ❌ | ❌ | ❌ | ✅ (IAM) |

## Security Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                  SECURITY BOUNDARIES                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  User Data Isolation:                                    │
│  └─▶ Every user query partitioned by USER#{userId}      │
│  └─▶ Cannot access other users' data                    │
│  └─▶ Enforced at application layer + DynamoDB PK        │
│                                                          │
│  API Key Security:                                       │
│  └─▶ Keys shown once, never stored plaintext            │
│  └─▶ SHA256 hash stored in DynamoDB                     │
│  └─▶ Keys can be revoked instantly                      │
│  └─▶ lastUsedAt tracked for audit                       │
│                                                          │
│  Internal APIs:                                          │
│  └─▶ IAM auth only (SigV4)                              │
│  └─▶ No user-facing access                              │
│  └─▶ Step Function role has explicit permissions        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```
