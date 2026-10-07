# 发布指南

这份包走 git 路线发布, 不占 npm 名字喵~ 下面每一步都是实测过的命令喵~

## 前置: 这里是已知状态

| 项 | 值 |
| --- | --- |
| 包目录 | `D:\MTY\Code\pi-nekomaid` |
| 本地仓库 | 已 init, 已有提交, 分支 `main` |
| git 身份 | `Dinnerb0ne2` / `tomma_2022@outlook.com` (全局配置里已有) |
| 远端 | **还没设** |
| 凭证 | 本机没有 `gh` 命令, 也没发现 `~/.ssh` 密钥, 所以推送方式要先选一个 |

## 第一步: 在 GitHub 上建空仓库

浏览器打开 https://github.com/new

- Repository name 填 `pi-nekomaid`
- **不要**勾 Add a README / .gitignore / license, 本地已经有了, 勾了会冲突
- 建完把地址记下来, 形如 `github.com/Dinnerb0ne2/pi-nekomaid`

## 第二步: 选一种推送认证方式

### 方式一, SSH 密钥 (推得最省事)

```powershell
ssh-keygen -t ed25519 -C "tomma_2022@outlook.com"
# 一路回车, 密码可留空
type $env:USERPROFILE\.ssh\id_ed25519.pub
```

把打印出来的那串公钥贴进 https://github.com/settings/keys (New SSH key) 喵~

验证:

```powershell
ssh -T git@github.com
```

看到 `Hi Dinnerb0ne2!` 就通了喵~

### 方式二, HTTPS + 个人访问令牌

到 https://github.com/settings/tokens 建一个 classic token, 勾 `repo` 权限, 复制出来喵~

第一次推送时会要密码, 把 token 当密码贴进去, Windows 凭证管理器会记住喵~

## 第三步: 推送

```powershell
cd D:\MTY\Code\pi-nekomaid

# 方式一 (SSH)
git remote add origin git@github.com:Dinnerb0ne2/pi-nekomaid.git

# 方式二 (HTTPS)
# git remote add origin https://github.com/Dinnerb0ne2/pi-nekomaid.git

git push -u origin main
git tag v0.1.0
git push origin v0.1.0
```

推送之后这一步才是真正的"删了也还在"喵~ 本地目录整个删掉, 也能一条命令装回来喵~

## 第四步: 让本机改成从远端装

现在本机有两份散装副本和这个包目录, 不清掉的话 `/neko` 会被注册两次喵~

```powershell
cd D:\MTY\Code
pi install git:github.com:Dinnerb0ne2/pi-nekomaid@v0.1.0

Remove-Item -Recurse -Force .pi\agent\extensions\nekomaid
Remove-Item -Recurse -Force .pi\agent\skills\nekomaid
```

然后在 pi 里 `/reload`, 右下角还应该能看到 `🐱 neko: ...` 喵~

包目录 `D:\MTY\Code\pi-nekomaid` 可以留着当开发源, 改完 commit + tag 再 `git push` 就行喵~

## 以后发新版本

```powershell
cd D:\MTY\Code\pi-nekomaid
# 改代码, 更新 CHANGELOG.md 和 package.json 里的 version
git add -A
git commit -m "pi-nekomaid 0.2.0"
git push
git tag v0.2.0
git push origin v0.2.0
```

别人装指定版本用 `@v0.2.0`, 不写就是默认分支喵~

## 备选: 也想上 npm

```powershell
npm adduser                   # 一次
npm publish --access public   # pi-nekomaid 目前没人占
```

npm 和 git 两条路可以同时存在, 不冲突喵~ 带上 `pi-package` 关键字之后, npm 那个包还能进 Pi 的软件包画廊喵~

## 发布前自查

```powershell
cd D:\MTY\Code\pi-nekomaid
npm test        # 39 项行为检查, 必须全过
npm pack        # 看一眼 tarball 里装了什么
git status      # 工作区应该干净
```
