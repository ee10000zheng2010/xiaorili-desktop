# 华为版 App

## 当前产物
- 华为版 APK：`release/xiaorili-huawei.apk`
- 包名：`com.xiaorili.huawei`
- 应用名：小日历

## 适用设备
- 华为手机当前运行 HarmonyOS 4.x 及更早版本时，系统仍兼容 Android APK，可以直接安装本 APK。
- 如果手机已升级到 HarmonyOS NEXT（纯鸿蒙，不再兼容 Android 应用），APK 无法运行，需要另行开发 HAP 版本。

## 构建命令
- `npm run build:android` 会同时生成标准版和华为版：
  - 标准版：`android/app/build/outputs/apk/mobile/debug/app-mobile-debug.apk`
  - 华为版：`android/app/build/outputs/apk/huawei/debug/app-huawei-debug.apk`

## 上架华为应用市场
- 直接安装测试不需要账号。
- 如果要在华为应用市场正式发布，需要注册华为开发者账号、完成实名认证，并对 APK 做正式签名后上传审核。
