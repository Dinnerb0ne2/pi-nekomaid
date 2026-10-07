// Behaviour test for the nekomaid pi extension.
//
// Loads .pi/agent/extensions/nekomaid/index.js through a data: URL (so no stray
// file lands in the extension directory, which pi would try to load) and drives
// it with a fake pi and a fake ctx. Fails loudly on any mismatch.
//
// Run: node nekomaid_ext_test.mjs

import { readFile, writeFile, unlink } from "node:fs/promises";

// Resolved relative to this test, so the checks run against the packaged copy.
const EXT = new URL("../extensions/nekomaid/index.js", import.meta.url);
// Import through a temp .mjs so stack traces stay readable. It lives next to
// this test, never in the extension directory, which pi would load as code.
const TMP = new URL("./.nekomaid-ext.tmp.mjs", import.meta.url);

await writeFile(TMP, await readFile(EXT, "utf8"));
let mod;
try {
  mod = await import(`${TMP.href}?v=${Date.now()}`);
} finally {
  await unlink(TMP).catch(() => {});
}

let pass = 0;
const failures = [];

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass += 1;
  else failures.push(`${label}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`);
}

function makeHarness() {
  const commands = new Map();
  const handlers = new Map();
  const statuses = [];
  const notes = [];
  const appended = [];

  const pi = {
    registerCommand(name, def) {
      commands.set(name, def);
    },
    on(event, fn) {
      handlers.set(event, [...(handlers.get(event) || []), fn]);
      return () => {};
    },
    appendEntry(customType, data) {
      appended.push({ customType, data });
    },
    sendUserMessage() {},
  };

  const theme = { fg: (_slot, text) => text };
  const ctx = {
    ui: {
      theme,
      setStatus: (key, text) => statuses.push({ key, text }),
      notify: (msg, level) => notes.push({ msg, level }),
    },
    sessionManager: { getBranch: () => branch },
  };
  let branch = [];

  mod.default(pi);
  return { commands, handlers, statuses, notes, appended, ctx, setBranch: (b) => { branch = b; } };
}

async function run(h, command, args) {
  const def = h.commands.get(command);
  if (!def) throw new Error(`command ${command} is not registered`);
  await def.handler(args, h.ctx);
}

const last = (arr) => (arr.length ? arr[arr.length - 1] : undefined);

// ---- command registration -------------------------------------------------
{
  const h = makeHarness();
  check("registers /neko", h.commands.has("neko"), true);
  check("registers /nekomaid alias", h.commands.has("nekomaid"), true);
  check("status key is neko", (await (async () => {
    await run(h, "neko", "normal");
    return last(h.statuses)?.key;
  })()), "neko");
}

// ---- bare command defaults to normal -------------------------------------
{
  const h = makeHarness();
  await run(h, "neko", "");
  check("bare /neko -> normal", last(h.statuses)?.text.includes("neko: normal"), true);
  check("bare /neko notified", last(h.notes)?.msg, "nekomaid: normal");
}

// ---- gears ---------------------------------------------------------------
for (const gear of ["off", "minimal", "normal", "high", "max", "ultra"]) {
  const h = makeHarness();
  await run(h, "neko", gear);
  check(`/neko ${gear} shows in status`, last(h.statuses)?.text.includes(`neko: ${gear}`), true);
}

{
  const h = makeHarness();
  await run(h, "neko", "ULTRA");
  check("gear is case-insensitive", last(h.statuses)?.text.includes("neko: ultra"), true);
}

{
  const h = makeHarness();
  await run(h, "neko", "病娇");
  check("Chinese alias 病娇 -> ultra", last(h.statuses)?.text.includes("neko: ultra"), true);
}

// ---- modules -------------------------------------------------------------
{
  const h = makeHarness();
  await run(h, "neko", "+sharp");
  check("+sharp shows in status", last(h.statuses)?.text.includes("+sharp"), true);
}

{
  const h = makeHarness();
  await run(h, "neko", "shadow");
  check("bare module name enables it", last(h.statuses)?.text.includes("+shadow"), true);
}

{
  const h = makeHarness();
  await run(h, "neko", "+sharp +obsess");
  check("two modules in one command", last(h.statuses)?.text.includes("+sharp+obsess"), true);
  await run(h, "neko", "-sharp");
  check("-sharp removes only sharp", last(h.statuses)?.text.includes("+obsess"), true);
  check("-sharp dropped sharp", last(h.statuses)?.text.includes("+sharp"), false);
}

{
  const h = makeHarness();
  await run(h, "neko", "all");
  check("all enables six modules", last(h.statuses)?.text.split("+").length - 1, 6);
  await run(h, "neko", "none");
  check("none clears modules", last(h.statuses)?.text.includes("+"), false);
}

