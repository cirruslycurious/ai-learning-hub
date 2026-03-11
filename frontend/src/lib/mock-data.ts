/**
 * Mock project data for local development.
 *
 * Projects are local-only until backend projects API ships (Epic 4+).
 * Save mock data has been removed — saves come from the real API via
 * React Query hooks in api/saves.ts.
 */
import type { Project } from "./types";

export const MOCK_PROJECTS: Project[] = [
  {
    id: "p1",
    name: "RAG Pipeline Experiment",
    description:
      "Building a hybrid retrieval system with GraphRAG and dense embeddings",
    status: "building",
    tags: ["rag", "embeddings", "knowledge-graph"],
    linkedResourceIds: [],
    notes:
      '# Architecture Decision: GraphRAG vs Traditional RAG\n\nAfter spending a week researching, I\'m going with a **hybrid approach** — traditional vector retrieval for simple queries, graph-based retrieval for questions that need relationship context.\n\n## Why not pure GraphRAG?\n\n- Cost: Building the knowledge graph requires multiple LLM passes per document\n- Latency: Graph traversal adds 200-400ms per query\n- Overkill for my use case — most of my queries are simple "find me resources about X"\n\n## The Hybrid Plan\n\n1. **Vector store** for basic semantic search (Pinecone or Weaviate)\n2. **Graph layer** only for "how does X relate to Y?" queries\n3. Start with vector-only, add graph when I have enough linked data\n\n## Next Steps\n\n- [ ] Set up Pinecone free tier\n- [ ] Write ingestion script for my saved articles\n- [ ] Benchmark query latency with 100 documents',
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "p2",
    name: "AI Agent Framework Review",
    description:
      "Comparing LangGraph, CrewAI, and AutoGen for multi-agent systems",
    status: "exploring",
    tags: ["agents", "framework"],
    linkedResourceIds: [],
    notes: "",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
