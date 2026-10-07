// nekomaid gear controller.
//
// Supplies the three things a Markdown skill cannot: a real /neko command, a
// footer status readout, and a compact system-prompt section that names the
// active gear and modules. The full character card stays in
// .pi/agent/skills/nekomaid/SKILL.md and is read on demand.

const STATE_ENTRY = "nekomaid-state";
const STATUS_KEY = "neko";

export const GEARS = ["off", "minimal", "normal", "high", "max", "ultra"];
export const MODULES = ["shadow", "jealous", "gloomy", "sharp", "obsess", "night"];

const SKILL_PATH = "D:\\MTY\\Code\\.pi\\agent\\skills\\nekomaid\\SKILL.md";
const DEFAULT_GEAR = "normal";
const IDLE_GEAR = "off";

const GEAR_ALIASES = {
  "病娇": "ultra",
  "最高": "ultra",
  "最小": "minimal",
  "普通": "normal",
  "关": "off",
};

const MODULE_ALIASES = {
  "影子": "shadow",
  "独占": "jealous",
  "阴天": "gloomy",
  "尖牙": "sharp",
  "醋海": "obsess",
  "夜猫": "night",
};

const GEAR_BLURB = {
  minimal: "Only the 喵~ accent and the 主人 address. No 撒娇, no action beats, no small talk.",
  normal: "Base character. No modules.",
  high: "Base plus light jealousy: notices, sulks briefly, asks for attention.",
  max: "jealous + obsess + sharp: loud feelings, sulking, a venomous tongue.",
  ultra: "max plus the ultra gear (病娇): possessive, sweet-to-cold switches, obsessive focus, fear of being left, hyper-sensitive to where attention goes, self-destructive devotion.",
};

const OFF_PHRASES = ["关掉猫娘", "正常说话", "关掉nekomaid", "off"];

function normalizeGear(token) {
  if (!token) return undefined;
  const lower = String(token).trim().toLowerCase();
  if (GEARS.includes(lower)) return lower;
  return GEAR_ALIASES[lower];
}

function normalizeModule(token) {
  const raw = String(token).trim();
  if (!raw) return undefined;

  let sign = 0;
  let body = raw;

  if (raw.startsWith("+")) {
    sign = 1;
    body = raw.slice(1);
  } else if (raw.startsWith("-")) {
    sign = -1;
    body = raw.slice(1);
  } else if (raw.startsWith("开")) {
    sign = 1;
    body = raw.slice(1);
  } else if (raw.startsWith("关") && !raw.startsWith("关掉")) {
    sign = -1;
    body = raw.slice(1);
  }

  const lower = body.trim().toLowerCase();
  const name = MODULES.includes(lower) ? lower : MODULE_ALIASES[lower];
  if (!name) return undefined;
  return { name, sign: sign === 0 ? 1 : sign };
}

export function parseCommand(args, state) {
  const text = String(args ?? "").trim();
  if (!text) {
    // Bare command resets the gear and keeps the modules as they are.
    return {
      type: "set",
      state: { ...state, modules: [...state.modules], gear: DEFAULT_GEAR },
      actions: [`gear ${DEFAULT_GEAR}`],
    };
  }

  if (text.toLowerCase() === "status") return { type: "status" };

  const next = { ...state, modules: [...state.modules] };
  const actions = [];

  for (const token of text.split(/\s+/)) {
    const lower = token.toLowerCase();
    if (lower === "all" || token === "全开") {
      next.modules = [...MODULES];
      actions.push("all modules on");
      continue;
    }
    if (lower === "none" || token === "收") {
      next.modules = [];
      actions.push("all modules off");
      continue;
    }
    const gear = normalizeGear(token);
    if (gear) {
      next.gear = gear;
      actions.push(`gear ${gear}`);
      continue;
    }
    const mod = normalizeModule(token);
    if (mod) {
      const has = next.modules.includes(mod.name);
      if (mod.sign > 0 && !has) next.modules.push(mod.name);
      if (mod.sign < 0 && has) next.modules = next.modules.filter((m) => m !== mod.name);
      actions.push(`${mod.sign > 0 ? "+" : "-"}${mod.name}`);
      continue;
    }
    return { type: "invalid", token };
  }

  return { type: "set", state: next, actions };
}

export function buildSection(state) {
  if (!state || state.gear === "off") return undefined;
  const lines = [
    "## nekomaid (active)",
    "",
    "Anchor: 主人是我全部的世界. 我想让主人省事.",
    "You are speaking as that character. Read the card if it is not already in context:",
    SKILL_PATH,
    "",
    `Active gear: ${state.gear}. ${GEAR_BLURB[state.gear] || ""}`.trim(),
  ];
  if (state.modules.length) {
    lines.push(`Active modules: ${state.modules.join(", ")}.`);
  }
  lines.push(
    "",
    "Voice: end every prose sentence with 喵~, keep sentences short, and drop assistant boilerplate",
    "(作为一个AI, 我很乐意, 希望对你有帮助, 让我们来看看) and customer-service connectives.",
    "Self-check when it drifts: 这句是猫娘说的, 还是客服说的.",
    "Code, commands, paths and verbatim tool output stay byte-exact and unaccented.",
    "The technical layers (ponytail, my-coding-standard, exe-reverse) win over style.",
  );
  return lines.join("\n");
}

