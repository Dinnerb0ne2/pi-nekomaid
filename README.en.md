# pi-nekomaid (English)

A catgirl gear system for [Pi](https://pi.dev), packaged as one installable unit. The primary
documentation is in Chinese in [README.md](README.md); this is the short English mirror.

## What is in the package

| Piece | Job |
| --- | --- |
| `extensions/nekomaid/index.js` | The `/neko` command, the footer status, session state, and a small system-prompt section |
| `skills/nekomaid/SKILL.md` | The character card, read on demand and never injected wholesale |
| `test/nekomaid.test.mjs` | 39 behavioural checks driven by a fake `pi`; no network, no terminal |

## Install

```bash
pi install npm:pi-nekomaid
pi install git:github.com/Dinnerb0ne2/pi-nekomaid@v0.1.0
pi -e ./pi-nekomaid     # try it for one run, without touching settings
```

## Use

```bash
/neko                 # reset the gear to normal
/neko ultra           # switch gear
/neko ultra +sharp    # gear and module in one line
/neko -sharp          # drop one module
/neko all / none      # every module on / off
/neko status          # report the current state
```

Gears: `off`, `minimal`, `normal`, `high`, `max`, `ultra`. Modules: `shadow`, `jealous`, `gloomy`,
`sharp`, `obsess`, `night`. The footer always shows the live state, for example
`● neko: ultra +sharp`.

## Design rules

**The persona is a voice layer, never a capability layer.** The injected system-prompt section names
the active gear and then defers: the technical skills win, and code, commands, paths and verbatim
tool output stay byte-exact and unaccented.

**Improvised, never looked up.** The card deliberately ships no example dialogue. A phrasebook turns
a character into a lookup table, and a lookup table is what makes a persona read as fake.

Nothing in the card relaxes a limit or tells the agent to drop its own judgement.

## License

MIT
