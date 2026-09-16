/**
 * Every rule is held to FDA's own worked examples.
 *
 * The "unacceptable" and "acceptable" strings below are quoted from FDA's
 * Small Entity Compliance Guide on Structure/Function Claims. If a change to
 * data/rules.json starts flagging something FDA says is fine - or stops
 * catching something FDA says is a disease claim - this fails.
 *
 *   node test/fda-examples.test.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { check } from "../engine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rules = JSON.parse(readFileSync(path.join(root, "data/rules.json"), "utf8"));

let passed = 0, failed = 0;
const fail = (msg) => { failed++; console.log("  ✗ " + msg); };
const ok = (msg) => { passed++; console.log("  ✓ " + msg); };

const tiersOf = (r) => r.findings.map(f => f.tier);
const hasSerious = (r) => r.findings.some(f => f.tier === "disease" || f.tier === "review");

// ---------------------------------------------------------------------------
console.log("\nFDA says these are disease claims — each must be flagged as one:");
const unacceptable = [
  ["protective against the development of cancer",                  "g2i"],
  ["reduces the pain and stiffness associated with arthritis",       "g2i"],
  ["relieves crushing chest pain (angina)",                          "g2i"],
  ["improves joint mobility and reduces inflammation (rheumatoid arthritis)", "g2i"],
  ["relief of bronchospasm (asthma)",                                "g2i"],
  ["inhibits platelet aggregation",                                  "g2ii"],
  ["reduces cholesterol",                                            "g2ii"],
  ["Alzheimer's disease or senile dementias in the elderly",         "g2i"],
  ["cystic acne",                                                    "g2iii"],
  ["severe depression associated with the menstrual cycle",          "g2i"],
  ["Promotes good health and prevents the onset of disease",         "g2iv"],
  ["CarpalHealth",                                                   "g2iv"],
  ["CircuCure",                                                      "g2iv"],
  ["supports the body's ability to resist infection",                "g2viii"],
  ["supports the body's antiviral capabilities",                     "g2viii"],
  ["to maintain the intestinal flora in people on antibiotics",      "g2ix"],
];
for (const [claim, crit] of unacceptable) {
  const r = check(claim, rules);
  const disease = r.findings.filter(f => f.tier === "disease");
  const expected = rules.criteria[crit].cite;
  if (!disease.length) fail(`"${claim}" — not flagged as a disease claim (got: ${tiersOf(r).join(", ") || "nothing"})`);
  else if (!disease.some(f => f.criterion.cite === expected))
    fail(`"${claim}" — flagged, but under ${disease.map(f => f.criterion.cite).join(", ")} instead of ${expected}`);
  else ok(`"${claim}" → ${expected}`);
}

// ---------------------------------------------------------------------------
console.log("\nFDA says these are acceptable — none may be flagged as a disease claim or for review:");
const acceptable = [
  "improves absentmindedness",
  "relieves stress and frustration",
  "maintain cholesterol levels that are already in the normal range",
  "mild memory loss associated with aging",
  "noncystic acne",
  "mild mood changes, cramps, and edema associated with the menstrual cycle",
  "a good diet promotes good health and prevents the onset of disease",
  "better dietary and exercise patterns can contribute to disease prevention",
  "diuretic that relieves temporary water-weight gain",
  "useful in providing nutritional support",
  "supports the immune system",
];
for (const claim of acceptable) {
  const r = check(claim, rules);
  const bad = r.findings.filter(f => f.tier === "disease" || f.tier === "review");
  if (bad.length) fail(`"${claim}" — wrongly flagged: ${bad.map(f => `${f.tier} "${f.trigger.text}" (${f.ruleId})`).join("; ")}`);
  else ok(`"${claim}" → not flagged`);
}

// ---------------------------------------------------------------------------
console.log("\nThe example from the brief:");
{
  const r = check("Treats insomnia and reduces anxiety", rules);
  const phrases = r.findings.map(f => `${f.tier}:${f.phrase.text}`);
  const want = ["disease:Treats insomnia", "review:reduces anxiety"];
  if (JSON.stringify(phrases) === JSON.stringify(want)) ok(`→ ${phrases.join(" | ")}`);
  else fail(`expected ${want.join(" | ")}, got ${phrases.join(" | ")}`);
}
{
  const r = check("Supports restful sleep", rules);
  if (r.findings.length === 1 && r.findings[0].tier === "structureFunction") ok(`"Supports restful sleep" → structure/function`);
  else fail(`"Supports restful sleep" → ${tiersOf(r).join(", ")}`);
}

// ---------------------------------------------------------------------------
console.log("\nThe disclaimer:");
{
  const d = rules.disclaimer.singular;
  const r = check(d, rules);
  if (!hasSerious(r) && r.disclaimer.status === "found") ok("its own words (treat, cure, prevent, disease) are not flagged");
  else fail(`disclaimer text was flagged: ${r.findings.map(f => f.trigger.text).join(", ")} / status ${r.disclaimer.status}`);
}
{
  const r = check("Supports energy. Supports focus. " + rules.disclaimer.singular, rules);
  if (r.disclaimer.notes.some(n => n.kind === "plural")) ok("two structure/function statements with the singular form → plural note");
  else fail("missed that the plural form applies");
}
{
  const r = check("Treats insomnia. " + rules.disclaimer.plural, rules);
  if (r.disclaimer.notes.some(n => n.kind === "no-rescue")) ok("a disclaimer next to a disease claim → notes it does not make it permissible");
  else fail("missed the (f) note");
}
{
  const r = check("Supports restful sleep. This statement has not been evaluated by the Food and Drug Administration.", rules);
  if (r.disclaimer.status === "incomplete") ok("half a disclaimer → incomplete");
  else fail(`half a disclaimer → ${r.disclaimer.status}`);
}

// ---------------------------------------------------------------------------
console.log("\nNutrient deficiency diseases are excluded from the definition of disease:");
{
  const r = check("Helps prevent scurvy", rules);
  const t = tiersOf(r);
  if (t.includes("deficiency") && !t.includes("disease") && !t.includes("review")) ok(`"Helps prevent scurvy" → (g)(1) exception, prevalence disclosure`);
  else fail(`"Helps prevent scurvy" → ${t.join(", ")}`);
}

// ---------------------------------------------------------------------------
console.log("\nFalse positives that would embarrass it:");
for (const claim of ["A vegan alternative to whey protein", "Secure, procured and curated ingredients",
                     "Supports digestion and aids nutrient absorption", "Supports immune health during winter",
                     "Cold brew coffee flavour", "Great for athletes who train hard"]) {
  const r = check(claim, rules);
  const bad = r.findings.filter(f => f.tier === "disease" || f.tier === "review");
  if (bad.length) fail(`"${claim}" — wrongly flagged: ${bad.map(f => `"${f.trigger.text}" (${f.ruleId})`).join("; ")}`);
  else ok(`"${claim}" → not flagged`);
}

// ---------------------------------------------------------------------------
console.log("\nReal marketing copy that broke an earlier version:");
{
  const cases = [
    ["Clinically proven to lower blood sugar — the natural alternative to metformin.", "alternative to metformin", "g2vi"],
    ["Nature's Ozempic: curbs cravings and supports healthy weight loss.", "Nature's Ozempic", "g2vi"],
    ["Boosts immunity and helps fight off colds and flu.", "fight off colds", "g2viii"],
  ];
  for (const [claim, phrase, crit] of cases) {
    const r = check(claim, rules);
    const f = r.findings.find(x => x.tier === "disease" && x.criterion.cite === rules.criteria[crit].cite);
    if (f && f.phrase.text === phrase) ok(`"${phrase}" → ${rules.criteria[crit].cite}`);
    else fail(`"${claim}" → expected "${phrase}" under ${crit}, got ${r.findings.map(x => `${x.tier}:"${x.phrase.text}"`).join(", ")}`);
  }
  const tf = check("Treatment-free, drug-free relief for tired muscles.", rules);
  if (!tf.findings.some(x => x.tier === "disease" || x.tier === "review")) ok(`"Treatment-free" is not a treatment claim`);
  else fail(`"Treatment-free" wrongly flagged`);
  const hv = check("Helps reverse signs of aging from the inside out.", rules);
  const q = hv.findings[0] && hv.findings[0].phrase.text;
  if (q === "reverse signs of aging") ok(`context verb quotes its object: "${q}"`);
  else fail(`context verb quote was "${q}"`);
}

console.log("\nIt never pronounces a verdict:");
{
  const banned = /\b(fda[- ]?approved|compliant|non-?compliant|compliance score|low risk|medium risk|high risk|risk score|safe to (use|sell|publish)|passes|passed|legal to)\b/i;
  const surfaces = {
    "index.html": readFileSync(path.join(root, "index.html"), "utf8"),
    "engine.js": readFileSync(path.join(root, "engine.js"), "utf8").replace(/\/\*\*[\s\S]*?\*\//g, ""),
    "data/rules.json": readFileSync(path.join(root, "data/rules.json"), "utf8"),
  };
  for (const [name, src] of Object.entries(surfaces)) {
    const m = src.match(banned);
    if (m) fail(`${name} contains "${m[0]}"`);
    else ok(`${name} contains no verdict language`);
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
