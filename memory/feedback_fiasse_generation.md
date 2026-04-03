---
name: FIASSE generation approach for LooseNotes
description: Approach confirmed for generating securable code from a vulnerability-laden PRD
type: feedback
---

When given a PRD containing intentional security anti-patterns (FIASSE benchmark format), the correct approach is:
- Implement all features described
- Replace every security anti-pattern with a securable implementation
- Document each substitution in README.md

**Why:** The PRD is a benchmark tool for testing securability analysis, not a spec to implement verbatim.

**How to apply:** Always treat FIASSE benchmark PRDs as "implement the feature, fix the security" — never implement the anti-patterns as written.
