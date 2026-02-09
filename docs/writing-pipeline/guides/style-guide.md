# Style Guide

This document defines the writing standards for all documentation produced by the pipeline. The Tech Writer and Editor load this on every run. The SME loads it for reference only — the SME does not enforce style rules.

Rules are tagged with their review taxonomy severity: **[MUST]** violations block the gate; **[SHOULD]** violations are expected to be fixed but do not independently block; **[MINOR]** items are polish. See `review-taxonomy.md` for full severity definitions and handling rules.

---

## Voice and Tone

### Person and Tense

**[MUST]** Use second person ("you") for all instructions and procedures. The reader is "you"; the system, tool, or application is "it."

**[MUST]** Use present tense for instructions. Write "the command returns" not "the command will return." Use future tense only when describing something that happens later in a sequence: "After the deployment completes, the dashboard will show the new version."

**[SHOULD]** Use active voice in all procedure steps. Passive voice is acceptable in conceptual explanations where the actor is irrelevant or unknown.

**[MUST]** Do not use first person ("we", "I", "our"). There is no "we" in technical documentation. The document is not a conversation between the author and reader.

### Voice Characteristics

The voice is: **direct, technically precise, and neutral.**

- Direct: State what to do. Do not narrate the journey of learning.
- Technically precise: Use the correct term. Do not simplify terminology for comfort — define it instead.
- Neutral: No enthusiasm, no apology, no personality. The content is the value.

### Before/After Examples

**Hedging:**

| Before                                                                                          | After                                            |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| It is important to note that you should always back up your database before running migrations. | Back up your database before running migrations. |

**Passive voice in a procedure:**

| Before                                                               | After                                                |
| -------------------------------------------------------------------- | ---------------------------------------------------- |
| The configuration file should be edited to include the new endpoint. | Edit the configuration file to add the new endpoint. |

**First person and filler:**

| Before                                                                                                            | After                                                         |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| We've designed this feature to make it easy for you to get started quickly with our powerful deployment pipeline. | This section covers initial setup of the deployment pipeline. |

**Narrating the learning journey:**

| Before                                                                                                            | After                                                                                  |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Now that you understand how authentication works, let's move on to explore how authorization builds on top of it. | Authorization uses the identity established during authentication to determine access. |

### Formality Level

Professional but not stiff. Write the way a senior engineer explains something to a peer — precise, no filler, no slang, no marketing.

**Acceptable:** "Run the migration before deploying" / "This flag is required" / "The default value works for most configurations"

