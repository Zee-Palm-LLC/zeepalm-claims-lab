# Reviewing the rules

`data/rules.json` is what every finding stands on. It has been built from the text of
21 CFR 101.93 and FDA's Small Entity Compliance Guide, and tested against FDA's own examples —
but **it has not been reviewed by a regulatory professional.** It should be, before anyone
relies on it.

## Who

Someone who reviews supplement labels for a living: a regulatory affairs specialist in
dietary supplements, or a food and drug attorney. One sitting.

## What to ask

> For each rule: does the wording pattern belong under the paragraph it cites, and should its
> tier be "disease" (direct match) or "review" (context-dependent)? Which common claims does it
> miss, and which acceptable claims would it wrongly flag?

The last question matters most. Every gap they name becomes a test case.

## Where the judgement calls are

These are the rules most worth a second opinion — each is a deliberate choice, not a quotation:

| Rule | Decision made | Why it's debatable |
| ---- | ------------- | ------------------ |
| `symptom-anxiety` | "anxiety" → **review**, not disease | FDA accepts "relieves stress"; anxiety sits between stress and a disorder |
| `symptom-pain` | pain relief → **review** | Analgesic *class* terms are disease claims; plain "relieves pain" is less settled |
| `symptom-inflammation` | → **review** | FDA's example pairs it with a named disease |
| `symptom-regulate-marker` | "regulates blood sugar" → **review** | "Lowers" is disease per FDA; "regulates" and "balances" are not addressed directly |
| `symptom-lowt` | "low testosterone" → **review** | Clinically low T is a condition; the phrase is used loosely in marketing |
| `disease-mental` | "depression" → **disease** | FDA accepts mild mood changes; the bare word usually means the disorder |
| `response-season` | "flu season" → **review** | Implies preventing flu without naming an effect |
| `class-diuretic` | laxative, sedative, anti-inflammatory → **review** | Not in FDA's list of disease product classes |
| `natural-severe` | severity words → **review** | FDA draws the line on seriousness, which wording alone can't measure |
| All `rewrite` strings | templates | None of them are FDA language except where an `fdaExample` says so |

## Adding a correction

1. Change the rule in `data/rules.json`
2. Add the claim that proves it to `test/fda-examples.test.mjs`
3. `npm test` — it must stay green