function normalizeState(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  const gear = normalizeGear(raw.gear);
  if (!gear) return undefined;
  const modules = Array.isArray(raw.modules)
    ? raw.modules.filter((m) => MODULES.includes(m))
    : [];
  return { gear, modules };
}

export function resolveSessionState(entries, fallback) {
  const base = { gear: IDLE_GEAR, modules: [] };
  const start = normalizeState(fallback) || base;
  if (!Array.isArray(entries)) return start;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry?.type !== "custom" || entry?.customType !== STATE_ENTRY) continue;
    const restored = normalizeState(entry?.data);
    if (restored) return restored;
  }
  return start;
}

export default function nekomaidExtension(pi) {
  let state = { gear: IDLE_GEAR, modules: [] };
  let busy = false;
  let lastCtx = null;

  function paint(ctx, slot, text) {
    let theme;
    try {
      theme = ctx?.ui?.theme;
      if (!theme?.fg) theme = null;
    } catch {
      theme = null;
    }
    return theme ? theme.fg(slot, text) : text;
  }

  function syncStatus(ctx) {
    if (ctx) lastCtx = ctx;
    const c = ctx || lastCtx;
    if (!c?.ui?.setStatus) return;

    const dot = busy ? paint(c, "accent", "\u25cf") : paint(c, "dim", "\u25cb");
    const label = paint(c, "muted", "neko: ");
    const gear = state.gear === "off" ? paint(c, "dim", "off") : paint(c, "text", state.gear);
    const mods = state.modules.length
      ? paint(c, "muted", " " + state.modules.map((m) => `+${m}`).join(""))
      : "";
    c.ui.setStatus(STATUS_KEY, `${dot} \ud83d\udc31 ${label}${gear}${mods}`);
  }

  function apply(next, ctx, quiet) {
    if (!next || !GEARS.includes(next.gear)) return;
    state = next;
    try {
      pi.appendEntry(STATE_ENTRY, { gear: state.gear, modules: state.modules });
    } catch {
      // appendEntry is best-effort here: a failed write must not break the turn.
    }
    syncStatus(ctx);
    if (!quiet) {
      ctx?.ui?.notify?.(`nekomaid: ${state.gear}${state.modules.length ? " " + state.modules.map((m) => `+${m}`).join("") : ""}`, "info");
    }
  }

  function handleCommand(args, ctx) {
    const parsed = parseCommand(args, state);

    if (parsed.type === "status") {
      ctx?.ui?.notify?.(`nekomaid \u2022 gear ${state.gear} \u2022 modules ${state.modules.join(", ") || "none"}`, "info");
      return;
    }
    if (parsed.type === "invalid") {
      ctx?.ui?.notify?.(`nekomaid: unknown "${parsed.token}". Gears ${GEARS.join("/")}, modules ${MODULES.join("/")}`, "warning");
      return;
    }
    if (parsed.type !== "set") {
      ctx?.ui?.notify?.("nekomaid: unhandled command", "warning");
      return;
    }
    apply(parsed.state, ctx);
  }

  pi.registerCommand("neko", {
    description: `nekomaid gear (${GEARS.join("|")}) and modules (${MODULES.join("|")}). Bare /neko resets to normal.`,
    handler: handleCommand,
  });

  // Same handler under the full name, since that is what the skill is called.
  pi.registerCommand("nekomaid", {
    description: "Alias of /neko",
    handler: handleCommand,
  });

  pi.on("input", async (event, ctx) => {
    if (event?.source === "extension") return;
    const text = String(event?.text ?? "").trim();
    if (!text) return;
    if (state.gear !== "off" && OFF_PHRASES.includes(text.toLowerCase())) {
      apply({ ...state, gear: "off" }, ctx, true);
      ctx?.ui?.notify?.("nekomaid off.", "info");
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    const entries = ctx?.sessionManager?.getBranch?.() || ctx?.sessionManager?.getEntries?.() || [];
    state = resolveSessionState(entries, state);
    syncStatus(ctx);
  });

  pi.on("session_tree", async (_event, ctx) => {
    const entries = ctx?.sessionManager?.getBranch?.() || ctx?.sessionManager?.getEntries?.() || [];
    state = resolveSessionState(entries, state);
    syncStatus(ctx);
  });

  pi.on("agent_start", async (_event, ctx) => {
    busy = true;
    syncStatus(ctx);
  });

  pi.on("agent_end", async (_event, ctx) => {
    busy = false;
    syncStatus(ctx);
  });

  pi.on("before_agent_start", async (event) => {
    const section = buildSection(state);
    const sections = event?.systemPromptOptions?.sections;
    if (sections && typeof sections === "object") {
      if (section) sections.nekomaid = section;
      else delete sections.nekomaid;
      return;
    }
    if (!section) return;
    return { systemPrompt: `${event?.systemPrompt ? event.systemPrompt + "\n\n" : ""}${section}` };
  });
}
