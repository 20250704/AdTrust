# AdTrust AI 消费者信任与广告转化优化官

AdTrust AI 是一个单体 Node/Express Web 服务：前端静态页面、后端 API、DeepSeek 调用、图片 OCR、案例库、法律规则库和平台规则库都由同一个服务提供。适合本地开发，也适合部署为公网 HTTPS 链接，供其他人直接通过浏览器使用。

## 本地运行

```bash
npm install
cp .env.example .env
npm start
```

本地地址：

```text
http://localhost:3000
```

如果暂时不配置 `DEEPSEEK_API_KEY`，系统会进入本地演示模式，仍可使用规则库、案例库和模板改写完成完整流程。

## 环境变量

`.env.example` 可以提交到仓库，真实 `.env` 不要提交。

```env
DEEPSEEK_API_KEY=请在部署平台后台填写
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_REASONING_MODEL=deepseek-v4-pro
MODEL_PROVIDER=deepseek
PORT=3000
NODE_ENV=production
ALLOWED_ORIGIN=
```

说明：

- `DEEPSEEK_API_KEY` 只能配置在本地 `.env` 或部署平台后台环境变量中。
- 前端不会读取 API Key。
- `/api/health` 只返回 `hasApiKey: true/false`，不会返回 Key 内容。
- 单体同域部署时可以不设置 `ALLOWED_ORIGIN`。
- 如果前后端分开部署，生产环境应设置 `ALLOWED_ORIGIN=https://你的前端域名`。

## Render 部署

推荐使用 Render Web Service 部署本项目。Render Web Service 支持配置 Build Command、Start Command，并要求公网服务绑定 `PORT` 环境变量；服务会获得公开的 `onrender.com` 访问地址。Render 也支持在 Dashboard 中配置环境变量，用于保存 API Key 等敏感配置。

步骤：

1. 将项目推送到 GitHub。
2. 在 Render 创建 Web Service。
3. 连接该 GitHub 仓库。
4. 配置：
   - Build Command：`npm install`
   - Start Command：`npm start`
5. 在 Environment Variables 中配置：
   - `DEEPSEEK_API_KEY`
   - `DEEPSEEK_BASE_URL`
   - `DEEPSEEK_MODEL`
   - `DEEPSEEK_REASONING_MODEL`
   - `MODEL_PROVIDER`
   - `NODE_ENV=production`
6. 部署完成后打开 Render 提供的 HTTPS 链接。

项目已包含 `render.yaml`，其中 `DEEPSEEK_API_KEY` 使用 `sync: false`，不会写入真实密钥。

参考：

- Render Web Services: https://render.com/docs/web-services/
- Render Environment Variables: https://render.com/docs/configure-environment-variables/

## Railway / Fly.io

也可以使用其他支持 Node.js Web Service 的平台。核心配置保持一致：

- Build：`npm install`
- Start：`npm start`
- Runtime：Node.js 18+
- 环境变量：按 `.env.example` 配置
- 对外端口：使用平台注入的 `PORT`

## Vercel 注意事项

当前项目优先推荐单体 Express 服务部署。如果使用 Vercel，需要二选一：

1. 将后端改造成 Vercel Functions。
2. Vercel 只部署前端，Express 后端部署到 Render/Railway 等独立服务。

原因是项目包含图片上传、OCR、AI 请求和较长的后端处理流程，Serverless Functions 需要额外关注超时、文件大小和临时文件处理限制。Vercel 支持在 Project Settings 中配置 Environment Variables，也支持用 Functions 运行服务端代码并连接外部 API。

参考：

- Vercel Environment Variables: https://vercel.com/docs/environment-variables
- Vercel Functions: https://vercel.com/docs/functions

## 生产安全限制

已内置基础公网保护：

- 文案最多 5000 字。
- 图片最多 5 张。
- 单张图片最多 5MB。
- 图片使用 `multer.memoryStorage()`，不永久保存用户上传图片。
- 后端日志只记录时间、路由、字数、模式和状态，不记录完整广告文案、图片 base64 或 API Key。
- `/api/audit` 每个 IP 每分钟最多 10 次。
- `/api/rewrite-chat` 每个 IP 每分钟最多 20 次。
- `/api/extract-image` 每个 IP 每分钟最多 20 次。
- API 错误统一返回 JSON：

```json
{
  "ok": false,
  "message": "错误说明",
  "fallbackAvailable": true
}
```

DeepSeek 未配置或调用失败时，系统会自动使用本地 fallback，不会让页面空白。

## 部署后检查清单

1. 打开公网 URL，首页正常显示。
2. `/api/health` 正常返回。
3. 首页显示运行模式和 AI 状态。
4. 输入文字可以生成营销诊断报告。
5. 上传图片可以预览，OCR 失败时可手动输入图片文字。
6. 诊断完成后自动进入报告页。
7. 报告页可以进入改写工作室。
8. 追问可以返回新文案。
9. 可以生成最终投放版。
10. 可以导出模拟演示报告。
11. 手机浏览器可以正常打开。
12. 复制公网链接给其他人，对方能打开使用。

## API 列表

- `GET /api/health`
- `POST /api/audit`
- `POST /api/rewrite-chat`
- `POST /api/extract-image`
- `GET /api/cases`
- `GET /api/legal-rules`
- `GET /api/platform-rules`

前端全部使用相对路径请求 API，部署到公网后不需要修改前端代码。
