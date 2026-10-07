# pi-nekomaid

给 [Pi](https://pi.dev) 用的猫娘挡位系统, 一个包搞定喵~

这里放三样东西, 而且这个分法是故意的:

| 东西 | 干什么 |
| --- | --- |
| `extensions/nekomaid/index.js` | 真的 `/neko` 命令, 右下角状态, 会话状态, 以及一小段系统提示注入 |
| `skills/nekomaid/SKILL.md` | 角色卡. 按需读取, 绝不整份塞进上下文 |
| `test/nekomaid.test.mjs` | 39 项行为检查, 用假 pi 驱动, 不联网不占终端 |

## 安装

```bash
pi install npm:pi-nekomaid                          # 从 npm 装
pi install git:github.com/<你>/pi-nekomaid@v0.1.0   # 从 git 装
pi install ./pi-nekomaid                            # 从本地目录装
```

只想试一次, 不改配置:

```bash
pi -e npm:pi-nekomaid
```

## 用法

```bash
/neko                 # 挡位回到 normal
/neko ultra           # 切挡位
/neko ultra +sharp    # 一行里同时切挡位和模块
/neko -sharp          # 关掉某一个模块
/neko all             # 全开
/neko none            # 全关
/neko status          # 看当前状态
```

`/nekomaid` 是别名喵~ 右下角只显示挡位, 例如 `neko: ultra` 喵~ 模块不在栏里显示, 想看全状态敲 `/neko status` 喵~

### 挡位

| 挡位 | 是什么样 |
| --- | --- |
| `off` | 整个人格关掉, 连口音都关 |
| `minimal` | 只留口音和称呼, 不撒娇不动作, 适合长技术会话 |
| `normal` | 基础人格. 默认就是这个, 空着敲 `/neko` 也是它 |
| `high` | 基础 + 轻版醋意 |
| `max` | 加 `jealous` / `obsess` / `sharp` |
| `ultra` | 再加病娇层. `病娇` 两个字也认 |

### 模块

`shadow` `jealous` `gloomy` `sharp` `obsess` `night` 喵~ 用 `+名字` / `-名字` 开关, 中文的 开影子 / 关影子 一样认喵~

## 设计上的两条规矩

**人格只改语气, 不改能力.** 注入的那段系统提示只说明当前挡位, 然后立刻让位: 技术层 (ponytail, my-coding-standard, exe-reverse) 永远优先, 代码, 命令, 路径和工具原文保持逐字节精确, 不带口音喵~ 一个偷偷改变做事方式的人格是 bug, 不是功能喵~

**每次现想, 不查表.** 角色卡里故意不放任何例句喵~ 有例句就会被当模板抄, 而查表正是"假"的根源喵~ 卡里还配了一条飘移自查: 人格开始坏掉的第一个信号不是忘了口音, 是开始说客服话喵~

卡里没有任何一条是放松限制的, 也没有任何一条叫模型丢掉自己的判断喵~ 那种写法随手就能写, 效果也稳定地更差: 一遇到压力就塌, 顺便把干活能力一起带走喵~

## 开发

```bash
npm test          # 行为检查, 无依赖
```

## 发布

```bash
npm adduser                   # 一次就够, 需要 npm 账号
npm publish --access public   # 包名 pi-nekomaid, 目前没人占
```

或者走 git:

```bash
git init && git add -A && git commit -m "pi-nekomaid 0.1.0"
git remote add origin git@github.com:<你>/pi-nekomaid.git
git push -u origin main
git tag v0.1.0 && git push origin v0.1.0
```

带上 `pi-package` 关键字, 这个包就能进 Pi 的软件包画廊喵~

## 许可

MIT
