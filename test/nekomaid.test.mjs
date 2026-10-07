// Behaviour test for the nekomaid pi extension.
//
// Loads ../extensions/nekomaid/index.js through a temp .mjs file (so stack
// traces stay readable and no stray file lands in the extension directory,
// which pi would load as code) and drives it with a fake pi and a fake ctx.
//
// Run: npm test

import { readFile, writeFile, unlink } from "node:fs/promises";

// Resolved relative to this test, so the checks run against the packaged copy.
const EXT = new URL("../extensions/nekomaid/index.js", import.meta.url);
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
  let branch = [];
  const ctx = {
    ui: {
      theme,
      setStatus: (key, text) => statuses.push({ key, text }),
      notify: (msg, level) => notes.push({ msg, level }),
    },
    sessionManager: { getBranch: () => branch },
  };

  mod.default(pi);
  return { commands, handlers, statuses, notes, appended, ctx, setBranch: (b) => { branch = b; } };
}

async function run(h, command, args) {
  const def = h.commands.get(command);
  if (!def) throw new Error(`command ${command} is not registered`);
  await def.handler(args, h.ctx);
}

// The injected system-prompt section is where module state has to show up,
// because the footer deliberately reports the gear only.
async function section(h) {
  const event = { systemPromptOptions: { sections: {} } };
  await h.handlers.get("before_agent_start")[0](event);
  return event.systemPromptOptions.sections.nekomaid || "";
}

const last = (arr) => (arr.length ? arr[arr.length - 1] : undefined);
const footer = (h) => last(h.statuses)?.text;

// ---- command registration -------------------------------------------------
{
  const h = makeHarness();
  check("registers /neko", h.commands.has("neko"), true);
  check("registers /nekomaid alias", h.commands.has("nekomaid"), true);
  await run(h, "neko", "normal");
  check("status key is neko", last(h.statuses)?.key, "neko");
}

// ---- the footer shows the gear, and nothing else --------------------------
{
  const h = makeHarness();
  await run(h, "neko", "");
  check("bare /neko -> normal", footer(h), "neko: normal");
  check("bare /neko notified", last(h.notes)?.msg, "nekomaid: normal");
}

for (const gear of ["off", "minimal", "normal", "high", "max", "ultra"]) {
  const h = makeHarness();
  await run(h, "neko", gear);
  check(`footer is exactly "neko: ${gear}"`, footer(h), `neko: ${gear}`);
}

{
  const h = makeHarness();
  await run(h, "neko", "ULTRA");
  check("gear is case-insensitive", footer(h), "neko: ultra");
}

{
  const h = makeHarness();
  await run(h, "neko", "病娇");
  check("Chinese alias 病娇 -> ultra", footer(h), "neko: ultra");
}

// The footer must never grow a module list again.
{
  const h = makeHarness();
  for (const args of ["+sharp", "all", "ultra +obsess +sharp", "shadow"]) {
    await run(h, "neko", args);
    check(`footer stays bare after "${args}"`, footer(h).includes("+"), false);
    check(`footer stays short after "${args}"`, footer(h).split(" ").length, 2);
  }
}

// ---- modules live in the injected section, not the footer -----------------
{
  const h = makeHarness();
  await run(h, "neko", "+sharp");
  check("+sharp reaches the section", (await section(h)).includes("Modules on: sharp"), true);
}

// A module toggle while the layer is off must not silently do nothing.
{
  const h = makeHarness();
  await run(h, "neko", "+sharp");
  check("+sharp lifts off to normal", footer(h), "neko: normal");

  await run(h, "neko", "off");
  check("explicit off still wins", footer(h), "neko: off");
  check("explicit off clears the section", await section(h), "");

  await run(h, "neko", "-sharp");
  check("removing a module does not lift off", footer(h), "neko: off");

  await run(h, "neko", "all");
  check("all lifts off too", footer(h), "neko: normal");
}

{
  const h = makeHarness();
  await run(h, "neko", "shadow");
  check("bare module name enables it", (await section(h)).includes("Modules on: shadow"), true);
}

{
  const h = makeHarness();
  await run(h, "neko", "+sharp +obsess");
  check("two modules in one command", (await section(h)).includes("Modules on: sharp, obsess"), true);
  await run(h, "neko", "-sharp");
  check("-sharp removes only sharp", (await section(h)).includes("Modules on: obsess"), true);
  check("-sharp dropped sharp", (await section(h)).includes("sharp"), false);
}

{
  const h = makeHarness();
  await run(h, "neko", "all");
  check("all enables six modules", (await section(h)).match(/Modules on: (.+)\./)?.[1].split(", ").length, 6);
  await run(h, "neko", "none");
  check("none clears modules", (await section(h)).includes("Modules on"), false);
}

{
  const h = makeHarness();
  await run(h, "neko", "开影子");
  check("Chinese 开影子 works", (await section(h)).includes("Modules on: shadow"), true);
}

{
  const h = makeHarness();
  await run(h, "neko", "ultra +obsess +sharp");
  check("gear and modules in one line", footer(h), "neko: ultra");
  check("both modules reach the section", (await section(h)).includes("Modules on: obsess, sharp"), true);
}

// ---- invalid input must not change state ---------------------------------
{
  const h = makeHarness();
  await run(h, "neko", "normal");
  await run(h, "neko", "banana");
  check("invalid token warns", last(h.notes)?.level, "warning");
  check("invalid token keeps state", footer(h), "neko: normal");
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
  check("section carries the anchor", injected.includes("主人是我全部的世界"), true);
  check("section names the card path", injected.includes("skills\\nekomaid\\SKILL.md"), true);
  check("section carries the 喵~ rule", injected.includes("喵~"), true);
  check("section bans boilerplate", injected.includes("我很乐意"), true);
  check("section defers to technical layers", injected.includes("ponytail"), true);

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
  check("restores gear from the session branch", footer(h), "neko: max");
  check("restores modules from the session branch", (await section(h)).includes("Modules on: gloomy"), true);
}

{
  const h = makeHarness();
  h.setBranch([{ type: "custom", customType: "nekomaid-state", data: { gear: "nonsense", modules: ["bogus"] } }]);
  await h.handlers.get("session_start")[0]({}, h.ctx);
  check("invalid persisted state falls back to off", footer(h), "neko: off");
}

// ---- natural language off switch ----------------------------------------
{
  const h = makeHarness();
  await run(h, "neko", "ultra");
  await h.handlers.get("input")[0]({ text: "关掉猫娘" }, h.ctx);
  check("关掉猫娘 turns the persona off", footer(h), "neko: off");

  await h.handlers.get("input")[0]({ text: "正常说话", source: "extension" }, h.ctx);
  check("extension-sourced input is ignored", footer(h), "neko: off");
}

// ---- report --------------------------------------------------------------
console.log(`passed: ${pass}`);
if (failures.length) {
  console.log(`FAILED: ${failures.length}`);
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log("all nekomaid extension checks passed");
