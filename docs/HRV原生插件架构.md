# SoundCare iOS HRV 原生插件架构设计

## 目录

1. [目标与边界](#1-目标与边界)
2. [文件结构](#2-文件结构)
3. [JS API 表面](#3-js-api-表面)
4. [Swift 模块设计](#4-swift-模块设计)
5. [通信协议](#5-通信协议)
6. [数据流图](#6-数据流图)
7. [错误处理](#7-错误处理)
8. [Mock 模式](#8-mock-模式)
9. [线程模型](#9-线程模型)
10. [测试策略](#10-测试策略)
11. [实施步骤](#11-实施步骤)
12. [待确认问题](#12-待确认问题)

---

## 1. 目标与边界

### 1.1 目标

为 soundcare-native 创建一个 **uniapp 原生插件**，封装 iOS HealthKit，实现：

- Apple Watch 实时心率（HR）+ HRV（RMSSD）采集
- 实时事件流从 Swift 推送到 JS
- 设备配对 UI 触发授权
- 兼容无 Apple Watch 场景（Mock 模式）

### 1.2 范围

| 范围 | 在 v1 | 在 v2 |
|------|------|------|
| Apple Watch HRV 实时流 | ✅ | |
| Apple Watch HR 实时流 | ✅ | |
| 华为手表（华为 Health Kit） | | ✅ |
| Polar H10（蓝牙 RRI 原始数据） | | ✅ |
| 后台持续监测（熄屏/锁屏） | | ✅ |
| 历史 HRV 数据查询 | | ✅ |

**v1 范围**：仅 iOS + Apple Watch + 前台监测。

### 1.3 设计原则

1. **JS↔Swift 接口稳定**：内部实现可改，公开方法签名不变
2. **事件驱动**：HRV 数据流用 callback 推送，不用轮询
3. **失败可降级**：无 Apple Watch 时切 Mock，不阻塞主流程
4. **线程安全**：所有 UIKit 操作必须在 main thread

---

## 2. 文件结构

```
soundcare-native/app/
├── nativeplugins/
│   └── SoundCareHRV/                      # 新建：原生插件
│       ├── package.json                   # 插件元信息（uniapp 标准）
│       ├── ios/                           # iOS 实现
│       │   ├── SoundCareHRVModule.swift   # DCUniPlugin 入口
│       │   ├── SoundCareHRVModule.m       # ObjC 桥接（必须）
│       │   ├── HealthKitService.swift     # HealthKit 业务逻辑
│       │   └── Info.plist                 # HealthKit 权限描述
│       └── android/                       # 留空，后续开发
├── src/
│   ├── api/
│   │   ├── hrv-plugin.js                  # 新增：原生插件 JS 封装层
│   │   └── music.js                       # 修改：调用 hrv-plugin
│   ├── pages/
│   │   └── device-pair/
│   │       └── index.vue                  # 修改：调用 hrv-plugin.requestAuthorization
│   └── manifest.json                      # 修改：声明 nativePlugins
```

**关键文件说明**：

| 文件 | 作用 | 备注 |
|------|------|------|
| `SoundCareHRVModule.m` | ObjC → Swift 桥接 | uniapp 官方机制，必须有 |
| `HealthKitService.swift` | 业务逻辑 | 可独立单元测试 |
| `package.json` | uniapp 加载插件的入口 | 格式固定 |

---

## 3. JS API 表面

```javascript
// src/api/hrv-plugin.js

const hrv = uni.requireNativePlugin('SoundCareHRV')

// 1. 检查设备是否支持 HealthKit
hrv.isAvailable({}, (res) => {
  // res = { available: true, errorCode?: string }
})

// 2. 请求 HealthKit 授权
hrv.requestAuthorization({
  readTypes: ['hrv', 'heartRate']        // 要读取的指标
}, (res) => {
  // res = { success: true, grantedTypes: ['hrv', 'heartRate'] }
  // 或  = { success: false, errorCode: 'NOT_AUTHORIZED' }
})

// 3. 启动实时监测（事件驱动）
hrv.startMonitoring({
  types: ['hrv', 'heartRate'],
  intervalSeconds: 5,                    // 推送间隔（实际由 HealthKit 决定）
  mockMode: false                        // 是否使用模拟数据
}, (event) => {
  // event 可能是：
  //   { type: 'hrv', value: 52.3, timestamp: 1700000000000, source: 'Apple Watch' }
  //   { type: 'heartRate', value: 68, timestamp: ..., source: 'Apple Watch' }
  //   { type: 'mock', value: ..., timestamp: ... }   // mock 模式
  //   { type: 'error', errorCode: 'QUERY_FAILED' }
})

// 4. 拉取最近一次数据（一次性）
hrv.getLatest({ type: 'hrv' }, (res) => {
  // res = { success: true, value: 52.3, timestamp: ... }
})

// 5. 停止监测
hrv.stopMonitoring({}, (res) => {
  // res = { success: true }
})

// 6. 设置 Mock 模式（开发用）
hrv.setMockMode({ enabled: true }, (res) => {
  // res = { success: true }
})
```

**与 music.js 的衔接**：

```javascript
// src/api/hrv-plugin.js

import { updateHRVFromAppleWatch } from './music.js'

let sessionId = null
let startTime = null
let heartRateCache = 0

hrv.startMonitoring({ types: ['hrv', 'heartRate'] }, (event) => {
  if (event.type === 'heartRate') {
    heartRateCache = event.value
  }
  if (event.type === 'hrv' && sessionId) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    updateHRVFromAppleWatch(sessionId, heartRateCache, event.value, elapsed)
  }
})
```

---

## 4. Swift 模块设计

### 4.1 HealthKitService.swift（业务层）

**职责**：封装 HealthKit API，对上层屏蔽 HealthKit 细节。

```swift
import Foundation
import HealthKit

class HealthKitService {
    private let store = HKHealthStore()
    private var observers: [HKObserverQuery] = []
    private var mockTimer: Timer?

    // MARK: - 基础检查

    func isAvailable() -> Bool {
        return HKHealthStore.isHealthDataAvailable()
    }

    // MARK: - 授权

    func requestAuthorization(
        readTypes: Set<String>,
        completion: @escaping (Result<Set<String>, Error>) -> Void
    ) {
        var typesToRequest: Set<HKObjectType> = []
        for type in readTypes {
            if let hkType = mapToHKType(type) {
                typesToRequest.insert(hkType)
            }
        }

        store.requestAuthorization(toShare: [], read: typesToRequest) { success, error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(.failure(error))
                } else {
                    completion(.success(readTypes))
                }
            }
        }
    }

    // MARK: - 监测

    func startMonitoring(
        types: Set<String>,
        onUpdate: @escaping ([String: Any]) -> Void
    ) {
        for type in types {
            guard let sampleType = mapToHKType(type) else { continue }

            // 用 HKObserverQuery 监听数据变化
            let observer = HKObserverQuery(
                sampleType: sampleType,
                predicate: nil
            ) { [weak self] _, completionHandler, error in
                if error == nil {
                    self?.fetchLatest(type: sampleType, identifier: type, onUpdate: onUpdate)
                }
                completionHandler()
            }
            store.execute(observer)
            observers.append(observer)

            // 立即拉一次（不等数据变化）
            fetchLatest(type: sampleType, identifier: type, onUpdate: onUpdate)
        }
    }

    func stopMonitoring() {
        for observer in observers {
            store.stop(observer)
        }
        observers.removeAll()
        stopMockTimer()
    }

    // MARK: - 单次查询

    func fetchLatest(type: String, completion: @escaping ([String: Any]) -> Void) {
        guard let sampleType = mapToHKType(type) else {
            completion([:]); return
        }
        fetchLatest(type: sampleType, identifier: type, onUpdate: completion)
    }

    // MARK: - 私有方法

    private func mapToHKType(_ identifier: String) -> HKQuantityType? {
        switch identifier {
        case "hrv":
            return HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)
        case "heartRate":
            return HKObjectType.quantityType(forIdentifier: .heartRate)
        default:
            return nil
        }
    }

    private func fetchLatest(
        type: HKQuantityType,
        identifier: String,
        onUpdate: @escaping ([String: Any]) -> Void
    ) {
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
        let query = HKSampleQuery(
            sampleType: type,
            predicate: nil,
            limit: 1,
            sortDescriptors: [sort]
        ) { [weak self] _, samples, _ in
            guard let self = self,
                  let sample = samples?.first as? HKQuantitySample else {
                onUpdate([:]); return
            }

            let unit: HKUnit = (identifier == "heartRate")
                ? HKUnit.count().unitDivided(by: .minute())
                : HKUnit.secondUnit(with: .milli)

            let payload: [String: Any] = [
                "type": identifier,
                "value": sample.quantity.doubleValue(for: unit),
                "timestamp": sample.startDate.timeIntervalSince1970 * 1000,
                "source": sample.sourceRevision.source.name
            ]
            DispatchQueue.main.async {
                onUpdate(payload)
            }
        }
        store.execute(query)
    }

    // MARK: - Mock

    func startMockTimer(onUpdate: @escaping ([String: Any]) -> Void) {
        stopMockTimer()
        mockTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { _ in
            let mockHRV = 40.0 + Double.random(in: -10...15)
            let mockHR = 65.0 + Double.random(in: -5...10)
            onUpdate([
                "type": "hrv",
                "value": mockHRV,
                "timestamp": Date().timeIntervalSince1970 * 1000,
                "source": "Mock"
            ])
            onUpdate([
                "type": "heartRate",
                "value": mockHR,
                "timestamp": Date().timeIntervalSince1970 * 1000,
                "source": "Mock"
            ])
        }
    }

    func stopMockTimer() {
        mockTimer?.invalidate()
        mockTimer = nil
    }
}
```

### 4.2 SoundCareHRVModule.swift（插件入口）

**职责**：作为 DCUniPlugin 子类，对外暴露 JS 可调用的方法。

```swift
import Foundation
import DCUniPlugin

@objc(SoundCareHRVModule)
class SoundCareHRVModule: DCUniModule {
    private let service = HealthKitService()
    private var monitoringActive = false

    @objc func isAvailable(_ options: Any, callback: @escaping DCUniCallback) {
        callback([
            "available": service.isAvailable()
        ], false, nil)
    }

    @objc func requestAuthorization(_ options: Any, callback: @escaping DCUniCallback) {
        guard let params = options as? [String: Any],
              let readTypes = params["readTypes"] as? [String] else {
            callback(["success": false, "errorCode": "INVALID_PARAMS"], false, nil)
            return
        }

        service.requestAuthorization(readTypes: Set(readTypes)) { result in
            switch result {
            case .success(let granted):
                callback([
                    "success": true,
                    "grantedTypes": Array(granted)
                ], false, nil)
            case .failure(let error):
                callback([
                    "success": false,
                    "errorCode": "AUTH_FAILED",
                    "error": error.localizedDescription
                ], false, nil)
            }
        }
    }

    @objc func startMonitoring(_ options: Any, callback: @escaping DCUniCallback) {
        guard let params = options as? [String: Any],
              let types = params["types"] as? [String] else {
            callback(["success": false, "errorCode": "INVALID_PARAMS"], false, nil)
            return
        }

        let mockMode = params["mockMode"] as? Bool ?? false

        if mockMode {
            service.startMockTimer { [weak self] event in
                self?.sendEventToJS(event)
            }
        } else {
            service.startMonitoring(types: Set(types)) { [weak self] event in
                self?.sendEventToJS(event)
            }
        }

        monitoringActive = true

        // 关键：keepCallback = true
        // 后续 HKObserverQuery 触发的 event 会通过 sendEventToJS
        // 复用同一个 callback 推送给 JS
        callback(["success": true, "monitoring": true], true, nil)
    }

    @objc func stopMonitoring(_ options: Any, callback: @escaping DCUniCallback) {
        service.stopMonitoring()
        monitoringActive = false
        callback(["success": true, "monitoring": false], false, nil)
    }

    @objc func getLatest(_ options: Any, callback: @escaping DCUniCallback) {
        guard let params = options as? [String: Any],
              let type = params["type"] as? String else {
            callback(["success": false, "errorCode": "INVALID_PARAMS"], false, nil)
            return
        }

        service.fetchLatest(type: type) { data in
            callback([
                "success": !(data.isEmpty),
                "value": data["value"] ?? 0,
                "timestamp": data["timestamp"] ?? 0
            ], false, nil)
        }
    }

    @objc func setMockMode(_ options: Any, callback: @escaping DCUniCallback) {
        // 在 startMonitoring 时通过 mockMode 参数控制
        callback(["success": true], false, nil)
    }

    private func sendEventToJS(_ event: [String: Any]) {
        // 复用 startMonitoring 时以 keepCallback=true 注册的 callback
        // 将 HealthKit 事件推送给 JS（连续触发同一 callback）
        uniModule.executor.executeUniCallback(event: event)
    }
}
```

### 4.3 SoundCareHRVModule.m（ObjC 桥接）

uniapp DCUniPlugin 标准格式，必须有：

```objc
#import "DCUniPlugin.h"

@interface SoundCareHRVModule : DCUniModule
@end

@implementation SoundCareHRVModule

UNI_EXPORT_METHOD(@selector(isAvailable:callback:))
UNI_EXPORT_METHOD(@selector(requestAuthorization:callback:))
UNI_EXPORT_METHOD(@selector(startMonitoring:callback:))
UNI_EXPORT_METHOD(@selector(stopMonitoring:callback:))
UNI_EXPORT_METHOD(@selector(getLatest:callback:))
UNI_EXPORT_METHOD(@selector(setMockMode:callback:))

@end
```

### 4.4 Info.plist

```xml
<key>NSHealthShareUsageDescription</key>
<string>SoundCare 需要读取您的心率和 HRV 数据，以提供个性化的疗愈音乐体验。</string>
<key>NSHealthUpdateUsageDescription</key>
<string>SoundCare 需要写入健康数据，用于记录您的疗愈活动。</string>
<key>NSHealthClinicalHealthRecordsShareUsageDescription</key>
<string>用于记录您的疗愈活动。</string>
```

并在 Xcode 项目中勾选 **HealthKit** capability（这一步在 Mac 上做）。

### 4.5 package.json

uniapp 原生插件标准格式：

```json
{
  "name": "SoundCareHRV",
  "id": "SoundCareHRV",
  "version": "1.0.0",
  "description": "Apple Watch HRV 实时监测",
  "_dp_type": "nativeplugin",
  "_dp_nativeplugin": {
    "ios": {
      "plugins": [
        {
          "type": "module",
          "name": "SoundCareHRV",
          "class": "SoundCareHRVModule"
        }
      ],
      "integrateType": "framework",
      "dependencies": []
    },
    "android": {
      "plugins": [],
      "integrateType": "aar",
      "dependencies": []
    }
  }
}
```

---

## 5. 通信协议

### 5.1 调用流程

```
JS: hrv.startMonitoring({types: ['hrv']}, callback)
    ↓
uni-app runtime: 序列化参数 + 生成 callbackId
    ↓
DCUniPlugin framework: -[SoundCareHRVModule startMonitoring:callback:]
    ↓
Swift: func startMonitoring(_ options: Any, callback: @escaping DCUniCallback)
    ↓
返回: callback(["success": true, ...], false, nil)
    ↓
uni-app runtime: 反序列化 → 调用 JS callback(res)
```

### 5.2 关键参数说明

| 参数 | 含义 | 用法 |
|------|------|------|
| `options` | JS 传入的 JSON 参数 | Swift 端是 `Any` 类型，需要 cast 成 `[String: Any]` |
| `callback` | DCUniCallback 闭包 | 用于返回结果，签名 `(Any?, Bool, Error?) -> Void` |
| 第二个参数 `keepCallback` | 是否保持回调引用 | **事件流推送必须传 `true`**，否则 callback 只触发一次 |
| 第三个参数 `error` | 错误信息 | nil 表示成功 |

**特别说明**：uniapp 的 `uni.requireNativePlugin` 在新版可能支持 promise，但目前主流插件（包括官方）仍使用 callback 模式。本设计采用 callback。

### 5.3 事件推送机制

对于实时数据流（如 HRV 监测），有两种方式：

**方式 A：keepCallback = true**（推荐）
```swift
// 在 startMonitoring 的 callback 中传 true
callback(["success": true, "monitoring": true], true, nil)  // 第二个参数 true

// 之后的事件：
self.uniModule.executor.executeUniCallback(event: data)  // 持续触发
```

**方式 B：定时器单独 push**
- 复杂，不推荐

本设计采用方式 A。需要在 `startMonitoring` 第一次返回时传 `keepCallback = true`，之后的 `sendEventToJS` 就能持续触发 JS callback。

---

## 6. 数据流图

```
┌──────────────────────────────────────────────────────────┐
│  Apple Watch (iOS 17+)                                    │
│    └─ HealthKit 存储: HRV (SDNN) + HR 样本               │
└─────────────────────────┬────────────────────────────────┘
                          │ HealthKit Framework
                          ↓
┌──────────────────────────────────────────────────────────┐
│  iOS App (Native)                                         │
│  ┌────────────────────────────────────────────┐           │
│  │ HealthKitService.swift                    │           │
│  │  - HKHealthStore (单例)                   │           │
│  │  - HKObserverQuery (变化时触发)           │           │
│  │  - HKSampleQuery (拉取最新)               │           │
│  │  - 后台 → main queue 切换                 │           │
│  └────────────────┬───────────────────────────┘           │
│                   ↓ 业务数据                              │
│  ┌────────────────────────────────────────────┐           │
│  │ SoundCareHRVModule.swift (DCUniModule)    │           │
│  │  - isAvailable / requestAuth              │           │
│  │  - startMonitoring / stopMonitoring       │           │
│  │  - getLatest / setMockMode                │           │
│  │  - sendEventToJS (via executor)           │           │
│  └────────────────┬───────────────────────────┘           │
└───────────────────┼──────────────────────────────────────┘
                    ↓ DCUniPlugin bridge
┌──────────────────────────────────────────────────────────┐
│  uni-app JS Runtime (in WebView)                          │
│  ┌────────────────────────────────────────────┐           │
│  │ hrv-plugin.js                              │           │
│  │  - uni.requireNativePlugin('SoundCareHRV')│           │
│  │  - 接收事件 → 调用 music.js               │           │
│  └────────────────┬───────────────────────────┘           │
│                   ↓                                       │
│  ┌────────────────────────────────────────────┐           │
│  │ music.js                                   │           │
│  │  - updateHRVFromAppleWatch(s, hr, r)       │           │
│  └────────────────┬───────────────────────────┘           │
└───────────────────┼──────────────────────────────────────┘
                    ↓ HTTPS POST
┌──────────────────────────────────────────────────────────┐
│  Backend (FastAPI)                                        │
│  POST /api/v1/music/session/{id}/hrv-update               │
│  → 返回 { adjustment: {bpm_delta: -3}, metrics }          │
│  → 播放页动态调整 BPM                                     │
└──────────────────────────────────────────────────────────┘
```

---

## 7. 错误处理

### 7.1 错误码体系

| 错误码 | 含义 | 处理建议 |
|--------|------|----------|
| `HEALTHKIT_UNAVAILABLE` | 设备不支持 HealthKit（iPad / 无 Apple Watch） | 提示用户需要 iPhone + Apple Watch |
| `NOT_AUTHORIZED` | 用户拒绝授权 | 引导跳转到「设置 → 健康 → 数据访问」 |
| `QUERY_FAILED` | HealthKit 查询失败 | 稍后重试 |
| `INVALID_PARAMS` | JS 参数错误 | 检查参数类型 |
| `MONITORING_ALREADY_STARTED` | 重复调用 startMonitoring | 先 stopMonitoring |
| `WATCH_NOT_PAIRED` | 检测到 iPhone 但无 Apple Watch 配对 | 提示先配对 Apple Watch |
| `NO_DATA_AVAILABLE` | 已授权但 HealthKit 无数据 | 提示用户佩戴 Apple Watch 测量 |

### 7.2 返回格式约定

成功：
```javascript
{ success: true, /* 业务字段 */ }
```

失败：
```javascript
{ success: false, errorCode: "X", error: "可读消息" }
```

JS 层处理：
```javascript
hrv.requestAuthorization({...}, (res) => {
  if (!res.success) {
    switch (res.errorCode) {
      case 'NOT_AUTHORIZED':
        uni.showModal({ title: '需要授权', content: '请在设置中允许访问健康数据' })
        break
      case 'HEALTHKIT_UNAVAILABLE':
        uni.showToast({ title: '当前设备不支持' })
        break
      // ...
    }
  }
})
```

---

## 8. Mock 模式

### 8.1 用途

| 场景 | 收益 |
|------|------|
| 模拟器开发 | 模拟器无 HealthKit，Mock 让 UI 跑通 |
| 无 Apple Watch | 演示时使用 |
| CI 测试 | 无真机也能跑端到端测试 |
| 边界测试 | 模拟异常值（高/低 HRV） |

### 8.2 启用方式

```javascript
// 开发环境
hrv.startMonitoring({
  types: ['hrv', 'heartRate'],
  mockMode: true   // 强制使用 Mock
}, callback)
```

Mock 数据生成规则：
- HRV: 40 ± 10ms（正常放松范围）
- HR: 65 ± 5 BPM
- 每 5 秒推送一次
- 范围可控（用于测试边界）

---

## 9. 线程模型

### 9.1 HealthKit 线程规则

- HealthKit 回调默认在 **任意 background queue**
- 必须显式切到 main queue 才能更新 UI / 调用 DCUniPlugin

### 9.2 本设计的线程切换点

| 位置 | 线程 | 切换方式 |
|------|------|----------|
| HKObserverQuery 回调 | background | 内部 dispatch |
| HKSampleQuery 回调 | background | 内部 dispatch |
| `DispatchQueue.main.async` | main | 显式切换 |
| `sendEventToJS` | main | uniapp executor 内部处理 |
| JS callback 触发 | main | uniapp runtime 处理 |

### 9.3 内存安全

- 所有闭包使用 `[weak self]` 避免循环引用
- 插件释放时清理 observers、timer、HKHealthStore

---

## 10. 测试策略

### 10.1 三层测试

| 层级 | 工具 | 覆盖 |
|------|------|------|
| 单元测试（Mac） | XCTest | HealthKitService 业务逻辑 |
| 集成测试（Mac 模拟器） | HBuilderX + 模拟器 | JS↔Swift 通信 |
| 真机测试（iPhone + Apple Watch） | HBuilderX + 真机 | 端到端 |

### 10.2 模拟器测试限制

| 能力 | 模拟器 | 真机 |
|------|--------|------|
| 授权弹窗 | ✅ | ✅ |
| isAvailable | ✅ | ✅ |
| HKObserverQuery | ⚠️ 需手动添加数据 | ✅ |
| Mock 模式 | ✅ | ✅ |

**模拟器手动添加数据**：
打开 Health App → 摘要 → 心脏 → 添加数据 → 手动输入 HRV / HR

### 10.3 后端联调

1. 启动后端（监听 8000）
2. 修改 `soundcare-native/app/src/config.js` 指向 `http://localhost:8000`（Mac 本机）
3. HBuilderX 运行到 iPhone 真机
4. 打开播放页 → 触发 HRV 监测 → 观察后端日志

### 10.4 调试技巧

| 问题 | 调试方法 |
|------|----------|
| Swift 端未触发 | Xcode console 看 print |
| JS 端未收到 | HBuilderX 控制台看 console.log |
| 授权失败 | 删除真机上的 APP 重装，权限弹窗会重现 |
| 模拟器无数据 | Health App 手动添加数据 |

---

## 11. 实施步骤

### 11.1 Windows 阶段（AI 协助）

```
[1] ✅ 写架构设计（本文档）
[2] ✅ 写 Swift 插件代码（HealthKitService + Module + .m 桥接）
[3] ✅ 写 package.json
[4] ✅ 写 Info.plist
[5] ⏸ 写 hrv-plugin.js（JS 封装层）
[6] ⏸ 改 music.js 接入 hrv-plugin
[7] ⏸ 改 device-pair/index.vue 触发授权
[8] ⏸ 改 manifest.json 声明插件
[9] ⏸ 写 Mac 端集成操作指南
```

### 11.2 Mac 阶段（用户操作）

```
[10] git pull（或拷贝 nativeplugins/ 目录）
[11] HBuilderX 打开 soundcare-native 项目
[12] 菜单：运行 → 运行到手机或模拟器 → 制作自定义调试基座
     - 勾选 HealthKit
     - 配置 Bundle ID（如 com.soundcare.app）
[13] 真机运行 → 触发授权 → 验证数据流
[14] 调试：console.log + Xcode console
```

### 11.3 Git 提交建议

```
feat(native-plugin): add SoundCareHRV iOS native plugin skeleton
docs(architecture): add HRV plugin architecture design
feat(js): add hrv-plugin.js wrapper layer
feat(manifest): declare SoundCareHRV native plugin
docs(mac): add Mac integration step-by-step guide
```

---

## 12. 已确认的设计决策

2026-06-11 review 确认：

| # | 决策项 | 选择 | 含义 |
|---|------|------|------|
| 1 | HRV 采样频率 | 系统默认（变化即推送） | Apple Watch 数据更新即触发，间隔不固定（实测 5-10 秒） |
| 2 | 监测范围 | 仅前台 | App 切后台即停止监测；不需要 Background Modes 能力 |
| 3 | Mock 模式 | 默认关闭 | JS 层显式 `mockMode: true` 启用；生产环境绝对不能用 |
| 4 | iPad 支持 | 优雅降级 | `isAvailable` 返回 `false`，HRV 相关页面自动隐藏；其他功能正常 |
| 5 | 音频会话冲突 | 暂不处理 | HealthKit + AVAudioSession 实测互不干扰，无需额外配置 |
| 6 | 错误重试 | 不自动重试 | 错误上抛 JS 层（`errorCode`），由调用方决定重试策略 |

---

## 13. 实现说明

2026-06-12 实施时相对本文档的代码示例做了 3 处微调，**已反映在 commit `553f35a`**：

| # | 调整 | 原因 |
|---|------|------|
| 1 | `startMonitoring` 初次返回 `keepCallback = true` | 设计文档代码误写为 `false`，会导致后续事件无法复用 callback，事件流断 |
| 2 | `HealthKitService` / `SoundCareHRVModule` 加 `deinit` 清理 | 释放 observers、mock timer、streamingCallback，避免泄漏 |
| 3 | `requestAuthorization` / `getLatest` 错误码细分 | 按 `ServiceError` 枚举区分 `HEALTHKIT_UNAVAILABLE` / `QUERY_FAILED` / `NO_DATA_AVAILABLE` / `AUTH_FAILED`，上层更容易处理 |

**Mac 端需要验证 1 个 API**（`SoundCareHRVModule.swift:200`）：

```swift
uniModule.executor.executeUniCallback(event: event)
```

如果 HBuilderX 自定义基座带的 DCUniPlugin 框架此 API 不匹配，备选方案：
- `self.executeUniCallback(event: event, keepAlive: true)`
- `self.invoke(methodName: "onHRVUpdate", params: event)`

**实际代码行数**：

| 文件 | 行数 |
|------|------|
| `HealthKitService.swift` | 232 |
| `SoundCareHRVModule.swift` | 220 |
| `SoundCareHRVModule.m` | 30 |
| `Info.plist` | 12 |
| `package.json` | 26 |
| **合计** | **520** |

---

## 附录 A：uniapp 原生插件关键概念

### A.1 DCUniModule 基类

uniapp 原生插件必须继承自 `DCUniModule`（DCloud 提供的基类），核心能力：
- 方法导出：通过 `UNI_EXPORT_METHOD` 宏
- 事件发送：`self.uniModule.executor.executeUniCallback(event:)`
- 线程管理：内置 GCD queue

### A.2 package.json 必填字段

```json
{
  "name": "插件名",
  "id": "唯一ID",
  "version": "1.0.0",
  "_dp_type": "nativeplugin",
  "_dp_nativeplugin": {
    "ios": { "plugins": [{ "type": "module", "name": "插件名", "class": "类名" }] }
  }
}
```

### A.3 manifest.json 声明

```json
"app-plus": {
  "nativePlugins": {
    "SoundCareHRV": {
      "version": "1.0.0",
      "provider": "your-uniapp-username"
    }
  }
}
```

---

## 附录 B：相关文档

| 文档 | 内容 |
|------|------|
| `SoundCare_开发指南.md` § 11 iOS 原生应用开发 | iOS 编译、IPA 结构、证书 |
| `SoundCare_原生应用真机测试指南.md` | 真机调试流程 |
| uniapp 原生插件官方文档 | https://nativesupport.dcloud.net.cn/NativePlugin/README |

---

**当前状态**：Swift 代码已完成（commit `553f35a`），待 JS 封装层 + manifest.json 接入。
**下一步**：写 `hrv-plugin.js` + 改 `music.js` + 改 `device-pair` + 改 `manifest.json`，最后写 Mac 集成清单。
