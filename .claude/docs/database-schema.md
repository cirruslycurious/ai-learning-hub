# Database Schema Summary

7 DynamoDB tables, 10 GSIs. Full detail: `_bmad-output/planning-artifacts/architecture.md` (canonical path: see .claude/docs/README.md).

## Tables and Keys

| #   | Table        | PK                      | SK                                                   | Notes                        |
| --- | ------------ | ----------------------- | ---------------------------------------------------- | ---------------------------- |
| 1   | users        | USER#&lt;clerkId&gt;    | PROFILE or APIKEY#&lt;keyId&gt;                      | Profiles + API keys          |
| 2   | saves        | USER#&lt;userId&gt;     | SAVE#&lt;saveId&gt;                                  | urlHash links to content     |
| 3   | projects     | USER#&lt;userId&gt;     | PROJECT#&lt;projectId&gt; or FOLDER#&lt;folderId&gt; | Folders same table           |
| 4   | links        | USER#&lt;userId&gt;     | LINK#&lt;projectId&gt;#&lt;saveId&gt;                | Project ↔ Save               |
| 5   | content      | CONTENT#&lt;urlHash&gt; | META                                                 | Global; not user-partitioned |
| 6   | search-index | USER#&lt;userId&gt;     | INDEX#&lt;sourceType&gt;#&lt;sourceId&gt;            | Processed search substrate   |
| 7   | invite-codes | CODE#&lt;code&gt;       | META                                                 | Lookup by code               |

## GSIs (10 total)

| Table        | GSI                         | PK          | SK             | Purpose             |
| ------------ | --------------------------- | ----------- | -------------- | ------------------- |
| users        | apiKeyHash-index            | keyHash     | —              | API key auth        |
| saves        | userId-contentType-index    | userId      | contentType    | Filter by type      |
| saves        | userId-tutorialStatus-index | userId      | tutorialStatus | Tutorial view       |
| saves        | urlHash-index               | urlHash     | —              | Dedup, content link |
| projects     | userId-status-index         | userId      | status         | Filter by status    |
| projects     | userId-folderId-index       | userId      | folderId       | Folder nav          |
| links        | userId-projectId-index      | userId      | projectId      | Saves for project   |
| links        | userId-saveId-index         | userId      | saveId         | Projects for save   |
| search-index | userId-sourceType-index     | userId      | sourceType     | Filter by type      |
| invite-codes | generatedBy-index           | generatedBy | —              | List user's codes   |

## Conventions

- **User tables:** Always `PK=USER#<userId>` (or clerkId for users). Enforces per-user isolation.
- **Content table:** `PK=CONTENT#<urlHash>`. Shared across users; no user in key.
- **Soft deletes:** Use `deletedAt` (ISO 8601); list queries filter `deletedAt IS NULL`.
- **IDs:** ULID for saveId, projectId, folderId, etc.

## Common Access Patterns

- Get user: `users` GetItem PK=USER#&lt;clerkId&gt;, SK=PROFILE
- List user saves: `saves` Query PK=USER#&lt;userId&gt;, SK begins_with SAVE#
- Get content: `content` GetItem PK=CONTENT#&lt;urlHash&gt;, SK=META
- Saves for project: `links` Query GSI userId-projectId-index, then BatchGetItem saves
- Search: `search-index` Query PK=USER#&lt;userId&gt;, filter on searchableText (or GSI by sourceType)
