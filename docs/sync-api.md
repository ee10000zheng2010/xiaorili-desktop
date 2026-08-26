# 小日历同步服务

桌面程序会自动启动本机同步服务，用户无需填写地址，默认使用 `http://localhost:8787`。服务端提供以下接口，桌面端和未来手机版共用：

- `GET /health`
- `POST /auth/register`，请求 `{ "email": "...", "password": "..." }`
- `POST /auth/login`，请求同上，返回 `{ "token": "..." }`
- `PUT /sync`，携带 `Authorization: Bearer <token>`，保存并返回待办、标签、主题、背景和桌面偏好
- `GET /sync`，携带 `Authorization: Bearer <token>`，读取当前账户的云端数据

本地测试：`npm run sync-server`，默认监听 `http://localhost:8787`。生产环境必须部署一份所有设备都能访问的 HTTPS 服务，并将桌面端和未来手机版构建到同一个 `VITE_SYNC_API` 地址；桌面端不显示服务地址输入框。服务端 `SYNC_DATA_FILE` 应指向持久化目录。当前服务使用 JSON 文件存储，适合原型和小规模个人使用；正式上线前应换成数据库、限流、邮箱验证和密码重置流程。

同一账户支持多设备同时登录：每次登录都会创建独立令牌，不会使其他设备退出；同步数据按账户保存。旧版只有 `token` 字段的数据会在下一次登录时自动迁移为令牌数组。
