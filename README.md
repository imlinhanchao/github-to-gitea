<p align="center">
   <img src="./frontend/public/logo.svg" alt="github-to-gitea logo" width="88" />
</p>

<h1 align="center">github-to-gitea</h1>

<p align="center">一个用于将 GitHub 仓库同步到 Gitea 的可视化工具。</p>

<p align="center">
   中文 | <a href="./README.en.md">English</a>
</p>

基于 Vue 3 前端和 NestJS 后端构建，支持通过 Web 页面完成初始化配置、管理员登录、仓库导入、分支同步和 Webhook 回调处理。项目适合个人迁移、团队镜像、私有代码备份和自建 Gitea 场景。

## 简介

`github-to-gitea` 用于把 GitHub 上的仓库同步到 Gitea，并提供一个简单的管理界面来完成以下工作：

- 初始化系统配置
- 使用 Gitea 管理员账号登录访问系统
- 按 GitHub 账号批量导入仓库
- 按 `owner/repo` 单仓库同步
- 配置分支同步范围
- 为仓库自动创建或修复 GitHub Webhook
- 定时检查仓库更新并自动触发同步

后端默认监听 `3001`，页面静态资源由后端根路径直接提供，所有接口统一挂载在 `/api` 下。

## 快速开始

根据你的需求选择合适的部署方式：

