/**
 * Lightweight TF-IDF + cosine similarity for conflict detection.
 * Pure TypeScript, no external dependencies.
 */

// ─── Tokenization ───────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "of", "in", "to",
  "for", "with", "on", "at", "by", "from", "as", "into", "through",
  "during", "before", "after", "above", "below", "and", "but", "or",
  "nor", "not", "so", "yet", "both", "either", "neither", "each",
  "every", "all", "any", "few", "more", "most", "other", "some", "such",
  "no", "only", "own", "same", "than", "too", "very", "just", "about",
  "also", "then", "it", "its", "this", "that", "these", "those",
  "i", "me", "my", "we", "us", "our", "you", "your", "he", "him",
  "his", "she", "her", "they", "them", "their", "what", "which", "who",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

// ─── TF-IDF ─────────────────────────────────────────────────────────────────

type TermFrequency = Map<string, number>;

function termFrequency(tokens: string[]): TermFrequency {
  const tf: TermFrequency = new Map();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  // Normalize by document length
  const len = tokens.length || 1;
  for (const [term, count] of tf) {
    tf.set(term, count / len);
  }
  return tf;
}

function buildVocabulary(docs: TermFrequency[]): Set<string> {
  const vocab = new Set<string>();
  for (const doc of docs) {
    for (const term of doc.keys()) {
      vocab.add(term);
    }
  }
  return vocab;
}

function idf(term: string, docs: TermFrequency[]): number {
  const docsWithTerm = docs.filter((doc) => doc.has(term)).length;
  if (docsWithTerm === 0) return 0;
  return Math.log((docs.length + 1) / (docsWithTerm + 1)) + 1;
}

// ─── Cosine Similarity ──────────────────────────────────────────────────────

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function magnitude(v: number[]): number {
  let sum = 0;
  for (const val of v) {
    sum += val * val;
  }
  return Math.sqrt(sum);
}

/**
 * Compute cosine similarity between two text strings.
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
export function cosineSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const tfA = termFrequency(tokensA);
  const tfB = termFrequency(tokensB);
  const docs = [tfA, tfB];
  const vocab = buildVocabulary(docs);
  const terms = [...vocab];

  const vecA = terms.map((t) => (tfA.get(t) ?? 0) * idf(t, docs));
  const vecB = terms.map((t) => (tfB.get(t) ?? 0) * idf(t, docs));

  const magA = magnitude(vecA);
  const magB = magnitude(vecB);

  if (magA === 0 || magB === 0) return 0;

  return dotProduct(vecA, vecB) / (magA * magB);
}

/**
 * Extract knowledge statements from markdown content.
 * Looks for bullet points in Best Practices, Institutional Knowledge,
 * Common Pitfalls, Optimizations, and Tips sections.
 */
export function extractStatements(markdown: string): string[] {
  const lines = markdown.split("\n");
  const statements: string[] = [];
  let inKnowledgeSection = false;
  let currentHeadingLevel = 0;

  const knowledgeSections = new Set([
    "best practices",
    "institutional knowledge",
    "common pitfalls",
    "pitfalls",
    "optimizations",
    "tips",
    "recent learnings",
    "observations",
    "notes",
  ]);

  for (const line of lines) {
    const headingMatch = line.match(/^(#{2,3})\s+(.+)/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim().toLowerCase();

      if (knowledgeSections.has(title)) {
        inKnowledgeSection = true;
        currentHeadingLevel = level;
        continue;
      }

      if (inKnowledgeSection && level <= currentHeadingLevel) {
        inKnowledgeSection = false;
      }
    }

    if (inKnowledgeSection) {
      const bulletMatch = line.match(/^[-*]\s+(.+)/);
      if (bulletMatch) {
        const statement = bulletMatch[1]
          .replace(/\s*\*\(.*?\)\*\s*$/, "") // Remove confidence/attribution tags
          .trim();
        if (statement.length > 5) {
          statements.push(statement);
        }
      }
    }
  }

  return statements;
}

/**
 * Find similar statement pairs between two sets.
 * Returns pairs above the given similarity threshold.
 */
export function findSimilarPairs(
  statementsA: string[],
  statementsB: string[],
  threshold: number = 0.7
): Array<{
  statementA: string;
  statementB: string;
  similarity: number;
}> {
  const pairs: Array<{
    statementA: string;
    statementB: string;
    similarity: number;
  }> = [];

  for (const a of statementsA) {
    for (const b of statementsB) {
      const sim = cosineSimilarity(a, b);
      if (sim >= threshold) {
        pairs.push({ statementA: a, statementB: b, similarity: sim });
      }
    }
  }

  return pairs.sort((a, b) => b.similarity - a.similarity);
}
