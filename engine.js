/**
 * Claims Lab rule engine.
 *
 * check(text, rules) -> { findings, counts, disclaimer, sentences }
 *
 * Pure and deterministic: no network, no model, no randomness. The same input
 * always produces the same findings, and every finding points at the paragraph
 * of 21 CFR 101.93 or 21 U.S.C. 343(r)(6) that its rule encodes.
 *
 * It never produces a score, a risk level, or a verdict of compliance. A
 * sentence with no findings has not been cleared - it just didn't match.
 */

const TIER_ORDER = { disease: 0, deficiency: 1, review: 2, substantiation: 3, structureFunction: 4 };

function toSource(pattern) {
  // A literal space in a pattern means "any run of whitespace".
  return pattern.replace(/ /g, "\\s+");
}

function compile(rule) {
  const src = rule.patterns.map(toSource).join("|");
  const body = rule.boundaries === false ? `(?:${src})` : `\\b(?:${src})\\b`;
  return new RegExp(body, rule.caseSensitive ? "g" : "gi");
}

const compiled = new WeakMap();
function prepare(rules) {
  if (compiled.has(rules)) return compiled.get(rules);
  const prepared = {
    rules: rules.rules.map(r => ({
      ...r,
      re: compile(r),
      unlessRe: r.unless ? new RegExp(r.unless, "i") : null,
    })),
    general: new RegExp(toSource(rules.generalStatement), "i"),
    sf: compile({ patterns: rules.structureFunction.patterns }),
    evaluated: new RegExp(toSource(rules.disclaimer.evaluated), "gi"),
    intended: new RegExp(toSource(rules.disclaimer.intended), "gi"),
    phraseVerbs: new Set(rules.phraseVerbs.map(v => v.toLowerCase())),
  };
  compiled.set(rules, prepared);
  return prepared;
}

/** Split into sentences, keeping offsets into the original text. */
function splitSentences(text) {
  const out = [];
  let start = 0;
  const push = (s, e) => {
    let a = s, b = e;
    while (a < b && /\s/.test(text[a])) a++;
    while (b > a && /[\s]/.test(text[b - 1])) b--;
    if (b > a && /[a-z]/i.test(text.slice(a, b))) out.push({ start: a, end: b, text: text.slice(a, b) });
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    const stop = c === "\n" || c === "•" || c === ";" ||
      ((c === "." || c === "!" || c === "?") && (next === undefined || /\s/.test(next)));
    if (stop) { push(start, c === "\n" || c === "•" ? i : i + 1); start = i + 1; }
  }
  push(start, text.length);
  return out;
}

/** Find the disclaimer, and blank it out so its own words aren't flagged. */
function findDisclaimer(text, p) {
  const ranges = [];
  let evaluated = null, intended = null;
  for (const [key, re] of [["evaluated", p.evaluated], ["intended", p.intended]]) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (!m) continue;
    const hit = { start: m.index, end: m.index + m[0].length, text: m[0] };
    if (key === "evaluated") evaluated = hit; else intended = hit;
    // Extend to the surrounding sentence so the trailing punctuation goes too.
    let s = hit.start, e = hit.end;
    while (s > 0 && !/[.!?\n]/.test(text[s - 1])) s--;
    while (e < text.length && !/[.!?\n]/.test(text[e])) e++;
    ranges.push([s, Math.min(text.length, e + 1)]);
  }
  let masked = text;
  for (const [s, e] of ranges) masked = masked.slice(0, s) + masked.slice(s, e).replace(/[^\n]/g, " ") + masked.slice(e);

  let form = null;
  if (evaluated) form = /these statements have/i.test(evaluated.text) ? "plural" : "singular";
  const status = evaluated && intended ? "found" : (evaluated || intended ? "incomplete" : "absent");
  return { masked, status, form, ranges };
}

const overlaps = (a, b) => a.start < b.end && b.start < a.end;

