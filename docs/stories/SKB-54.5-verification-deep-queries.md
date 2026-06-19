# Story SKB-54.5: Verification — Deep Queries Return Full Content

**Epic:** Epic 54 — Rich Content Retrieval for KB Queries
**Story ID:** SKB-54.5
**Story Points:** 1 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-54.1, SKB-54.2, SKB-54.3, SKB-54.4

---

## User Story

As the developer, I need to verify the entire Epic 54 chain works correctly — deep queries
return rich content, medium queries remain unchanged, and the answer synthesis respects
`max_answer_length`.

---

## Test Scenarios

### Scenario 1: Deep query — primary block has full page content

**Request:**
```json
{
  "query": "MTT",
  "depth": "deep",
  "max_block_chars": 2000
}
```

**Expected:**
- Primary block `char_count` is ~1000 chars (full MTT page), not ~119 chars (oneLiner)
- Content includes sections: properties, storage, handling, institutional knowledge
- Content is capped at 2000 chars (max_block_chars)

### Scenario 2: Medium query — primary block unchanged

**Request:**
```json
{
  "query": "MTT",
  "depth": "medium"
}
```

**Expected:**
- Primary block `char_count` is ~119 chars (oneLiner) — same as current behavior
- No change from pre-Epic-54 behavior

### Scenario 3: Deep query — linked blocks have rich content

**Request:**
```json
{
  "query": "EXP-2025-0015 MTT Cell Viability Assay",
  "depth": "deep",
  "max_blocks": 10
}
```

**Expected:**
- Experiment primary block: ~2500 chars (full experiment page)
- Linked chemical blocks (MTT, DMSO, etc.): 500+ chars each (full page content)
- NOT just oneLiners (~100 chars each)

### Scenario 4: Deep query — linked blocks are lightweight in medium mode

**Request:**
```json
{
  "query": "EXP-2025-0015 MTT Cell Viability Assay",
  "depth": "medium",
  "max_blocks": 10
}
```

**Expected:**
- Linked chemical blocks: ~100 chars (oneLiner only) — same as current behavior
- No extra DB queries for linked page content

### Scenario 5: Answer synthesis respects max_answer_length

**Request:**
```json
{
  "query": "MTT viability assay procedure",
  "depth": "deep",
  "max_answer_length": 5000
}
```

**Expected:**
- Answer length is significantly longer than 600 chars
- Answer uses content from multiple blocks (not just top 2)
- Answer is ≤ 5000 chars

### Scenario 6: Default max_answer_length is unchanged

**Request:**
```json
{
  "query": "MTT",
  "depth": "medium"
}
```

**Expected:**
- Answer length is ≤ 500 chars (default maxAnswerLength)
- Same behavior as pre-Epic-54

### Scenario 7: max_block_chars caps deep content

**Request:**
```json
{
  "query": "EXP-2025-0015",
  "depth": "deep",
  "max_block_chars": 500
}
```

**Expected:**
- All blocks ≤ 500 chars, even in deep mode
- Experiment page content truncated via smartTruncate (no mid-word/mid-sentence cuts)

### Scenario 8: formatted_context reflects deep content

**Request:**
```
POST /api/agent/kb-query?include_formatted=true&max_context_chars=12000
{
  "query": "EXP-2025-0015",
  "depth": "deep"
}
```

**Expected:**
- `formatted_context` contains rich content from deep blocks
- Total `formatted_context` length ≤ 12000 chars
- Context includes full experiment details, not just summaries

---

## Verification Script

