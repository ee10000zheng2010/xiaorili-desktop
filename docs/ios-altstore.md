# 免费 Apple ID + AltStore 临时安装

## 云端产出 IPA
1. 将代码推送到 GitHub 仓库。
2. 打开仓库的 Actions，选择 `Build iOS AltStore IPA`。
3. 点击 `Run workflow`，等待 macOS 云端构建完成。
4. 下载 `xiaorili-ios-altstore` 构建产物，里面是 `xiaorili-altstore.ipa`。

这套流程不需要 Apple 开发者账号，也不需要配置任何证书。

## iPhone 安装
1. 在 Windows 安装 [AltServer](https://altstore.io)，手机与电脑连同一个 Wi-Fi，或用数据线连接。
2. 在电脑 AltServer 菜单选择 `Install AltStore`，输入你的 Apple ID。
3. 手机打开 AltStore，把 `xiaorili-altstore.ipa` 传进手机（如 AirDrop 或文件 App），在 AltStore 的 `My Apps` 中点 `+` 安装。
4. 首次安装后到 iPhone 的 `设置 > 通用 > VPN 与设备管理` 信任该 Apple ID 描述文件。

## 更新与续签
- 每次有新版本时，把新的 IPA 再次装进 AltStore 即可，仍使用同一个免费 Apple ID。
- 免费签名 7 天过期；AltStore 会在过期前自动续签，条件是电脑上的 AltServer 保持运行，并且手机与电脑在同一 Wi-Fi。
- 免费 Apple ID 最多同时安装 3 个第三方应用。