/** Walk back from a match to the nearest claim verb, so a card can quote "Treats insomnia". */
function phraseStart(text, sentence, hitStart, p) {
  let from = sentence.start;
  const clause = /[—–:()]/g;
  let c;
  const seg = text.slice(sentence.start, hitStart);
  while ((c = clause.exec(seg))) from = sentence.start + c.index + 1;
  const before = text.slice(from, hitStart);
  const tokens = [];
  const tokRe = /[A-Za-z'’-]+/g;
  let m;
  while ((m = tokRe.exec(before))) tokens.push({ word: m[0].toLowerCase(), at: from + m.index });
  const window = tokens.slice(-8);
  for (let i = window.length - 1; i >= 0; i--) {
    if (p.phraseVerbs.has(window[i].word)) {
      // "protective against", "protects against": start at the adjective/verb, not the preposition.
      if (window[i].word === "against" && i > 0 && /^protect/.test(window[i - 1].word)) return window[i - 1].at;
      return window[i].at;
    }
  }
  const fallback = tokens.slice(-2);
  return fallback.length ? fallback[0].at : hitStart;
}

function phraseEnd(text, sentence, hitEnd, words) {
  const rest = text.slice(hitEnd, sentence.end);
  const stop = rest.search(/[,;:—–.!?()]|\s(and|but|while|so)\s/);
  const clause = stop === -1 ? rest : rest.slice(0, stop);
  const m = clause.match(new RegExp(`^(\\s+[^\\s]+){0,${words}}`));
  let taken = m ? m[0] : "";
  // Don't leave the quote hanging on a function word: "reverse signs of aging from".
  taken = taken.replace(/(\s+(from|to|of|the|a|an|with|for|in|on|your|and|by|at))+$/i, "");
  return hitEnd + taken.length;
}

function trimTo(text, start, end, maxWords) {
  const slice = text.slice(start, end).replace(/[\s.,;:!?]+$/, "");
  const words = slice.split(/\s+/);
  if (words.length <= maxWords) return { end: start + slice.length, text: slice };
  const short = words.slice(0, maxWords).join(" ");
  return { end: start + short.length, text: short + "…" };
}

export function check(input, rules) {
  const text = String(input || "");
  const p = prepare(rules);
  const disclaimer = findDisclaimer(text, p);
  const work = disclaimer.masked;
  const sentences = splitSentences(work);
  const findings = [];

  for (const s of sentences) {
    const general = p.general.test(s.text);
    let hits = [];

    for (const r of p.rules) {
      if (r.unlessRe && r.unlessRe.test(s.text)) continue;
      if (general && r.suppressInGeneralStatement) continue;
      r.re.lastIndex = 0;
      let m;
      while ((m = r.re.exec(s.text))) {
        if (m[0].length === 0) { r.re.lastIndex++; continue; }
        const start = s.start + m.index;
        hits.push({ rule: r, start, end: start + m[0].length });
      }
    }

    // Longest match wins an overlap; ties go to the more serious tier.
    hits.sort((a, b) => (b.end - b.start) - (a.end - a.start) || b.rule.priority - a.rule.priority);
    const kept = [];
    for (const h of hits) if (!kept.some(k => overlaps(k, h))) kept.push(h);

    // Quote the claim, not just the trigger word.
    for (const h of kept) {
      h.phraseStart = h.rule.tier === "disease" && !h.rule.phraseFromMatch
        ? phraseStart(work, s, h.start, p) : h.start;
      h.phraseEnd = h.rule.contextVerb ? phraseEnd(work, s, h.end, 4) : h.end;
    }
    // "Treats insomnia" is one claim: a bare context verb inside a disease phrase is absorbed.
    const absorbed = kept.filter(h => h.rule.contextVerb && kept.some(d =>
      d !== h && d.rule.tier === "disease" && h.start >= d.phraseStart && h.end <= d.end));
    const final = kept.filter(h => !absorbed.includes(h));

    for (const h of final) {
      findings.push({
        tier: h.rule.tier,
        ruleId: h.rule.id,
        criterion: rules.criteria[h.rule.criterion],
        secondary: h.rule.secondary ? rules.criteria[h.rule.secondary] : null,
        reason: h.rule.reason,
        fdaExample: h.rule.fdaExample || null,
        rewrite: h.rule.rewrite || null,
        noRewrite: h.rule.noRewrite || null,
        trigger: { start: h.start, end: h.end, text: text.slice(h.start, h.end) },
        phrase: { start: h.phraseStart, end: h.phraseEnd, text: text.slice(h.phraseStart, h.phraseEnd) },
        sentence: { start: s.start, end: s.end, text: text.slice(s.start, s.end) },
      });
    }

    // Structure/function language, only where nothing more serious matched.
    const serious = final.some(h => h.rule.tier === "disease" || h.rule.tier === "review");
    if (!serious) {
      p.sf.lastIndex = 0;
      const m = p.sf.exec(s.text);
      if (m) {
        const start = s.start + m.index;
        const t = trimTo(text, start, s.end, 12);
        findings.push({
          tier: "structureFunction",
          ruleId: "structure-function",
          criterion: rules.criteria.f,
          secondary: null,
          reason: rules.structureFunction.reason,
          fdaExample: null, rewrite: null, noRewrite: null,
          trigger: { start, end: start + m[0].length, text: m[0] },
          phrase: { start, end: t.end, text: t.text },
          sentence: { start: s.start, end: s.end, text: text.slice(s.start, s.end) },
        });
      }
    }
  }

  findings.sort((a, b) => a.phrase.start - b.phrase.start || TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
  findings.forEach((f, i) => { f.n = i + 1; });

  const counts = { disease: 0, deficiency: 0, review: 0, substantiation: 0, structureFunction: 0 };
  for (const f of findings) counts[f.tier]++;

  const notes = [];
  if (counts.structureFunction > 1 && disclaimer.form === "singular") {
    notes.push({ kind: "plural", criterion: rules.criteria.c,
      text: "There is more than one structure/function statement, so the plural form of the disclaimer applies.",
      expected: rules.disclaimer.plural });
  }
  if (disclaimer.status !== "absent" && counts.disease > 0) {
    notes.push({ kind: "no-rescue", criterion: rules.criteria.f,
      text: "The disclaimer covers structure/function statements only. It does not make a disease claim permissible." });
  }

  return {
    findings,
    counts,
    disclaimer: { status: disclaimer.status, form: disclaimer.form, ranges: disclaimer.ranges, notes },
    notChecked: rules.notChecked,
  };
}