```bash
#!/bin/bash
# Epic 54 verification — run against local SKB at http://localhost:3000
TOKEN="skb_live_..."
BASE="http://localhost:3000/api/agent/kb-query"
PASS=0
FAIL=0

run_test() {
  local name="$1" body="$2" check="$3"
  echo -n "Test: $name ... "
  result=$(curl -s -X POST "$BASE" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body")

  if echo "$result" | python3 -c "$check" 2>/dev/null; then
    echo "PASS"
    PASS=$((PASS + 1))
  else
    echo "FAIL"
    echo "  Result: $(echo "$result" | python3 -c "
import sys, json
d = json.load(sys.stdin)
blocks = d.get('data', {}).get('context_blocks', [])
answer = d.get('data', {}).get('answer', '')
print(f'  Blocks: {len(blocks)}, Answer len: {len(answer)}')
for b in blocks[:3]:
    print(f'    {b.get(\"type\",\"?\"):25s} {b.get(\"entity\",\"?\"):25s} {b.get(\"char_count\",0):5d} chars')
" 2>/dev/null)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Epic 54: Rich Content Retrieval Verification ==="
echo ""

# Scenario 1: Deep primary block
run_test "Deep primary block has full content" \
  '{"query":"MTT","depth":"deep","max_block_chars":2000}' \
  "
import sys, json
d = json.load(sys.stdin)
blocks = d['data']['context_blocks']
primary = blocks[0] if blocks else {}
assert primary.get('char_count', 0) > 300, f'Primary too short: {primary.get(\"char_count\", 0)}'
"

# Scenario 2: Medium primary unchanged
run_test "Medium primary block is short (unchanged)" \
  '{"query":"MTT","depth":"medium"}' \
  "
import sys, json
d = json.load(sys.stdin)
blocks = d['data']['context_blocks']
primary = blocks[0] if blocks else {}
assert primary.get('char_count', 0) < 300, f'Primary too long for medium: {primary.get(\"char_count\", 0)}'
"

# Scenario 3: Deep linked blocks have rich content
run_test "Deep linked blocks are rich" \
  '{"query":"EXP-2025-0015 MTT Cell Viability Assay","depth":"deep","max_blocks":10}' \
  "
import sys, json
d = json.load(sys.stdin)
blocks = d['data']['context_blocks']
linked = [b for b in blocks if b.get('type') in ('linked_entity', 'chemical_data', 'safety_data')]
assert len(linked) > 0, 'No linked blocks found'
rich = [b for b in linked if b.get('char_count', 0) > 200]
assert len(rich) > 0, f'No rich linked blocks (all under 200 chars)'
"

# Scenario 5: Answer respects max_answer_length
run_test "Answer uses max_answer_length" \
  '{"query":"MTT viability assay procedure","depth":"deep","max_answer_length":5000}' \
  "
import sys, json
d = json.load(sys.stdin)
answer = d['data']['answer']
assert len(answer) > 600, f'Answer too short: {len(answer)} chars (expected > 600)'
"

# Scenario 6: Default answer stays short
run_test "Default answer stays short" \
  '{"query":"MTT","depth":"medium"}' \
  "
import sys, json
d = json.load(sys.stdin)
answer = d['data']['answer']
assert len(answer) <= 600, f'Answer too long for default: {len(answer)} chars'
"

# Scenario 7: max_block_chars caps content
run_test "max_block_chars caps deep content" \
  '{"query":"EXP-2025-0015","depth":"deep","max_block_chars":500}' \
  "
import sys, json
d = json.load(sys.stdin)
blocks = d['data']['context_blocks']
for b in blocks:
    assert b.get('char_count', 0) <= 550, f'Block exceeds cap: {b.get(\"char_count\", 0)} chars'
"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
```

---

## Verification Checklist

- [ ] Scenario 1: Deep primary block has full page content (~1000 chars for MTT)
- [ ] Scenario 2: Medium primary block unchanged (~119 chars for MTT)
- [ ] Scenario 3: Deep linked blocks have rich content (500+ chars)
- [ ] Scenario 4: Medium linked blocks are lightweight (oneLiners)
- [ ] Scenario 5: Answer synthesis uses max_answer_length (5000 → long answer)
- [ ] Scenario 6: Default answer stays ≤ 500 chars
- [ ] Scenario 7: max_block_chars caps deep content
- [ ] Scenario 8: formatted_context reflects deep content

---

## Success Criteria

Epic 54 is complete when:
1. All 8 scenarios pass
2. No regression in medium/default query behavior
3. Deep queries return full page content for primary and linked blocks
4. Answer synthesis actually uses the requested max_answer_length
5. max_block_chars provides per-block content budget control
