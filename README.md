# SoundCare Native APP (HRV付费功能)

## 技术栈

- **框架**：uniapp (Vue 3) - 同一套代码编译iOS/Android原生APP
- **原生插件**：Apple HealthKit (iOS) / Huawei Health Kit (Android)
- **跨平台**：通过uniapp的原生插件机制调用设备健康API

## 项目结构

```
soundcare-native/
├── app/                                # 跨平台APP
│   ├── src/                            # 源代码根目录
│   │   ├── pages/
│   │   │   ├── index/                  # 首页 (共用)
│   │   │   ├── generate/               # 生成页 (共用)
│   │   │   ├── player/                 # 播放页 (共用)
│   │   │   ├── profile/                # 个人页 (共用)
│   │   │   ├── hrv-monitor/            # HRV实时监测 (原生APP专有)
│   │   │   ├── device-pair/            # 设备配对 (原生APP专有)
│   │   │   └── healing-report/         # 疗愈报告 (原生APP专有)
│   │   ├── api/
│   │   │   ├── music.js                # 音乐 + 后端 API (共用)
│   │   │   └── hrv-plugin.js           # HRV 原生插件 JS 封装 (仅原生)
│   │   ├── static/                     # 静态资源
│   │   ├── App.vue
│   │   ├── main.js
│   │   ├── manifest.json               # 声明 nativePlugins
│   │   ├── pages.json
│   │   └── vite.config.js
│   ├── nativeplugins/
│   │   └── SoundCareHRV/               # iOS HRV 原生插件
│   │       ├── package.json
│   │       ├── ios/
│   │       │   ├── HealthKitService.swift
│   │       │   ├── SoundCareHRVModule.swift
│   │       │   ├── SoundCareHRVModule.m
│   │       │   └── Info.plist
│   │       └── android/                # v2 计划
│   └── package.json
├── docs/
│   ├── HRV原生插件架构.md              # iOS 插件架构设计
│   └── Mac集成指南.md                  # Mac 端集成步骤
├── CLAUDE.md                           # Claude Code 上下文
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

v1 已实现 **iOS Apple Watch HealthKit 实时 HRV 监测**，封装在自研插件 `SoundCareHRV` 中：

| 平台 | 插件名 | 状态 | 健康 API |
|------|--------|------|----------|
| iOS | `SoundCareHRV` | ✅ v1 已完成 | HealthKit（心率 + HRV/SDNN） |
| Android | - | ⏸ v2 计划 | 华为 Health Kit / 小米 |

- iOS JS 入口：`uni.requireNativePlugin('SoundCareHRV')`
- JS 封装层：`app/src/api/hrv-plugin.js`
- Swift 源码：`app/nativeplugins/SoundCareHRV/ios/`
- 架构设计：`docs/HRV原生插件架构.md`

## 与微信小程序的关系

原生APP与微信小程序**共用同一套uniapp代码**：

- 小程序版 (`soundcare-app/`) - 免费功能，无HRV
- 原生APP版 (`soundcare-native/`) - 付费功能，有HRV，需编译

代码结构完全一致，原生APP版额外包含HRV相关页面和插件配置。

## HRV 数据获取（v1：iOS Apple Watch）

通过自研原生插件 `SoundCareHRV` 调用 HealthKit。完整 JS 封装见 `app/src/api/hrv-plugin.js`。

### 一次性：检查设备

```javascript
import hrv from '@/api/hrv-plugin.js'

const { available } = await hrv.isAvailable()
// iPad / 模拟器 / 小程序端 → { available: false }
```

### 一次性：请求授权

```javascript
const auth = await hrv.requestAuthorization(['hrv', 'heartRate'])
// 成功：{ success: true, grantedTypes: [...] }
// 失败：{ success: false, errorCode: 'NOT_AUTHORIZED' | ... }
```

### 事件流：实时监测

```javascript
// 订阅事件
const unsubscribe = hrv.onUpdate((event) => {
  if (event.type === 'hrv') {
    // event.value - HRV (ms)，event.timestamp - ms 时间戳，event.source - 'Apple Watch'
  }
  if (event.type === 'heartRate') {
    // event.value - 心率 (BPM)
  }
})

// 启动监测
hrv.startMonitoring({ types: ['hrv', 'heartRate'], mockMode: false })
// mockMode: true 强制使用模拟数据（开发用）

// 5 秒后清理
setTimeout(() => {
  unsubscribe()
  hrv.stopMonitoring()
}, 5000)
```

### 高层封装：自动上报后端

```javascript
// music.js 提供的 startHRVSession：自动调用 updateHRVFromAppleWatch 上报后端
import { startHRVSession, stopHRVSession } from '@/api/music.js'

const { stop, success } = await startHRVSession(sessionId, {
  onMetrics: ({ hrv, heartRate, response }) => {
    // response 包含后端返回的 BPM 调整建议
  }
})

onUnmounted(() => stop())
```

> Android 端（华为手表 / 小米手环）将在 v2 实现，参考 `docs/HRV原生插件架构.md` 的扩展性设计。

## 构建要求

- HBuilderX 3.95+（alpha 版，支持自定义调试基座）
- iOS 17.0+ / Android 12.0+
- Apple Developer Account（**$99/年**，需在 App ID 勾选 HealthKit 能力）
- Xcode 15+（Mac 端，编译自定义基座必需）
- 华为开发者联盟账号（v2 Android 端，Health Kit 权限）

> **iOS 关键步骤**：HBuilderX 制作自定义调试基座时**必须勾选 HealthKit**。详见 [`docs/Mac集成指南.md`](docs/Mac集成指南.md)。

## 相关文档

| 文档 | 内容 |
|------|------|
| `docs/HRV原生插件架构.md` | iOS HRV 原生插件架构设计（6 决策 + 通信协议 + 错误码） |
| `docs/Mac集成指南.md` | Mac 端完整集成步骤（自定义基座 + 真机调试 + 10 项 checklist） |

## 仓库地址

https://github.com/lixu99999/soundcare-native.git