# SoundCare Native APP (HRV付费功能)

## 技术栈

- **框架**：uniapp (Vue 3) - 同一套代码编译iOS/Android原生APP
- **原生插件**：Apple HealthKit (iOS) / Huawei Health Kit (Android)
- **跨平台**：通过uniapp的原生插件机制调用设备健康API

## 项目结构

```
soundcare-native/
├── app/                         # 跨平台APP
│   ├── src/                     # 源代码根目录
│   │   ├── pages/
│   │   │   ├── index/           # 首页 (共用)
│   │   │   ├── generate/        # 生成页 (共用)
│   │   │   ├── player/          # 播放页 (共用)
│   │   │   ├── profile/         # 个人页 (共用)
│   │   │   ├── hrv-monitor/     # HRV实时监测 (原生APP专有)
│   │   │   ├── device-pair/     # 设备配对 (原生APP专有)
│   │   │   └── healing-report/  # 疗愈报告 (原生APP专有)
│   │   ├── api/                 # API调用封装 (共用)
│   │   ├── static/              # 静态资源
│   │   ├── App.vue
│   │   ├── main.js
│   │   ├── manifest.json
│   │   ├── pages.json
│   │   └── vite.config.js
│   └── package.json
└── README.md
```

## 编译命令

```bash
cd soundcare-native/app

# 安装依赖（必须先安装）
npm install

# 微信小程序
npm run dev:mp-weixin     # 开发模式
npm run build:mp-weixin   # 构建小程序

# iOS原生APP
npm run dev:app-inside    # 开发模式
npm run build:app-inside  # 构建iOS APP

# Android原生APP
npm run dev:app-android   # 开发模式
npm run build:app-android # 构建Android APK
```

> 注意：npm install 必须在 soundcare-native/app 目录下执行，因为 package.json 在该目录

## 核心页面

| 页面 | 类型 | 功能 |
|------|------|------|
| 首页/生成/播放/个人 | 共用 | 基础疗愈音乐功能 |
| HRV监测 | 原生APP专有 | 实时显示心率/HRV数据，与音乐闭环 |
| 设备配对 | 原生APP专有 | 连接Apple Watch/华为手表 |
| 疗愈报告 | 原生APP专有 | 查看历史疗愈效果 |

## 与微信小程序的关系

**共用同一套uniapp框架和核心代码**：

| 模块 | 微信小程序 | 原生APP |
|------|-----------|---------|
| 框架 | uniapp (Vue 3) | uniapp (Vue 3) |
| 页面（基础） | index/generate/player/profile | index/generate/player/profile |
| 页面（HRV） | ❌ 无 | hrv-monitor/device-pair/healing-report |
| API client | `api/music.js` | `api/music.js` (共用) |
| Vite构建 | ✅ | ✅ |

## 原生插件集成

uniapp支持通过原生插件调用平台特定API：

- **iOS**：通过`uni.requireNativePlugin('healthkit')`调用HealthKit
- **Android**：通过`uni.requireNativePlugin('huawei-health')`调用华为Health Kit

## 与微信小程序的关系

原生APP与微信小程序**共用同一套uniapp代码**：

- 小程序版 (`soundcare-app/`) - 免费功能，无HRV
- 原生APP版 (`soundcare-native/`) - 付费功能，有HRV，需编译

代码结构完全一致，原生APP版额外包含HRV相关页面和插件配置。

## HRV数据获取

### Apple Watch (iOS)
```javascript
// 通过原生插件调用HealthKit
const healthkit = uni.requireNativePlugin('healthkit')
healthkit.startHeartRateQuery({
  success: (res) => {
    // res.heartRate - 心率 BPM
    // res.timestamp - 时间戳
  }
})
```

### 华为手表 (Android)
```javascript
// 通过原生插件调用华为Health Kit
const huaweiHealth = uni.requireNativePlugin('huawei-health')
huaweiHealth.startRRIReading({
  success: (res) => {
    // res.heartRate - 心率 BPM
    // res.rriList - RRI数组，用于精确HRV计算
  }
})
```

## 构建要求

- HBuilderX 3.95+
- iOS 17.0+ / Android 12.0+
- Apple Developer Account（HealthKit权限）
- 华为开发者联盟账号（Health Kit权限）

## 相关文档

- `docs/HRV原生插件架构.md` - iOS HRV 原生插件架构设计

## 仓库地址

https://github.com/lixu99999/soundcare-native.git