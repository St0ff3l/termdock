# TermDock

TermDock 是一个面向开发者与运维场景的现代化跨平台远程工作台。

产品方向参考 FinalShell 的高效率布局体验，协议能力借鉴 electerm 的成熟经验，但整体以全 TypeScript 技术栈重新设计，优先服务 macOS 和 Windows 桌面端，Linux 桌面同步兼容，移动端先保留在规划中。

## 愿景

把常见远程操作收敛到一个统一工作区中：

- SSH 远程终端
- SFTP 文件管理
- FTP 文件管理
- 多标签并行工作
- 文件上传下载
- 连接配置保存

第一版目标不是“支持所有协议”，而是先把最常用、最顺手、最像真正工作台的核心链路打磨出来。

## 产品边界

### 第一版支持

- SSH
- SFTP
- FTP
- 标签页
- 上传下载
- 连接配置保存
- 基础文件操作
- 基础终端操作

### 第一版暂不支持

- Telnet
- Serial
- RDP
- VNC
- 脚本自动化
- 云同步
- AI
- 手机端正式适配

## 关键架构判断

虽然 SFTP 和 FTP 都涉及文件传输，但两者不能在架构上混成同一种会话：

- SFTP 依附 SSH，属于 SSH 工作流的一部分
- FTP 是独立协议，不具备 SSH 终端联动关系

因此 TermDock 从第一天开始就分成两种会话模型：

- `SshSession`
  - `shell`
  - `sftp`
- `FtpSession`
  - `ftpClient`

对应的 UI 也分为两类：

- `SSH/SFTP` 会话：默认打开终端 + 远程文件面板
- `FTP` 会话：仅打开文件管理，不显示终端

这能避免未来在状态管理、布局切换和功能扩展上出现大量扭曲分支。

## 设计原则

- 以桌面工作流为核心，而不是网页管理后台思路
- 保留 FinalShell 的高效率布局，不继承其年代感
- 借鉴 electerm 的协议覆盖经验，但不沿用其历史结构包袱
- 所有新代码使用 TypeScript
- 协议层、状态层、UI 层明确解耦
- 先把常用路径做顺，再扩协议和高级能力

## 平台策略

- `P0`：macOS、Windows
- `P1`：Linux 桌面
- `P2`：移动端 companion / 简化客户端

## 技术方向

- Electron
- React
- TypeScript
- Vite
- xterm.js
- ssh2
- basic-ftp
- SQLite

详细架构见：

- [架构文档](./docs/architecture.md)
- [路线图](./docs/roadmap.md)

## 当前状态

当前仓库已经进入第一轮脚手架阶段，仓库内已放入：

- 根级 workspace 结构
- `apps/desktop` Electron + React + Vite + TypeScript 骨架
- `packages/core`、`packages/shared`、`packages/storage` 占位包
- 初版桌面工作台布局页面

接下来将继续进入：

1. 连接管理与标签状态落地
2. SSH/SFTP 会话抽象实现
3. FTP 独立会话实现
4. 传输任务中心接入
