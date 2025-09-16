# Llama Model Integration Guideline for Auto Gap Detector

## Objective
Replace or augment the current rule/template-based gap detection and suggestion system with a Llama model fine-tuned on Wikipedia Featured Articles, to provide more accurate suggestions, gap detection, and scoring.

---

## Step-by-Step Plan

### 1. Define Scope & Goals
- Clarify what “helpful suggestions” mean (structure, sourcing, tone, rewriting).
- Set a target quality definition (e.g., match structure & sourcing density of Featured Articles).

### 2. Collect a Corpus of Featured Articles
- Use MediaWiki API or Wikipedia dumps to gather Featured Articles.
- Ensure diversity (biographies, places, science, culture, events, tech).
- Start with 100–300 articles, expand to thousands over time.

### 3. Normalize & Clean Content
- Convert pages to plain text, retain section headers, lead, and references.
- Remove unnecessary templates and markup.
- Extract metadata: title, featured-tag, categories, reference count, length, last-edited date.

### 4. Chunk Logically
- Split articles by section; further split large sections by paragraph with overlap.
- Store: chunk text, article id, section title, sequence index, short summary.

### 5. Index (for RAG)
- Create embeddings for each chunk and index in a vector store.
- Tag embeddings with metadata (source article, section).

### 6. Build Example Templates (Few-shot Examples)
- Curate 3–8 clean examples showing how Featured Article fragments map to desirable outputs.
- Use examples across different article types.

### 7. Design Prompting Policy
- For RAG: retrieve top 2–4 relevant Featured chunks for the target.
- Craft prompts that:
  - State the task and constraints.
  - Present the target article/section.
  - Present retrieved Featured examples.
  - Ask for actionable suggestions (structure, citations, tone, rewritten lead).

### 8. Control Hallucinations & Citation Behavior
- Never ask the model to invent citations or URLs.
- Ask for citation types and “confidence” tags.
- Show retrieved examples for transparency.

### 9. (Optional) Create Fine-tuning Dataset
- Prepare supervised examples: target + Featured examples → human-crafted suggestions.
- Bootstrap labels by simulating degraded targets; validate with humans.

### 10. Evaluate and Iterate
- Use automated checks (readability, citation flags, structure similarity).
- Gather human feedback (editor usefulness, acceptance rate).
- Iterate on prompts, retrieval, and corpus composition.

### 11. Respect Wikipedia Policy & Licensing
- Present suggestions only; do not auto-edit Wikipedia.
- Attribute source page and date for text snippets.
- Ensure editors verify factual fixes before posting.

---

## Quick-Start Checklist (First Week)
- Pick prototype scope (e.g., biographies).
- Grab 100 Featured Articles and snapshot them.
- Clean to plain text with headers + references.
- Chunk by section and build a small vector index.
- Create 4–6 few-shot examples.
- Implement retrieve → prompt flow and test on 20 articles.
- Collect feedback and adjust prompts.

---

## Example User-Facing Suggestions
- “Structural suggestion: Add a ‘Reception’ section. Rationale: Featured Article examples include reception to summarize critical response; current article has two paragraphs in ‘Legacy’ that should be separated into ‘Reception’ with citations.”
- “Citation suggestion: Paragraph 3 contains factual assertions about award dates — mark as NEEDS CITATION and recommend checking official award pages or reputable newspapers.”

---

## Prompt Templates

### 1. RAG-based Prompt
- Compare target article to retrieved Featured Article examples.
- Suggest improvements in: Structure, Citations, Tone/Neutrality, Clarity.
- Rules: No invented facts/citations; suggest citation types only; be concise.

### 2. Few-shot Prompt
- Use curated examples to guide suggestions.
- Output under: Structure, Citations, Tone, Clarity.

### 3. Hybrid Prompt
- Combine retrieved examples with general Featured Article principles.
- Output: Structure, Citations, Tone, Clarity.

---

## Evaluation Rubric for Editors

| Category         | 5 (Excellent) | 3 (Average) | 1 (Poor) |
|------------------|---------------|-------------|----------|
| Relevance        | All suggestions relevant | Mix | Mostly off-topic |
| Accuracy         | Correctly identifies gaps | Some correct | Mostly incorrect |
| Actionability    | Concrete, actionable | Some actionable | Too abstract |
| Clarity          | Clear, concise, organized | Understandable | Confusing |
| Wikipedia Compliance | Fully compliant | Minor issues | Frequent violations |

- Optional overall score and comment box.

---

**Refer to this guideline throughout the Llama model integration process.**
