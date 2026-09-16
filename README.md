# § Claims Lab

**Paste your supplement claim. See exactly what rule it triggers.**

An open-source tool from **Zee Palm Labs**. Built by [Zee Palm](https://zeepalm.com).
Sibling of [Dose Lab](https://github.com/Zee-Palm-LLC/zeepalm-dose-lab-).

> **Automated pattern checks, not legal or regulatory advice.** A claim with no flags
> has not been cleared — it simply didn't match these rules.

| Tool | Question it answers |
| ---- | ------------------- |
| **Dose Lab** | Does the formula make sense? |
| **Claims Lab** | Does the language cross a regulatory line? |

Same philosophy. No scores, no fake statistics. Rules, evidence, and useful suggestions.

## What it does

A dietary supplement may make a **structure/function** claim — *"supports restful sleep"* —
but not a **disease** claim — *"treats insomnia"*. FDA defines the line in
[21 CFR 101.93(g)](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-F/section-101.93)
with ten criteria, and illustrates each with worked examples in its
[Small Entity Compliance Guide](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/small-entity-compliance-guide-structurefunction-claims).

Claims Lab turns those criteria into rules. Paste label or ad copy and it:

- **Marks up the copy** — each claim underlined and numbered where it sits in your text
- **Names the paragraph** each claim maps to, with a link to the regulation
- **Explains why**, and quotes FDA's own example for that criterion where one exists
- **Suggests a structure/function rewrite** — clearly labelled as a template, not a determination
- **Checks the disclaimer** — present, incomplete, or missing; singular vs plural form
- **Notes the requirements** a structure/function claim still carries: substantiation,
  the disclaimer, and FDA notification within 30 days of first marketing

### What it never says

It never outputs a score, a percentage, a risk level, or a verdict. There is no
"87% compliant", no "low risk", no "FDA approved". The test suite fails if that language
ever appears in the interface.

## How it decides

```
Claims Lab
├── Claim parser         sentences, with offsets back into your text
├── Rule engine          data/rules.json — 48 rules, each mapped to a paragraph
│   ├── (g)(2)(i)        specific diseases
│   ├── (g)(2)(ii)       signs and symptoms  ("reduces cholesterol")
│   ├── (g)(2)(iii)      abnormal natural states  ("cystic acne")
│   ├── (g)(2)(iv)       names, formulation, the word "disease"
│   ├── (g)(2)(v)        drug product classes  ("antiviral", "analgesic")
│   ├── (g)(2)(vi)       substitute for therapy  ("nature's Ozempic")
│   ├── (g)(2)(vii)      augments therapy
│   ├── (g)(2)(viii)     body's response to disease  ("resist infection")
│   ├── (g)(2)(ix)       adverse events of therapy
│   ├── (g)(1)           nutrient-deficiency exception
│   └── 343(r)(6)(B)     substantiation language
└── Disclaimer detector  101.93(c), singular/plural, never self-flagged
```

The rule engine makes every determination. It is deterministic, has no network access and
no model, and the same input always produces the same result.

Findings fall into five kinds:

| Kind | Meaning |
| ---- | ------- |
| **Disease claim** | Wording matches a (g)(2) criterion directly |
| **Needs review** | Wording FDA says depends on context — "prevent", "anxiety", "inflammation" |
| **Structure/function claim** | The permitted kind, with its requirements listed |
| **Substantiation language** | "Clinically proven", "doctor recommended" |
| **Nutrient-deficiency disease** | Excluded from the definition of disease under (g)(1) |

## Tested against FDA's own examples

`test/fda-examples.test.mjs` quotes FDA's compliance guide directly:

- **16 unacceptable examples** must each be flagged as a disease claim, *under the correct paragraph*
- **11 acceptable examples** must not be flagged at all
- Plus the disclaimer, the deficiency exception, known false positives, and real marketing copy
  that broke earlier versions

```bash
npm test
```

```
48 passed, 0 failed
```

## Running it

No build step, no dependencies.

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. A server is required because the page reads
`data/rules.json`. Nothing you type is sent anywhere.

## What it can't check

- Images, symbols and colours on the pack — (g)(2)(iv) counts these; this reads text only
- Product names in context — only names built around *cure* or an obvious condition
- The catch-all criterion (g)(2)(x)
- Whether your substantiation is adequate
- Health claims and nutrient content claims (21 CFR 101.14, 101.13)
- Advertising outside the label, which falls under the FTC
- Disclaimer placement and type size under 101.93(d) and (e)
- Anything outside its word lists

## Corrections

The rules are the product. They live in `data/rules.json` so someone who knows supplement
regulation can read and correct them without touching the code — see [REVIEW.md](REVIEW.md).
Pull requests welcome. Please cite a source, and add a test case.

## Licence

MIT — see [LICENSE](LICENSE).
