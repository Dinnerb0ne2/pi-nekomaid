# 更新日志

## 0.1.0

- 第一个版本.
- `/neko` 命令, 挡位 `off` `minimal` `normal` `high` `max` `ultra`, 另外认 `病娇` 这个别名.
  空着敲 `/neko` 等于回到 `normal`.
- 六个模块: `shadow` `jealous` `gloomy` `sharp` `obsess` `night`, 用 `+名字` / `-名字` 开关,
  中文写法 (开影子 / 关影子) 一样认.
- 右下角状态栏显示当前挡位和已开的模块, 干活时带实心点.
- 状态跟着会话走, `/reload` 和切会话都不丢.
- 角色卡不塞进系统提示: 扩展只注入一小段, 说明当前挡位, 并把决定权交回技术层.
- `test/nekomaid.test.mjs` 里 39 项行为检查.