**Not acceptable:** "Simply run the migration" (don't call things simple) / "This awesome feature" (no enthusiasm) / "You're gonna want to..." (no slang) / "Best-in-class solution" (no marketing)

---

## Structure Rules

### Section Ordering

**[MUST]** Task-based sections (procedures, how-to guides) come before reference sections (API specs, configuration tables, glossaries) within the same document. If a reader needs to do something, they find it before the reference material.

**[MUST]** Prerequisites come before the procedure they apply to. A prerequisite must never appear inside or after the steps it gates. If a procedure has prerequisites, list them under a "Prerequisites" subheading immediately before the numbered steps.

### Section Openers

**[SHOULD]** Every task section begins with a single sentence stating what the reader will accomplish. This sentence uses second person and present tense: "You configure the database connection and verify it works."

**[SHOULD]** Every conceptual section begins with a single sentence stating what the section explains. "This section describes how the authentication flow works."

Do not begin sections with background, history, or motivation. State the purpose, then provide content.

### Content Type Formatting

**[MUST]** Procedures (steps the reader follows) use numbered lists. Each step begins with a verb.

**[MUST]** Conceptual content (explanations, background) uses prose paragraphs or unordered bullet lists. Do not number conceptual items unless order matters.

**[SHOULD]** Non-sequential groups of items (feature lists, supported platforms, configuration options) use unordered bullet lists or tables, not numbered lists.

### List Parallel Structure

**[SHOULD]** All items in a list must use the same grammatical form. If the first item starts with a verb, all items start with a verb. If the first item is a noun phrase, all items are noun phrases.

| Correct (parallel)           | Incorrect (mixed forms)                                |
| ---------------------------- | ------------------------------------------------------ |
| - Validate dependencies      | - You should validate dependencies                     |
| - Sort stories topologically | - Topological sorting happens here                     |
| - Persist execution state    | - The system will then persist execution state to disk |

**Detection:** Read the first word of each list item. If the grammatical roles differ (verb, noun, pronoun, article), the list is not parallel.

### Required Document Sections

No sections are universally required — the project request defines document scope. However, when these sections appear, they must follow these rules:

| Section       | Rule                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Prerequisites | Must appear before the first procedure. List each prerequisite as a bullet. Include version numbers where applicable. **[MUST]** |
| Overview      | Must be the first content section (after title). Maximum 2 paragraphs. **[SHOULD]**                                              |
| Next Steps    | Must be the last content section. Link to logical follow-on documents. **[SHOULD]**                                              |
| Glossary      | Must appear at the end, after all content sections. **[MINOR]**                                                                  |

### Cross-Referencing

**[SHOULD]** Link to other documents instead of repeating information, unless the repeated information is a critical prerequisite that the reader must see to proceed safely. In that case, repeat it and add a cross-reference to the source: "You must have Node.js 18+ installed (see [Installation Guide](./installation.md) for details)."

**[SHOULD]** Use relative paths for cross-references within the same documentation set. Use full URLs only for external resources.

### Section Transitions

**[SHOULD]** When consecutive sections cover related topics, the first sentence of the new section should connect it to the previous one. Do not rely on headings alone to signal the relationship.

**Acceptable transition:** "After configuring authentication, you set up authorization rules to control access." (The reader understands this follows from the previous section.)

**Unacceptable:** A section on authorization that begins with generic background, with no signal that it builds on the authentication section above it.

**[SHOULD]** Do not use formulaic transition phrases ("Now that we've covered X, let's look at Y"). State the relationship directly or let the section opener carry the connection implicitly through shared terminology.

---

## Formatting Conventions

### Headings

**[MUST]** H1 (`#`) is the document title only. One H1 per document.

**[MUST]** H2 (`##`) marks major sections. H3 (`###`) marks subsections within an H2.

**[SHOULD]** Avoid H4 (`####`). If you need H4, the section is likely too deeply nested — consider restructuring. H4 is acceptable only in reference sections with naturally deep hierarchies (e.g., nested configuration objects).

**[MUST]** Headings use sentence case: "Configure the database connection" not "Configure the Database Connection."

**[MUST]** Headings contain no terminal punctuation. No periods, exclamation marks, or question marks. Colons are acceptable only when introducing a subtitle: "Authentication: How tokens flow."

**[SHOULD]** Task section headings start with a verb: "Configure authentication", "Deploy the service", "Verify the installation."

### Code Formatting

**[MUST]** Fenced code blocks specify a language tag. Use `bash` for shell commands, `yaml`, `json`, `typescript`, etc. as appropriate. Never use bare ` ``` ` without a language.

**[MUST]** Use inline code (backticks) for: commands, flags, parameters, file paths, file names, environment variables, configuration keys, function names, and any literal value the reader types or sees in output.

**[SHOULD]** Code blocks that show commands the reader should run begin with `$` prompt markers when the output is also shown, to distinguish input from output. Omit the `$` when only the command is shown (so the reader can copy-paste).

**[SHOULD]** Keep code blocks under 30 lines. If a code example exceeds 30 lines, split it into logical chunks with prose explaining each chunk, or link to a full example file.

### Callouts

Use exactly these callout types with these meanings:

| Callout     | When to use                                                                                                                                                   | [Severity if misused]                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Note**    | Additional context that is useful but not required to complete the task. Information the reader might want but can safely skip.                               | [SHOULD]                                                                       |
| **Warning** | Information the reader MUST see to avoid data loss, security risk, or an unrecoverable error. If skipping this information could cause harm, it is a Warning. | [MUST] — a Warning demoted to a Note (or vice versa) is a structural violation |
| **Tip**     | An optional shortcut, alternative approach, or efficiency suggestion. The reader can ignore this entirely.                                                    | [MINOR]                                                                        |

**[MUST]** Do not use other callout types (Caution, Important, Info, Danger, etc.). Map them to Note, Warning, or Tip.

**[SHOULD]** A section should not contain more than 2 callouts. If you need more, the content likely needs restructuring — callouts are not a substitute for well-organized prose.

### Lists vs. Prose

**[SHOULD]** Use a list when presenting 3 or more parallel items (options, requirements, steps). Use prose when explaining a concept that has logical flow or causation.

A list of 2 items looks awkward — use prose or fold them into a sentence. A paragraph describing 5 parallel options is hard to scan — use a list.

### Tables

**[SHOULD]** Use tables when content has 2+ attributes per item and 3+ items. Tables are ideal for: configuration options (name, type, default, description), comparison matrices, and mapping relationships.

**[SHOULD]** Do not use tables for simple lists. If a table has only one meaningful column (besides the item name), use a list instead.

**[MUST]** Every table column must have a header. Tables without headers are not valid markdown.

---

## Naming Conventions

### CLI Commands and Flags

**[MUST]** Format CLI commands, subcommands, and flags in inline code: `npm install`, `--verbose`, `-p 3000`.

**[MUST]** Use the exact casing and spelling from the tool. If the flag is `--no-verify`, write `--no-verify`, not `--noVerify` or `--no_verify`.

### UI Elements

**[SHOULD]** Format UI element labels in bold: **Save**, **Settings > Advanced**, **Deploy Now**.

**[MUST]** Use the exact label text as it appears in the UI. Do not paraphrase button labels or menu items.

### Configuration Values and Paths

**[MUST]** Format file paths, environment variables, and configuration keys in inline code: `~/.config/app/settings.yaml`, `NODE_ENV`, `server.port`.

**[SHOULD]** Use the canonical path form. Do not mix `~/` and `/home/user/` for the same path within a document.

### First Mention vs. Subsequent

**[SHOULD]** On first mention of an acronym, spell it out: "Application Programming Interface (API)." Use the acronym alone on all subsequent mentions.

**[SHOULD]** On first mention of a tool, library, or service, use its full official name. Subsequent mentions may use the common short form if unambiguous (e.g., "Amazon DynamoDB" first, then "DynamoDB").

**Exception:** Universally known acronyms (API, URL, HTTP, AWS, CLI, JSON, YAML, HTML, CSS) do not need expansion.

### Terminology Consistency

**[SHOULD]** Use one term for one concept throughout a document. If you call it "config file" in the introduction, do not call it "settings file" in a later section. Pick the canonical term on first use and stick to it.

**Detection:** Search for synonyms referring to the same object. Common drift patterns: "config" vs "settings" vs "configuration", "deploy" vs "release" vs "ship", "endpoint" vs "route" vs "URL", "error" vs "failure" vs "exception."

**[SHOULD]** If a project request or architecture document defines canonical terms, use those terms. Do not invent alternative names for concepts that already have project-standard names.

---

## Length Constraints

### Sentences

**[SHOULD]** Maximum 25 words per sentence. If a sentence requires more, split it or restructure. Compound sentences joined by "and", "but", or "which" that exceed 25 words are a sign that two ideas are competing for one sentence.

**Exception:** Sentences containing inline code, file paths, or command examples may exceed 25 words when the code itself accounts for the length.

**[SHOULD]** Vary sentence length. A sequence of 4+ sentences with the same structure and similar word count reads as monotonous and robotic. Mix short declarative sentences (5-10 words) with longer explanatory ones (15-25 words) to create readable rhythm.

### Paragraphs

**[SHOULD]** One idea per paragraph. If a paragraph covers two distinct concepts, split it — even if each half is only one sentence. Paragraph breaks signal topic shifts; sentence count alone does not determine when to break.

**[SHOULD]** Frontload each paragraph. The first sentence carries the paragraph's main point. Supporting detail, exceptions, and nuance follow. A reader skimming first sentences should grasp the document's structure.

**[SHOULD]** Maximum 4 sentences per paragraph in conceptual sections.

**[MUST]** Maximum 2 sentences per paragraph in procedure sections (between or within steps). Procedure prose must be terse — if you need more explanation, break it into a sub-step or move the explanation to a Note callout.

### Sections

**[SHOULD]** If an H2 section exceeds 40 lines (including code blocks and lists), evaluate whether it should be split into subsections or decomposed into a separate document.

**[SHOULD]** If an H3 subsection exceeds 25 lines, evaluate whether the content is doing too much for one subsection.

These are evaluation triggers, not hard limits. A 45-line section that is a single coherent procedure may be fine. A 30-line section that covers two unrelated concepts should be split.

### Documents

**[SHOULD]** If a document exceeds 500 lines, evaluate whether it should be decomposed into multiple documents with a landing page that links them. Single-purpose documents are easier to maintain and navigate.

### Concision

**[SHOULD]** Every sentence must earn its place. If removing a sentence does not reduce the reader's ability to understand or complete the task, remove it.

**[SHOULD]** Do not explain what you are about to explain. Write the explanation directly.

| Violation                                                       | Fix                                                        |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| "In this section, we will cover how to configure the database." | "To configure the database:" (then the steps)              |
| "The following table shows the available options:"              | (Just put the table — the heading already says what it is) |
| "Let's take a look at how authentication works."                | "Authentication works by..."                               |

---

## Prohibited Patterns

Each prohibited pattern is listed with its severity and a detection rule the Editor can apply.

### Marketing Language and Unmeasurable Adjectives — [SHOULD]

**Detection:** Content contains superlatives, excitement, sales framing, or adjectives that cannot be verified.

**Banned phrases:** "powerful", "robust", "seamless", "cutting-edge", "best-in-class", "world-class", "game-changing", "revolutionary", "blazing fast", "enterprise-grade", "delightful", "elegant", "intuitive", "smart", "clean", "simply the best", "magic", "supercharge", "turbocharge", "unlock the power of."

**Rule:** Replace with specific, measurable claims or remove. "Blazing fast" becomes "responds in under 50ms" or is deleted. "Robust error handling" becomes "retries failed requests up to 3 times with exponential backoff." If no measurable replacement exists, the adjective is filler — delete it.

### Hedging and Scaffold Phrases — [SHOULD]

**Detection:** Filler phrases that add no information, or connector phrases that pad transitions without adding meaning.

**Banned filler:** "it is important to note that", "it should be mentioned that", "it is worth noting", "please note that", "keep in mind that", "as mentioned earlier", "needless to say", "basically", "essentially", "actually", "just" (as filler), "simply" (implying ease), "obviously", "clearly", "of course."

**Banned scaffolding:** "moreover", "furthermore", "in conclusion", "in summary", "moving forward", "at its core", "in essence", "it is essential to", "when it comes to", "at the end of the day", "that being said", "having said that", "with that in mind", "to that end."

**Rule:** Delete the phrase. If the remaining sentence is still valid, the phrase was scaffolding. If the sentence loses its logical connection to the previous one, rewrite the transition directly — name the relationship ("because", "after", "if") instead of using a generic connector.

### Passive Voice in Procedures — [MUST]

**Detection:** A numbered step in a procedure uses passive voice.

**Rule:** Every step in a numbered procedure must begin with an imperative verb. "The file should be saved" → "Save the file." Passive voice is acceptable in conceptual paragraphs where the actor is genuinely irrelevant.

### Future Promises — [MUST]

**Detection:** Content references unshipped features, roadmap items, or future plans.

**Banned phrases:** "we plan to", "upcoming feature", "in a future release", "coming soon", "stay tuned", "will be available in."

**Rule:** Document what exists now. If a feature is not available, do not mention it. If a workaround exists for a missing feature, document the workaround without referencing the planned feature.

### Audience-Inappropriate Complexity — [SHOULD]

**Detection:** Content assumes knowledge that the declared audience profile does not include, without defining terms or providing context.

**Rule:** Every technical term must be either (a) within the declared audience profile's expected knowledge, or (b) defined on first use. When evaluating, use the audience profile from the project request — not the reviewer's personal knowledge.

### Uncertainty Without Qualification — [SHOULD]

**Detection:** Vague quantifiers or unqualified claims where specifics exist.

**Banned patterns:** "many users", "sometimes", "often", "usually", "in some cases" — when the specific conditions are known and can be stated.

**Rule:** Replace vague language with specific conditions. "Sometimes the connection times out" → "The connection times out if the server does not respond within 30 seconds."

### Synthetic Voice Patterns — [SHOULD]

LLM-generated prose has recognizable tells. The output of this pipeline must read as if a human technical writer produced it. The Editor should flag patterns that signal machine-generated text, not because the words are wrong but because they erode reader trust and make the documentation feel generic.

**Inflated verbs:** "delve into", "dive into", "explore" (when introducing a section), "embark on", "leverage", "utilize" (use "use"), "harness", "unlock", "unleash", "elevate", "empower", "streamline", "foster", "craft" (as a verb for writing or building).

**Rule:** Replace with plain verbs. "Let's delve into configuration" → "To configure the service:" / "Leverage the API" → "Use the API" / "This empowers you to" → "You can."

**Formulaic openers:** Starting 2+ sections or paragraphs with the same phrase structure is a pattern signal. Common offenders: "In order to...", "It's worth noting that...", "When it comes to...", "This allows you to...", "By [gerund], you can...".

**Rule:** Vary how sections and paragraphs begin. If the Editor spots 3+ paragraphs opening with the same syntactic pattern (e.g., all starting with a gerund phrase, or all starting with "This"), flag it. Restructure to break the repetition.

**Paired intensifiers:** "not just X — but Y", "not only X but also Y", "both X and Y" used for emphasis rather than genuine contrast. LLMs overuse this construction to inflate ordinary statements.

**Rule:** Use paired constructions only when the contrast is meaningful. "The API handles not just reads but also writes" is legitimate (the reader might assume read-only). "This feature is not just useful — it's essential" is inflation — state why it matters instead.

**Over-signposting:** Announcing what you are about to say, then saying it, then summarizing what you said. One explanation is enough. This overlaps with the Concision rules but is called out separately because LLMs produce this pattern at a higher rate than human writers.

**Detection test for the Editor:** Read a section and ask: "Would a senior engineer writing internal docs at a company like Stripe or Cloudflare write it this way?" If the prose feels like a blog post, a LinkedIn article, or a chatbot response, it needs tightening.

---

## Quick Reference

Condensed rules for agent consultation during drafting and review.

### Voice

| Rule                                   | Severity                |
| -------------------------------------- | ----------------------- |
| Second person ("you") for instructions | MUST                    |
| Present tense for instructions         | MUST                    |
| No first person ("we", "I", "our")     | MUST                    |
| Active voice in procedure steps        | SHOULD                  |
| Active voice in conceptual prose       | Preferred, not required |

### Structure

| Rule                                                          | Severity |
| ------------------------------------------------------------- | -------- |
| Task sections before reference sections                       | MUST     |
| Prerequisites before the procedure                            | MUST     |
| Procedures use numbered lists                                 | MUST     |
| Conceptual content uses prose or unordered lists              | MUST     |
| List items use parallel grammatical form                      | SHOULD   |
| Task sections open with "what you'll do" sentence             | SHOULD   |
| Conceptual sections open with "what this explains" sentence   | SHOULD   |
| Section transitions connect related topics                    | SHOULD   |
| Cross-reference instead of repeating (unless safety-critical) | SHOULD   |

### Formatting

| Rule                                                | Severity |
| --------------------------------------------------- | -------- |
| One H1 per document (title only)                    | MUST     |
| H2 = major sections, H3 = subsections               | MUST     |
| Headings in sentence case, no terminal punctuation  | MUST     |
| Code blocks specify language tag                    | MUST     |
| Inline code for commands, flags, paths, config keys | MUST     |
| Only 3 callout types: Note, Warning, Tip            | MUST     |
| Warning used only for harm-avoidance                | MUST     |
| Avoid H4 unless reference hierarchy demands it      | SHOULD   |
| Task headings start with a verb                     | SHOULD   |
| Code blocks under 30 lines                          | SHOULD   |
| Max 2 callouts per section                          | SHOULD   |
| Use lists for 3+ parallel items                     | SHOULD   |
| Tables for 2+ attributes across 3+ items            | SHOULD   |

### Naming

| Rule                                                  | Severity |
| ----------------------------------------------------- | -------- |
| CLI commands/flags in inline code, exact casing       | MUST     |
| UI labels use exact text from the UI                  | MUST     |
| File paths and env vars in inline code                | MUST     |
| UI labels in bold                                     | SHOULD   |
| Expand acronyms on first mention (except universals)  | SHOULD   |
| Full official name on first mention of tools/services | SHOULD   |
| One term per concept throughout a document            | SHOULD   |
| Use project-canonical terms when defined              | SHOULD   |

### Length

| Rule                                                 | Severity |
| ---------------------------------------------------- | -------- |
| Max 2 sentences per paragraph in procedures          | MUST     |
| One idea per paragraph                               | SHOULD   |
| Frontload each paragraph (main point first)          | SHOULD   |
| Max 25 words per sentence (exceptions for code)      | SHOULD   |
| Vary sentence length (no 4+ same-structure sequence) | SHOULD   |
| Max 4 sentences per paragraph in conceptual sections | SHOULD   |
| Evaluate splitting H2 sections over 40 lines         | SHOULD   |
| Evaluate splitting H3 subsections over 25 lines      | SHOULD   |
| Evaluate decomposing documents over 500 lines        | SHOULD   |
| Every sentence must earn its place                   | SHOULD   |

### Prohibited Patterns

| Pattern                                      | Severity | Detection                                             |
| -------------------------------------------- | -------- | ----------------------------------------------------- |
| Passive voice in procedure steps             | MUST     | Step does not begin with imperative verb              |
| Future promises                              | MUST     | References unshipped features or roadmap              |
| Marketing language / unmeasurable adjectives | SHOULD   | Superlatives, excitement, unverifiable adjectives     |
| Hedging and scaffold phrases                 | SHOULD   | Filler phrases or generic connectors from banned list |
| Synthetic voice: inflated verbs              | SHOULD   | "delve", "leverage", "harness", "empower", "craft"    |
| Synthetic voice: formulaic openers           | SHOULD   | 3+ paragraphs with same opening pattern               |
| Synthetic voice: paired intensifiers         | SHOULD   | "not just X — but Y" without genuine contrast         |
| Over-signposting                             | SHOULD   | Announcing, explaining, then summarizing same point   |
| Audience-inappropriate complexity            | SHOULD   | Undefined term outside audience profile               |
| Vague quantifiers                            | SHOULD   | "sometimes", "many", "often" without specifics        |