{
  const h = makeHarness();
  await run(h, "neko", "开影子");
  check("Chinese 开影子 works", last(h.statuses)?.text.includes("+shadow"), true);
}

// ---- gear + module in one line -------------------------------------------
{
  const h = makeHarness();
  await run(h, "neko", "ultra +obsess +sharp");
  const text = last(h.statuses)?.text || "";
  check("gear and modules together", text.includes("neko: ultra") && text.includes("+obsess") && text.includes("+sharp"), true);
}

// ---- invalid input must not change state ---------------------------------
{
  const h = makeHarness();
  await run(h, "neko", "normal");
  await run(h, "neko", "banana");
  check("invalid token warns", last(h.notes)?.level, "warning");
  check("invalid token keeps state", last(h.statuses)?.text.includes("neko: normal"), true);
}

// ---- system prompt section ----------------------------------------------
{
  const h = makeHarness();
  const before = h.handlers.get("before_agent_start")[0];

  const offSection = { systemPromptOptions: { sections: {} } };
  await before(offSection);
  check("gear off injects nothing", offSection.systemPromptOptions.sections.nekomaid, undefined);

  await run(h, "neko", "ultra");
  const onSection = { systemPromptOptions: { sections: {} } };
  await before(onSection);
  const injected = onSection.systemPromptOptions.sections.nekomaid || "";
  check("ultra injects a section", injected.includes("Active gear: ultra"), true);
  check("section names the card path", injected.includes("skills\\nekomaid\\SKILL.md"), true);
  check("section carries the 喵~ rule", injected.includes("喵~"), true);
  check("section defers to technical layers", injected.includes("ponytail"), true);

  await run(h, "neko", "+sharp");
  const withMod = { systemPromptOptions: { sections: {} } };
  await before(withMod);
  check("module listed in section", (withMod.systemPromptOptions.sections.nekomaid || "").includes("Active modules: sharp"), true);

  await run(h, "neko", "off");
  const cleared = { systemPromptOptions: { sections: { nekomaid: "stale" } } };
  await before(cleared);
  check("gear off clears a stale section", cleared.systemPromptOptions.sections.nekomaid, undefined);
}

// ---- fallback path when pi has no structured sections ---------------------
{
  const h = makeHarness();
  await run(h, "neko", "high");
  const before = h.handlers.get("before_agent_start")[0];
  const result = await before({ systemPrompt: "BASE" });
  check("falls back to systemPrompt append", typeof result?.systemPrompt === "string" && result.systemPrompt.startsWith("BASE\n\n"), true);
}

// ---- session restore -----------------------------------------------------
{
  const h = makeHarness();
  await run(h, "neko", "max +gloomy");
  h.setBranch([
    { type: "custom", customType: "nekomaid-state", data: { gear: "max", modules: ["gloomy"] } },
  ]);
  h.statuses.length = 0;
  await h.handlers.get("session_start")[0]({}, h.ctx);
  check("restores gear from the session branch", last(h.statuses)?.text.includes("neko: max"), true);
  check("restores modules from the session branch", last(h.statuses)?.text.includes("+gloomy"), true);
}

{
  const h = makeHarness();
  h.setBranch([{ type: "custom", customType: "nekomaid-state", data: { gear: "nonsense", modules: ["bogus"] } }]);
  await h.handlers.get("session_start")[0]({}, h.ctx);
  check("invalid persisted state falls back to off", last(h.statuses)?.text.includes("neko: off"), true);
}

// ---- natural language off switch ----------------------------------------
{
  const h = makeHarness();
  await run(h, "neko", "ultra");
  await h.handlers.get("input")[0]({ text: "关掉猫娘" }, h.ctx);
  check("关掉猫娘 turns the persona off", last(h.statuses)?.text.includes("neko: off"), true);

  await h.handlers.get("input")[0]({ text: "正常说话", source: "extension" }, h.ctx);
  check("extension-sourced input is ignored", last(h.statuses)?.text.includes("neko: off"), true);
}

// ---- busy indicator ------------------------------------------------------
{
  const h = makeHarness();
  await run(h, "neko", "normal");
  await h.handlers.get("agent_start")[0]({}, h.ctx);
  check("busy dot on agent_start", last(h.statuses)?.text.includes("\u25cf"), true);
  await h.handlers.get("agent_end")[0]({}, h.ctx);
  check("idle dot on agent_end", last(h.statuses)?.text.includes("\u25cb"), true);
}

// ---- report --------------------------------------------------------------
console.log(`passed: ${pass}`);
if (failures.length) {
  console.log(`FAILED: ${failures.length}`);
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log("all nekomaid extension checks passed");