| 部署方式 | 适用场景 | 难度 | 启动速度 |
|---------|--------|------|--------|
| [Docker Compose](#docker-compose-一键部署推荐) | 完全自动化，一条命令启动所有服务（Gitea、MySQL、应用） | ⭐ | 极速 |
| [Docker 单独部署](#docker-单独部署外部数据库) | 已有 Gitea 和 MySQL，仅部署应用 | ⭐⭐ | 快 |
| [统一打包部署](#统一打包部署) | 传统部署方式，自己管理依赖和启动 | ⭐⭐⭐ | 中等 |
| [前后端分开开发](#前后端分开开发运行) | 本地开发调试，前后端分离 | ⭐⭐ | 中等 |

**推荐方案：** 如果是第一次使用，建议选择 **Docker Compose**，一条命令即可启动所有必要服务。

```bash
# 1. 准备配置文件
cp .env.example .env
# 2. 编辑 .env 填写 Gitea 管理员密码和数据库配置
# 3. 启动
docker-compose up -d
# 4. 按引导在 Web 界面完成应用配置
```

详细说明请参见下面的部署方式部分。

## 功能要点

- 支持按 GitHub 账号批量同步仓库，也支持指定单个仓库同步
- 支持按用户名导入 GitHub Star 仓库并在 Gitea 中为同名用户自动加星
- 支持私有仓库与公开仓库，只要 Token 具备访问权限
- 在 Gitea 中自动创建与 GitHub 仓库 owner 同名的用户和仓库
- 支持为每个仓库配置多个同步分支，默认使用仓库默认分支
- 支持任务队列、失败重试、任务清理和手动立即同步
- 支持 GitHub `push` Webhook 触发增量同步
- 已配置后必须使用 Gitea 管理员账号登录，接口也会进行鉴权
- 前后端可分开开发，也可以统一打包到 `dist` 目录部署

## 环境准备

运行前建议准备以下环境：

- Node.js 20 或更高版本
- npm 10 或更高版本
- Git 命令行，可在服务端执行 `git`
- MySQL 8.x 或兼容版本
- 可正常访问的 Gitea 服务
- 可正常访问的 GitHub API

推荐提前确认以下事项：

- 已在 MySQL 中创建目标数据库，例如 `github_to_gitea`
- 已准备一个 Gitea 管理员账号
- 目标机器能访问 GitHub、Gitea 和 MySQL
- 如果需要公网 Webhook，已准备可被 GitHub 访问的服务地址

## Token 获取方式

### GitHub Token

建议使用 GitHub Personal Access Token。项目当前会调用仓库读取接口和仓库 Webhook 管理接口，因此至少要保证 Token 能：

- 读取目标仓库
- 读取私有仓库（如果需要同步私有仓库）
- 读取和创建仓库 Webhook

常见获取方式：

1. 登录 GitHub。
2. 打开 `Settings`。
3. 进入 `Developer settings`。
4. 进入 `Personal access tokens`。
5. 创建 Classic Token 或 Fine-grained Token。

权限建议：

- Classic Token：建议至少包含 `repo` 和 `admin:repo_hook`
- Fine-grained Token：至少授予目标仓库的 Contents 读取权限，以及 Webhooks 的读写权限

如果只同步公开仓库且不需要自动配置 Webhook，可以降低权限，但当前项目默认会尝试为仓库配置 Webhook，因此不建议省略 Webhook 相关权限。

### Gitea Token

请使用 Gitea 管理员账号创建 Access Token，因为项目会调用管理员接口创建用户和仓库。

常见获取方式：

1. 使用 Gitea 管理员账号登录。
2. 打开 `Settings`。
3. 进入 `Applications`。
4. 在 `Access Tokens` 中创建新 Token。

权限建议：

- 具备管理员级 API 访问能力
- 能创建用户
- 能创建仓库
- 能向目标仓库写入代码

如果你的 Gitea 版本支持细粒度权限，请至少确保 Token 拥有管理员仓库管理、管理员用户管理和仓库写入能力。

## 开发启动

### 启动后端

```bash
cd backend
npm install
npm run dev
```

后端默认监听：`http://localhost:3001`

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端开发地址默认是：`http://localhost:5174`

开发模式下，前端会把 `/api` 请求代理到 `http://localhost:3001`。

## 部署方式

### Docker Compose 一键部署（推荐）

使用 Docker Compose 可以一次性启动 Gitea、MySQL 和 github-to-gitea 应用：

#### 准备配置文件

1. 复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填写数据库配置项：

```env
# MySQL 数据库配置
DB_USER=gitea_user
DB_PASSWORD=gitea_password
DB_DATABASE=github_to_gitea
```

#### 启动服务

```bash
docker-compose up -d
```

#### 初始化 Gitea

首次启动时，访问 `http://localhost:3000` 进行 Gitea 初始化设置：

1. 数据库类型选择 **MySQL**
2. 数据库连接信息：
   - 主机：`mysql:3306`
   - 用户：`gitea_user`（或你在 `.env` 中设置的 `DB_USER`）
   - 密码：`.env` 中设置的 `DB_PASSWORD`
   - 数据库：`github_to_gitea`（或 `DB_DATABASE`）
3. 填写**管理员账号信息**（自行设置用户名和密码，稍后在 github-to-gitea 中会用到）
4. 完成初始化

#### 配置 github-to-gitea 应用

Gitea 初始化完成后，访问 `http://localhost:3001`：

1. 首次访问会进入**初始化配置页面**
2. 在页面上填写以下信息：
   - **GitHub Token** - GitHub Personal Access Token
   - **Gitea Token** - Gitea 管理员 API Token（需要先在 Gitea 中创建）
   - **Gitea 地址** - `http://gitea:3000`（Docker 内部网络）
   - **Gitea 管理员用户名** - 与 Gitea 初始化时的用户名一致
   - **Gitea 管理员密码** - 与 Gitea 初始化时的密码一致
   - **MySQL 连接信息** - 填写与 `.env` 一致的数据库配置
   - **GitHub Webhook 密钥** - 可选

3. 配置保存后，应用会在 `config.json` 中记录所有配置

#### 访问应用

- 前端页面：`http://localhost:3001`
- Gitea：`http://localhost:3000`
- MySQL：`localhost:3306`

#### 常用命令

```bash
# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f github-to-gitea

# 停止所有服务
docker-compose down

# 停止并删除所有数据（谨慎使用）
docker-compose down -v
```

### Docker 单独部署（外部数据库）

如果你已经有独立的 Gitea 和 MySQL 服务，可以仅使用 Docker 运行 github-to-gitea 应用。

#### 运行容器

根据你的数据库配置，使用环境变量启动容器：

```bash
docker run -d \
  --restart unless-stopped \
  --name github-to-gitea \
  -p 3001:3001 \
  -e DB_HOST=your-mysql-host \
  -e DB_PORT=3306 \
  -e DB_USER=your_db_user \
  -e DB_PASSWORD=your_db_password \
  -e DB_DATABASE=github_to_gitea \
  -e NODE_ENV=production \
  ghcr.io/imlinhanchao/github-to-gitea:latest
```

**参数说明：**

- `DB_HOST` - MySQL 服务器地址
- `DB_PORT` - MySQL 端口（默认 3306）
- `DB_USER` - MySQL 用户名
- `DB_PASSWORD` - MySQL 密码
- `DB_DATABASE` - 数据库名称

#### 初始化应用配置

1. 等待容器启动完成，访问 `http://localhost:3001`
2. 首次访问会进入**初始化配置页面**
3. 在页面上填写以下信息：
   - **GitHub Token** - GitHub Personal Access Token
   - **Gitea Token** - Gitea 管理员 API Token
   - **Gitea 地址** - 你的 Gitea 访问地址
   - **Gitea 管理员用户名和密码**
   - **GitHub Webhook 密钥** - 可选

4. 配置保存后，应用会在 `config.json` 中记录所有配置

#### 其他常用命令

```bash
# 查看日志
docker logs -f github-to-gitea

# 停止容器
docker stop github-to-gitea

# 启动已停止的容器
docker start github-to-gitea

# 删除容器
docker rm github-to-gitea
```

**注意：** 如需持久化配置，建议挂载配置目录：

```bash
docker run -d \
  --restart unless-stopped \
  --name github-to-gitea \
  -p 3001:3001 \
  -v $(pwd)/config:/app/config \
  -e DB_HOST=your-mysql-host \
  -e DB_USER=your_db_user \
  -e DB_PASSWORD=your_db_password \
  -e DB_DATABASE=github_to_gitea \
  ghcr.io/imlinhanchao/github-to-gitea:latest
```

### 统一打包部署

项目已经把前后端产物统一输出到根目录 `dist`：

- 后端编译输出到 `dist`
- 前端构建输出到 `dist/public`

构建命令：

```bash
npm run build
```

构建完成后，目录结构大致如下：

```text
dist/
   main.js
   app.module.js
   modules/
   public/
   package.json
   package-lock.json
```

生产运行方式：

```bash
cd dist
npm install --omit=dev
node main.js
```

部署说明：

- 运行目录是 `dist`，因此配置文件会生成或读取自 `dist/config.json`
- 页面访问路径是根路径 `/`
- 后端接口路径是 `/api/*`
- 如果使用反向代理，请确保 `/api` 和静态资源都转发到同一个 Node 服务

### 前后端分开开发运行

适合本地联调：

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

访问前端开发地址：`http://localhost:5174`

## 使用说明

### 1. 首次访问

首次启动后，如果系统还没有配置文件，会自动进入初始化配置页面。你需要填写：

- GitHub Token
- Gitea Token
- Gitea 地址
- Gitea 管理员用户名
- Gitea 管理员密码
- MySQL 连接信息
- 可选的 GitHub Webhook 密钥

配置保存后，后端会将数据写入 `config.json`。

说明：

- 开发模式下，配置文件位于 `backend/config.json`
- 统一打包部署后，配置文件位于 `dist/config.json`
- 修改 MySQL 连接信息后，需要重启后端服务才能生效
- 如果系统尚未配置，后端会临时使用内存 SQLite 启动，保证初始化页面可访问

### 2. 登录系统

配置完成后，系统会启用管理员登录保护。

- 页面访问需要登录
- `/api/*` 接口也需要鉴权
- 登录账号和密码使用配置中的 `giteaAdminUsername` 与 `giteaAdminPassword`

当前公开接口主要用于初始化和 Webhook：

- `GET /api/auth/status`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/config/status`
- `POST /api/sync/webhook/github`

### 3. 添加同步源

登录后可以选择两种方式导入仓库：

- 输入 GitHub 用户名，批量导入该账号下可访问的仓库
- 输入 GitHub 用户名，导入该用户的 Star 仓库并同步到 Gitea
- 输入 `owner/repo`，只同步单个仓库

### 4. 管理同步仓库

仓库导入后，可以继续执行：

- 修改分支列表
- 启用或停用某个仓库同步
- 手动立即同步
- 配置或修复 GitHub Webhook

### 5. 查看任务队列

系统提供任务页用于查看：

- 当前排队任务
- 正在执行的任务
- 同步失败任务
- 重试失败任务
- 清理历史任务

## 配置项说明

当前配置文件包含以下字段：

```json
{
   "githubToken": "",
   "giteaToken": "",
   "giteaBaseUrl": "http://localhost:3000",
   "giteaAdminUsername": "gitea_admin",
   "giteaAdminPassword": "",
   "dbHost": "localhost",
   "dbPort": 3306,
   "dbUser": "root",
   "dbPassword": "",
   "dbDatabase": "github_to_gitea",
   "webhookSecret": ""
}
```

说明：

- `giteaBaseUrl` 填写 Gitea 站点根地址，不需要手动拼接 `/api/v1`
- `webhookSecret` 可选，留空则不校验 GitHub Webhook 签名
- `config.json` 包含敏感信息，请妥善保管并限制文件权限

## 常用命令

### 开发编译

```bash
# 根目录统一构建
npm run build

# 后端开发
cd backend
npm run dev
npm run test
npm run build

# 前端开发
cd frontend
npm run dev
npm run build
```

### Docker 相关

```bash
# ===== Docker Compose 一体部署 =====

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f github-to-gitea

# 重启应用
docker-compose restart github-to-gitea

# 停止所有服务
docker-compose down

# 停止并删除所有数据（谨慎使用）
docker-compose down -v

# ===== Docker 单独部署 =====

# 运行应用容器
docker run -d \
  --restart unless-stopped \
  --name github-to-gitea \
  -p 3001:3001 \
  -v $(pwd)/config.json:/app/config.json \
  ghcr.io/imlinhanchao/github-to-gitea:latest

# 查看运行日志
docker logs -f github-to-gitea

# 停止容器
docker stop github-to-gitea

# 启动已停止的容器
docker start github-to-gitea

# 删除容器
docker rm github-to-gitea

# 删除镜像
docker rmi ghcr.io/imlinhanchao/github-to-gitea:latest

# ===== 镜像相关 =====

# 拉取最新镜像
docker pull ghcr.io/imlinhanchao/github-to-gitea:latest

# 查看本地镜像
docker images | grep github-to-gitea
```
