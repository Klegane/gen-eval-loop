# File Communication Layout

The Generator and Evaluator never exchange information via subagent prompts beyond "read this file, write that file". This keeps context clean, makes every handoff reviewable, and lets sprints resume across sessions.

## Layout

```
<repo-root>/
├── docs/
│   └── gen-eval/
│       └── spec.md                    # Planner output — one per deliverable
└── .gen-eval/
    ├── sprint-1/
    │   ├── contract.md                # Negotiated by Generator + Evaluator
    │   ├── report.md                  # Generator's status after IMPLEMENT
    │   ├── score.md                   # Evaluator's verdict
    │   └── screenshots/               # Playwright artifacts
    │       ├── hero.png
    │       └── menu.png
    ├── sprint-2/
    │   ├── contract.md
    │   └── ...
    └── state.json                     # Controller's running state (optional)
```

## Rules

1. **`docs/gen-eval/`** is for the Planner's spec. Committed to git alongside code.
2. **`.gen-eval/`** is for sprint artefacts. Add to `.gitignore` by default (screenshots can be large and the sprint logs are scratch). Promote anything worth keeping into `docs/gen-eval/` manually.
3. **One directory per sprint.** `sprint-N` must contain at least `contract.md`; the rest appear as the sprint progresses.
4. **Filenames are fixed.** `contract.md`, `report.md`, `score.md`, `screenshots/`. Do not rename — the prompt templates reference them.
5. **Large content always goes in files, never in subagent prompts.** If a subagent needs to know what's in the score, point them to the path. They read it themselves.
6. **Previous sprint's score is the next sprint's input.** Generator in sprint-2 reads `sprint-1/score.md` before drafting `sprint-2/contract.md`.

## Controller state (optional)

For very long runs, the controller can maintain `.gen-eval/state.json` with:

```json
{
  "spec": "docs/gen-eval/spec.md",
  "mode": "single-pass",
  "model": "claude-opus-4-7",
  "currentSprint": 3,
  "sprints": [
    { "n": 1, "verdict": "FAIL", "failed": ["Originality"] },
    { "n": 2, "verdict": "FAIL", "failed": ["Originality"], "decision": "pivot" },
    { "n": 3, "verdict": "PASS" }
  ]
}
```

This is not required — the controller can derive it from directory listing — but it's useful for cross-session resume.

## Cleanup

- After the user accepts the final deliverable, `.gen-eval/` can be removed (or kept for audit).
- `docs/gen-eval/spec.md` is part of the product history; keep it.
- Screenshots should not be committed unless the user specifically wants a visual changelog.
