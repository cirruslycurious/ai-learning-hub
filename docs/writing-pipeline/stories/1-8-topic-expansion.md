# Story 1.8: Topic Expansion & Budget Logic

Status: draft

## Story

As a documentation author,
I want to specify a topic and archetype and receive a list of relevant source files that fit within the token budget, with split proposals when the topic is too broad,
so that I can generate focused, full-depth documents without exceeding context capacity.

## Acceptance Criteria

1. **AC1: Seed file identification**
   - GIVEN a topic string (e.g., "the review loop and subagent orchestration")
   - WHEN seed files are identified
   - THEN the system performs glossary lookup (matching topic terms against canonical glossary terms) and keyword matching against node names and types
   - AND matched seed files are returned with the reason for each match (which term or keyword matched)

2. **AC2: Depth-capped graph traversal**
   - GIVEN seed files
   - WHEN graph traversal expands the topic
   - THEN each edge type respects its configured depth cap:
     - `depends_on`: depth 1
     - `touches`: depth 1
     - `references`: depth 2
     - `imports`: depth 1-2
     - `intercepts`: depth 1
     - `enforces`: depth 1
     - `defines`: depth 1
   - AND files beyond the depth cap are not included

3. **AC3: Token budget computation**
   - GIVEN an archetype with `source_budget_ratio` and `total_words`
   - WHEN the token budget is computed
   - THEN the budget equals `source_budget_ratio * total_words`
   - AND the total token estimate for the expanded file set is compared against this budget

4. **AC4: Split strategies when over budget**
   - GIVEN a topic whose expanded file set exceeds the token budget
   - WHEN split strategies are applied
   - THEN the system proposes subtopics using the priority order:
     1. Component boundary split (Tier 1 files anchor clusters)
     2. Edge-type family split (group by dominant edge type)
     3. Directory boundary split (files in same directory grouped)
     4. Lifecycle phase split (workflow phases as boundaries)
   - AND each proposed subtopic includes files from all tiers (not just Tier 1)
   - AND every relevant file appears in at least one subtopic (no files dropped)
   - AND the system applies the highest-priority strategy that produces subtopics fitting within budget

5. **AC5: Traversal observability log**
   - GIVEN a topic expansion
   - WHEN the traversal log is produced
   - THEN it records:
     - Seed files with match reasons (which glossary terms or keywords matched)
     - Expansion path for each added file (source seed, edge type, depth)
     - Final file set with tier classification and token estimate per file
     - Budget comparison (total tokens vs. budget, whether split triggered)
   - AND the log is written as a structured data object (not included in generation prompts)

6. **AC6: User-facing split proposal**
   - GIVEN a split proposal with N subtopics
   - WHEN presented to the user
   - THEN the output shows: topic name, estimated tokens, budget, each subtopic with its files and estimated tokens, and options (generate 1 combined doc or N separate docs)
   - AND the format matches the example in the design doc

## Tasks / Subtasks

