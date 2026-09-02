# 小日历同步服务

桌面程序会自动启动本机同步服务，用户无需填写地址，默认使用 `http://localhost:8787`。服务端提供以下接口，桌面端和手机版共用：

- `GET /health`
- `POST /auth/register`，请求 `{ "email": "...", "password": "..." }`
- `POST /auth/login`，请求同上，返回 `{ "token": "..." }`
- `PUT /sync`，携带 `Authorization: Bearer <token>`，保存并返回待办、标签、主题、背景和桌面偏好
- `GET /sync`，携带 `Authorization: Bearer <token>`，读取当前账户的云端数据

本地测试：`npm run sync-server`，默认监听 `http://localhost:8787`。多设备长期使用需要部署一份所有设备都能访问的 HTTPS 服务；部署前可使用下面的临时公网隧道。服务端 `SYNC_DATA_FILE` 应指向持久化目录。当前服务使用 JSON 文件存储，适合原型和小规模个人使用；正式上线前应换成数据库、限流、邮箱验证和密码重置流程。

同一账户支持多设备同时登录：每次登录都会创建独立令牌，不会使其他设备退出；同步数据按账户保存。旧版只有 `token` 字段的数据会在下一次登录时自动迁移为令牌数组。

## 验证码登录与手机号账户

- `POST /auth/sms/send`，请求 `{ "phone": "13800138000", "mode": "login" | "register" }`；默认开发模式返回 `{ "message": "...", "devCode": "123456", "expiresInSeconds": 300 }`。
- `POST /auth/sms/verify`，请求 `{ "phone": "...", "code": "...", "mode": "login" | "register" }`，成功返回 `{ "token": "..." }`。
- 手机号账户使用 `sms:<phone>` 作为账号键，与邮箱账户互相隔离；验证码 5 分钟有效、最多 5 次尝试、同号 60 秒限频。
- 生产环境接入真实短信：设置 `SMS_DEV_MODE=false`、`SMS_PROVIDER=aliyun`，并配置 `ALIYUN_SMS_ACCESS_KEY_ID`、`ALIYUN_SMS_ACCESS_KEY_SECRET`、`ALIYUN_SMS_SIGN_NAME`、`ALIYUN_SMS_TEMPLATE_CODE`（模板变量固定为 `code`），前端无需改动。

## 桌面端跨设备配置

桌面端在“偏好设置 > 账户与同步 > 同步服务器”填写共享服务地址并保存（保存在 `workday-sync-server`）；手机端在“设置 > 同步服务器”填写同一地址。未填写地址时桌面端回退到本机 `http://localhost:8787`，手机端回退到 `VITE_SYNC_API` 或本机地址。

## 临时公网隧道（没有云服务器时）

1. 保持桌面程序运行，本机 `8787` 同步服务会自动启动。
2. 运行 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-public-tunnel.ps1`。
3. 从输出中复制 `https://xxxx.lhr.life`，在各端“同步服务器”填写并保存。

注意：该地址只在电脑开机且隧道进程运行时有效；重启电脑或隧道后重新运行脚本，并将输出中的新地址更新到各端。

## 云服务器部署

Ubuntu/Debian 一键部署：`sudo DOMAIN=sync.example.com ./scripts/deploy-sync-server.sh`。脚本会安装 Node.js 20、创建 `xiaorili-sync` systemd 服务、数据目录 `/var/lib/xiaorili`，并可用 Caddy 自动配置 HTTPS。本地测试：`npm run sync-server`。
