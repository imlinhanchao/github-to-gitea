# github-to-gitea

基于 **Vue3 + UnoCSS + daisyUI**（前端）和 **NestJS + TypeORM**（后端）的 GitHub 到 Gitea 同步工具。

## 功能

1. 添加 GitHub 账号或单个仓库，调用 GitHub / Gitea API 同步仓库到 Gitea。
   - 账号模式：同步该账号下可访问的仓库（优先包含私有与公有）。
   - 仓库模式：同步指定 `owner/repo`。
2. 每天定时检查仓库是否有更新（`pushed_at`），有更新则自动触发同步。
3. 在 Gitea 自动创建与 GitHub 仓库 owner 同名账号，并创建同名仓库。
   - 每个仓库可配置多个同步分支，默认主分支（仓库默认分支）。
4. 项目启动时首次交互式采集配置（GitHub Token、Gitea Token、管理员账号密码、数据库路径），保存到 `config.json`。

## 目录结构

- `/backend` NestJS + TypeORM 服务，默认监听 `3001`
- `/frontend` Vue3 + UnoCSS UI，默认开发端口 `5173`

## 启动

### 1) 启动后端

```bash
cd backend
npm install
npm run start:dev
```

首次启动会提示输入配置并生成 `config.json`（在仓库根目录）。
`config.json` 包含敏感信息，请限制文件权限并避免泄露。

### 2) 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 `http://localhost:5173`。

## API 概览

- `POST /sync/account` 添加 GitHub 账号并同步其仓库
- `POST /sync/repository` 添加单仓库并同步
- `GET /sync/repositories` 查询已配置同步仓库
- `PATCH /sync/repositories/:id/branches` 更新仓库分支列表
- `POST /sync/repositories/:id/run` 立即同步单仓库

## 测试与构建

```bash
cd backend
npm run test
npm run build

cd ../frontend
npm run build
```
