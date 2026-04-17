# Scoring Rubric

Four criteria, each scored 0–10. Default threshold per criterion is 7. The contract may raise a threshold but never lower it.

Scores must cite evidence (file:line, screenshot path, console log, curl output). A score without evidence is invalid and the Evaluator must re-score.

---

## 1. Design Quality

**What it measures:** visual hierarchy, typography craft, colour coherence, spatial composition.

| Score | Descriptor |
|-------|------------|
| 0–2   | No intentional design. Raw defaults. |
| 3–4   | Some styling applied but inconsistent — mismatched spacing scale, clashing colours, flat hierarchy. |
| 5–6   | Competent. Follows common patterns. Nothing wrong, nothing memorable. |
| 7     | **Threshold.** Clear hierarchy, consistent spacing, deliberate typography. Looks designed. |
| 8     | Strong design choices executed well. One or two details would catch a designer's eye. |
| 9     | Distinctive and cohesive. Feels like a real product someone sweated over. |
| 10    | Outstanding. Every detail considered. Would be case-studied in a design gallery. |

**Red flags the Evaluator should look for:** flat monochrome layouts, centered-everything, stock card grids with equal gaps, decorative but unused whitespace.

---

## 2. Originality

**What it measures:** resistance to "AI slop" — the generic aesthetic that LLMs default to when left alone.

| Score | Descriptor |
|-------|------------|
| 0–2   | Pure AI slop. Inter or Arial, purple gradient, three feature cards, ✨ emoji, hero with illustration of laptop. |
| 3–4   | Mostly slop with one or two original touches. |
| 5–6   | Mixed. Some defaults swapped but the overall shape is still recognisable as "AI-made landing page". |
| 7     | **Threshold.** Distinct aesthetic. Defaults deliberately avoided. Type and palette feel chosen. |
| 8     | Clearly differentiated from the generic LLM output. Has an identity. |
| 9     | Could only have been made for this specific product. Aesthetic is load-bearing. |
| 10    | A designer asked to brief this would have written the same brief the Planner wrote. |

**Instant-kill slop indicators (each caps Originality at 4):**
- Font is Inter, Roboto, Arial, system-ui, Space Grotesk, or any other generic sans-serif (unless the spec explicitly demanded it).
- Background is a purple→blue or purple→pink gradient on white.
- The layout is hero / three feature cards / testimonial / CTA, in that order, centered.
- ✨ 🚀 💡 emojis in the copy.
- Lorem ipsum or AI-generated placeholder copy left in.
- Generic illustrations of abstract shapes, blobs, or "undraw.co"-style people.

Reference the `frontend-design` skill for the broader catalogue of what to avoid.

---

## 3. Craft

**What it measures:** polish, consistency, attention to detail, absence of avoidable defects.

| Score | Descriptor |
|-------|------------|
| 0–2   | Visibly broken. Overlapping elements, console errors, layout shifts, unstyled sections. |
| 3–4   | Multiple small defects. Inconsistent spacing. Buttons behave differently in different places. |
| 5–6   | Acceptable. A few rough edges but nothing that derails the experience. |
| 7     | **Threshold.** No console errors. Consistent spacing/colour use. All interactive elements have clear states. |
| 8     | Thoughtful details — proper focus rings, loading states, empty states, micro-transitions. |
| 9     | Consistent quality throughout. Even error states look designed. |
| 10    | Feels hand-crafted. No weak links anywhere. |

**Automatic deductions:**
- Console errors on initial load → cap Craft at 6.
- Layout shift > 0.1 CLS → cap Craft at 6.
- Unstyled default browser elements visible (default `<select>`, default scrollbars on styled surfaces) → −1.
- Broken images or 404s → cap Craft at 4.

---

## 4. Functionality

**What it measures:** every user-visible flow promised in the contract works end-to-end.

| Score | Descriptor |
|-------|------------|
| 0–2   | Core flows broken. Buttons don't do anything, forms don't submit. |
| 3–4   | Happy path works, everything else broken. |
| 5–6   | Happy path works and some edge cases. Several contract flows still fail. |
| 7     | **Threshold.** Every flow listed in the contract works. Happy path plus the obvious edge cases. |
| 8     | Contract flows plus reasonable error handling (invalid input, network failure). |
| 9     | Resilient — handles timeouts, weird inputs, state recovery. |
| 10    | Production-ready. Nothing the Evaluator tried broke it. |

**Automatic deductions:**
- A flow in the contract is not reachable → cap Functionality at 4.
- Evaluator couldn't start the app at all → cap Functionality at 2 (and Craft at 3).

---

## Guidance for the Evaluator

- Score independently — don't let a low score on one dimension drag another down sympathetically.
- Prefer a specific 6 over a generous 7. The threshold exists to force improvement.
- When in doubt between two adjacent scores, pick the lower one and cite the reason.
- Never score above 8 without at least one piece of evidence per point above 7.
