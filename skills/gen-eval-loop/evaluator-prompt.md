# Evaluator Prompt Template — DEPRECATED

This file is kept for reference only. Do not use it to dispatch subagents.

The Evaluator role has been split into two independent roles:

- **Gate B (contract review):** use `contract-reviewer-prompt.md`
- **Gate C (sprint scoring):** use `sprint-evaluator-prompt.md`

The roles must run in separate subagent sessions. The ContractReviewer must never score a sprint.