- [ ] **Task 1: Create graph queries module** (AC: #1-#6)
  - [ ] Create `scripts/lib/graph_queries.py`
  - [ ] Define `TopicExpansionResult` dataclass: `seed_files`, `expanded_files`, `total_tokens`, `budget`, `fits_budget`, `traversal_log`, `split_proposal` (optional)
  - [ ] Define `SplitProposal` dataclass: `subtopics` (list), `strategy_used`
  - [ ] Define `Subtopic` dataclass: `name`, `files`, `estimated_tokens`

- [ ] **Task 2: Implement seed file identification** (AC: #1)
  - [ ] Implement `identify_seeds(topic: str, db_conn, glossary: list) -> list[SeedMatch]`
  - [ ] Glossary lookup: match topic words/phrases against canonical glossary terms
  - [ ] Keyword matching: match topic words against node `name` and `type` fields
  - [ ] Return list of matched files with match reasons

- [ ] **Task 3: Implement depth-capped graph traversal** (AC: #2)
  - [ ] Implement `expand_topic(seeds: list, db_conn, depth_caps: dict) -> list[ExpandedFile]`
  - [ ] BFS or DFS traversal from each seed file, following edges
  - [ ] Track depth per edge type independently
  - [ ] Stop expanding when depth cap reached for that edge type
  - [ ] Deduplicate files reached via multiple paths (keep the shortest path for the log)
  - [ ] Make depth caps configurable (default values from design doc)

- [ ] **Task 4: Implement token budget computation** (AC: #3)
  - [ ] Implement `compute_budget(archetype: dict) -> int`
  - [ ] Parse `source_budget_ratio` and `total_words` from archetype YAML
  - [ ] Budget = `source_budget_ratio * total_words`
  - [ ] Compare against sum of `token_estimate` for all files in expanded set

- [ ] **Task 5: Implement split strategies** (AC: #4)
  - [ ] Implement `propose_splits(expanded_files: list, budget: int, db_conn) -> SplitProposal`
  - [ ] Strategy 1 - Component boundary: cluster around Tier 1 files and their graph neighborhoods
  - [ ] Strategy 2 - Edge-type family: group files by dominant edge type connecting them
  - [ ] Strategy 3 - Directory boundary: group files by directory co-location
  - [ ] Strategy 4 - Lifecycle phase: group files by workflow phase association
  - [ ] Apply strategies in priority order; use the first that produces within-budget subtopics
  - [ ] Allow file overlap between subtopics (per design doc)

- [ ] **Task 6: Implement traversal log** (AC: #5)
  - [ ] Implement `build_traversal_log(seeds, expansion_paths, final_files, budget_comparison) -> dict`
  - [ ] Record seed files with match reasons
  - [ ] Record expansion path per file (seed origin, edge type chain, depth)
  - [ ] Record final file set with tier and token estimate
  - [ ] Record budget comparison and split trigger status

- [ ] **Task 7: Implement split proposal formatting** (AC: #6)
  - [ ] Implement `format_split_proposal(proposal: SplitProposal, topic: str, budget: int) -> str`
  - [ ] Generate human-readable output matching design doc example format
  - [ ] Show subtopics with file lists and token estimates
  - [ ] Show options: single combined doc vs. N separate docs

- [ ] **Task 8: Write tests** (AC: #1-#6)
  - [ ] Create `scripts/tests/test_graph_queries.py`
  - [ ] Test seed identification with known glossary terms and node names
  - [ ] Test depth-capped traversal: verify depth 1 stops at 1 hop, depth 2 at 2 hops
  - [ ] Test budget computation with known archetype values
  - [ ] Test that within-budget topics produce no split proposal
  - [ ] Test component boundary split with a mock graph containing Tier 1 anchor nodes
  - [ ] Test directory boundary split with files in distinct directories
  - [ ] Test traversal log completeness (all required fields present)
  - [ ] Test file overlap in split proposals (same file in multiple subtopics allowed)
  - [ ] Test that no files are dropped in split proposals
  - [ ] Use a mock SQLite database with known nodes and edges

## Dev Notes

### Architecture Compliance

This story implements the "Topic Expansion and Budget Check" workflow described in the design doc's Step 3 section, including seed identification, depth-capped traversal, budget comparison, and the four split strategies. The depth caps per edge type match the design doc's specification. The split strategies follow the design doc's priority order and behavioral constraints (every file in at least one subtopic, overlap acceptable, all tiers included in each subtopic, breadth fixed, depth non-negotiable).

### Technical Notes

- Depth caps per edge type are the design doc's starting values. The doc notes these may need tuning: "Real traversal on the full 1,100-file repo may reveal that some edge types need tighter caps." Make them configurable (loaded from a config dict or YAML) rather than hardcoded.
- The `imports` edge type has a depth cap of "1-2" per the design doc. Implement as configurable: default to 2, but allow setting to 1 if traversal proves too expansive.
- The component boundary split strategy clusters around Tier 1 files and their "immediate graph neighborhood." This means: for each Tier 1 file, collect all files reachable in 1 hop via any edge type. This forms one candidate subtopic.
- The edge-type family split groups files by the dominant edge type connecting them to the seed. This requires tracking which edge type was used to reach each file during traversal.
- The lifecycle phase split requires some mapping of files to workflow phases. This can be derived from story metadata (if stories have phase information) or from directory structure. This strategy may produce less clean results initially -- implement it, but expect it to be the least-used strategy.
- The traversal log is for post-generation diagnostics (per design doc: "When a reviewer identifies missing coverage in a generated document, the traversal log distinguishes between an edge detection issue and a generation quality issue"). Store it alongside the generated document metadata, not in the generation prompt.

### Testing Requirements

- Unit tests with mock SQLite databases containing known graph structures
- Test depth cap enforcement with graphs of varying depth
- Test split strategy selection (first strategy that works is used)
- Test budget computation with each archetype's ratio values
- Test edge case: topic that matches no seeds (should return empty result with helpful message)
- Test edge case: topic that matches a single file (should return it without traversal)
- Integration test with a small but realistic graph (5-10 nodes with various edge types)

### Project Structure Notes

Files created by this story:

```
scripts/lib/
  graph_queries.py           # New: identify_seeds(), expand_topic(), propose_splits(), build_traversal_log()

scripts/tests/
  test_graph_queries.py      # New
```

### References

- [Source: docs/writing-pipeline/Documentation Generation System.md#Step 3: Topic Expansion and Budget Check]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Step 4: Budget Response]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Traversal Observability]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Interaction Model]

### Dependencies

- **Blocks**: Story 1.9 -- generation prompt assembly uses the expanded file set from topic expansion
- **Blocked by**: Story 1.6 -- needs a populated index to query (the rebuild script must be functional)

### Out of Scope

- Generation prompt construction (Story 1.9)
- Archetype YAML parsing (Story 1.9 loads archetypes; this story receives archetype data as input)
- Hand-authoring tier rules and archetypes (Story 1.7)
- Post-generation validation (Story 1.10)
- Relevance scoring (design doc's "v2 candidate" -- deferred until depth caps prove insufficient)
- Adjusting depth caps per high-connectivity node (design doc's open question -- monitor and adjust through usage)
