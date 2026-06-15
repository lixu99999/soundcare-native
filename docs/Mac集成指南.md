# SoundCare Native APP - Mac 端集成与测试指南

iOS 原生插件（`SoundCareHRV`）已在 Windows 端写完。Mac 端负责 Xcode 集成、签名、真机调试。

> **前置条件**
> - macOS Sequoia
> - Xcode 26.3（Xcode for Sequoia 最高版本）
> - HBuilderX 3.95+（alpha 版即可，需支持自定义基座）
> - **Apple Developer 付费账号（$99/年，强制要求）**——HealthKit 不支持免费 Personal Team，详见 [§4.0 账号要求](#40-账号要求强制)
> - iPhone 真机（iOS 17+）+ Apple Watch（Series 4+，watchOS 10+）

---

## 1. 拉取代码

```bash
cd ~/code   # 或你常用的开发目录
git clone git@github.com:lixu99999/soundcare-native.git
cd soundcare-native
```

> 如果之前已 clone，先 `git pull` 拉最新：
> ```bash
> cd soundcare-native && git pull
> ```

在 soundcare-native/ 目录启动 Claude Code（如已配置 CLAUDE.md，会自动加载上下文）。

---

## 2. 安装依赖

```bash
cd app
npm install
```

> 注意：`package.json` 在 `app/` 目录下，必须在 `app/` 里 `npm install`，不要在 `soundcare-native/` 根目录。

---

## 3. 在 HBuilderX 中打开项目

1. 启动 HBuilderX
2. 文件 → 打开目录 → 选择 `soundcare-native/app`
3. 项目加载完成后，左侧文件树应能看到：
   ```
   app/
   ├── src/
   │   ├── pages/
   │   │   └── device-pair/index.vue  ← 设备配对页（含 HRV 配对逻辑）
   │   └── api/
   │       └── hrv-plugin.js  ← HRV 插件 JS 封装
   └── nativeplugins/
       └── SoundCareHRV/  ← iOS 原生插件源码
   ```

### 3.5 HBuilderX 3.95+ alpha 已知问题（必读）

> 本项目使用 HBuilderX 3.95+ alpha 验证，alpha 版有几个已知坑。**第一次打开项目时如果遇到以下问题，按本节修复**：

#### 问题 1：iOS 模拟器编译报错「缺少编译器」

**症状**：

```
[错误] 缺少编译器：vue/compiler-sfc
```

**原因**：`manifest.json` 没有显式声明 `vueVersion`，HBuilderX 默认按 Vue 2 解析，但 uniapp vite plugin 走 Vue 3 路径，找不到 Vue 3 编译器。

**修复**：编辑 `app/src/manifest.json`，在 `versionCode` 之后增加 `"vueVersion": "3"`：

```json
{
  "name": "SoundCare",
  "appid": "__UNI__SOUNDCARE_NATIVE",
  "versionName": "1.0.0",
  "versionCode": "100",
  "transformPx": false,
  "vueVersion": "3",          ← 添加这一行
  "app-plus": { ... }
}
```

> **副作用**：第一次保存后，HBuilderX 会触发完整的依赖解析（30s-2min），耐心等待。

#### 问题 2：H5 预览 / 浏览器白屏

**症状**：HBuilderX 内置浏览器或外部浏览器打开 `localhost:PORT` 时白屏，控制台只有 `[vite] connected`，没有报错。

**原因**：HBuilderX 3.95+ alpha 的 uni-app vite plugin 在某些情况下**不会自动注入 `<script src="/src/main.js">` 入口**到 `index.html`。

**修复**：编辑 `app/index.html`，在 `<div id="app"></div>` 之后手动添加 main.js 引用：

```html
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>   ← 手动添加
</body>
```

#### 问题 3：底部 tabBar 字体小 + 页面标题（导航栏）黑色

**症状**：
- tabBar 上的「首页 / HRV 监测 / 我的」字体约 10px
- 页面顶部导航栏标题在深色背景上显示黑色，看不清

**修复**：编辑 `app/src/pages.json`：

```json
{
  "globalStyle": {
    "navigationBarTextStyle": "white",      ← 把 "black" 改为 "white"
    "navigationBarTitleText": "SoundCare",
    "navigationBarBackgroundColor": "#1a1a2e"
  },
  "tabBar": {
    "color": "#888888",
    "selectedColor": "#FF6B00",
    "backgroundColor": "#1a1a2e",
    "fontSize": "14px",                      ← 加上这一行
    "iconWidth": "22px",
    "list": [
      { "pagePath": "pages/index/index", "text": "首页" },
      { "pagePath": "pages/hrv-monitor/index", "text": "HRV监测" },
      { "pagePath": "pages/profile/index", "text": "我的" }
    ]
  }
}
```

> **小贴士**：HBuilderX 改完 `pages.json` 后会自动重载；如果 tabBar 没刷新，手动重启 HBuilderX。

#### 问题 4：vite plugin 版本与 HBuilderX 不匹配

**症状**：HBuilderX 自带的 vite 插件版本比 `package.json` 中声明的低，运行时报 `Cannot find module 'vite/dist/node/index.js'` 之类。

**修复**（Mac 端 2026-06-14 已验证）：降低 `package.json` 中 vite 相关版本：

```json
{
  "devDependencies": {
    "vite": "^4.0.0",                    ← 从 5.x 降到 4.x
    "@dcloudio/vite-plugin-uni": "^3.0.0"  ← 对齐 HBuilderX 自带
  }
}
```

> 这一步通常在第一次 npm install 后 HBuilderX 会提示，按提示接受即可。

---

## 4. 制作自定义调试基座（关键步骤）

**为什么需要自定义基座**：uniapp 官方基座不包含 HealthKit framework。要调用 HealthKit API，必须自己打包一个带 HealthKit 的基座。

### 4.0 账号与阶段说明

v1.1 起，HRV 插件支持**两阶段策略**，先免费跑通 UI 流程，付费后再接真 HealthKit。

#### Phase 1（推荐入口）：免费 Apple ID + 标准基座 + JS Mock

| 项 | 说明 |
|----|------|
| 账号 | 免费 Apple ID（Personal Team）即可 |
| 基座 | HBuilderX **标准基座**（无需自定义） |
| HRV 数据 | **JS 层 mock**（`hrv-plugin.js` 内部 `startJsMock`，与 soundcare-app 同样算法） |
| 限制 | 真实 Apple Watch 数据**不可用**，仅 UI 流程演示 |
| 适合 | 验证 iOS 基础界面 / 播放页 / 设备配对页 / HRV 监测页的完整流程 |

**优势**：
- ✅ 无需付费
- ✅ Mac 端工作量最小（**不需要**做自定义基座）
- ✅ Mac 集成步骤 4.1-4.3 可全部跳过
- ✅ 业务代码（hrv-monitor / device-pair）已经为 5 级状态对齐

**Phase 1 的 Mac 端工作**：
1. HBuilderX 打开 `soundcare-native/app` 项目
2. 用自己的 Apple ID 登录（Xcode → Settings → Accounts）
3. iPhone 连 Mac → 信任设备
4. HBuilderX → 运行 → 运行到 iPhone 真机（标准基座）
5. 进入 APP 验证：首页 / 生成 / 播放 / 个人 / 设备配对 / HRV 监测
6. 在「设备配对」页点「测试数据流（5 秒）」，应看到 Mock 事件

#### Phase 2（升级后）：付费 Apple ID + 自定义基座 + 真 HealthKit

| 项 | 说明 |
|----|------|
| 账号 | 付费 Apple Developer（$99/年） |
| 基座 | HBuilderX **自定义调试基座**（带 HealthKit） |
| HRV 数据 | 真 Apple Watch HealthKit 数据流 |
| 需要 | 配对 Apple Watch + iPhone |
| 适合 | 真实用户体验测试 + 后期 App Store 上架准备 |

**Phase 2 何时启动**：
- 上线前 3-6 个月启动合规（算法备案 + APP 备案）
- 拿到付费账号后 24-48 小时激活
- 然后走下面的 §4.1-4.3

#### 决策表

| 你的情况 | 推荐阶段 |
|----------|----------|
| 想先看 iOS 跑起来 | **Phase 1**（免费，先跑通） |
| 已有付费账号 / 准备上线 | Phase 2（直接做自定义基座） |
| 团队多人 + 长期项目 | Phase 2（一次到位） |
| 时间紧 + 验证后端 | Phase 1（最快路径） |

### 4.1 准备证书（Phase 2 首次）

> Phase 1 用标准基座 + 免费 Apple ID，**不需要**走本节。直接跳到 §5。
>
> 付费账号激活后再回来做这一步。

1. 打开 Xcode → Settings → Accounts → 添加你的付费 Apple ID
2. 下载 "iOS Development" 证书到 Keychain
3. 创建一个 development provisioning profile：
   - Xcode → Settings → Accounts → 选择 Apple ID → Manage Certificates
   - 或登录 https://developer.apple.com → Certificates, Identifiers & Profiles

1. 打开 Xcode → Settings → Accounts → 添加你的 Apple ID
2. 下载 "iOS Development" 证书到 Keychain
3. 创建一个 development provisioning profile：
   - Xcode → Settings → Accounts → 选择 Apple ID → Manage Certificates
   - 或登录 https://developer.apple.com → Certificates, Identifiers & Profiles

### 4.2 创建 App ID（Phase 2）

1. 登录 https://developer.apple.com
2. Certificates, Identifiers & Profiles → Identifiers → "+"
3. 选择 "App IDs" → Continue
4. Description: `SoundCare Dev`
5. Bundle ID: `com.soundcare.app`（显式，不是通配符）
6. Capabilities → 勾选 "HealthKit"
7. Continue → Register

> **重要**：如果用通配符 Bundle ID（`com.soundcare.*`），无法勾选 HealthKit。必须用显式 ID。

### 4.3 在 HBuilderX 制作基座（Phase 2）

1. HBuilderX 菜单：运行 → 运行到手机或模拟器 → 制作自定义调试基座
2. 在弹出的"自定义基座"对话框中：
   - 顶部：选择 "iOS"
   - 包名：填 `com.soundcare.app`（与第 4.2 步的 Bundle ID 一致）
   - 证书：选择你的 Apple Developer 证书
   - profile：选择对应的 development profile
   - 勾选能力：**HealthKit**（必须）
3. 点击 "打包"
4. 等待 2-5 分钟（首次较慢，需要下载 HealthKit framework）
5. 打包完成后，HBuilderX 控制台会提示基座路径，类似：
   ```
   /Users/yourname/HBuilderX/plugins/.../SoundCare_Debug.ipa
   ```

---

## 5. 运行到 iPhone 真机

### 5.1 连接设备

1. iPhone 用数据线连 Mac
2. iPhone 弹出"信任此电脑"，点信任，输入解锁密码
3. Xcode → Window → Devices and Simulators → 确认设备已识别

### 5.2 安装自定义基座

1. HBuilderX 菜单：运行 → 运行到手机或模拟器 → 运行到 iPhone 真机
2. 首次运行时，HBuilderX 会提示选择基座，选刚才打包的 `SoundCare_Debug.ipa`
3. HBuilderX 自动安装基座到 iPhone
4. 安装完后，iPhone 桌面上会出现"SoundCare" 图标（黑色基座，区别于 App Store 的）

### 5.3 运行项目

1. 在 HBuilderX 中，确认项目已选择"自定义基座"（状态栏会显示）
2. 点击运行按钮（绿色三角）→ 选择设备 → 启动 APP
3. APP 启动后，导航到"我的"→"设备配对"页

---

## 6. 验证 HRV 插件工作

### 6.1 模拟器验证（仅功能验证）

模拟器**没有真正的 HealthKit 数据**，但可以测试：
- isAvailable 返回 false（因为 iPad/模拟器不支持）
- UI 优雅降级（"需要 iPhone + Apple Watch"）
- 错误处理

### 6.2 真机验证（完整功能）

1. 佩戴 Apple Watch（确保已与 iPhone 配对）
2. 在 Watch 上打开 "Heart Rate" 应用，让它测一次心率（确保 HealthKit 里有数据）
3. iPhone 打开 SoundCare → 设备配对 → 点 "Apple Watch" → 触发系统授权弹窗
4. 允许授权后，页面应显示 "已连接"
5. 点击 "测试数据流（5 秒）" 按钮：
   - 应在 5 秒内显示 "HRV 52.3ms (Apple Watch)" 或 "HR 68 BPM (Apple Watch)"
   - 如果没显示，参考下面的调试

### 6.3 手动添加 HealthKit 数据（如果 Apple Watch 没数据）

1. iPhone 打开 Health App
2. 摘要 → 心脏 → 添加数据
3. 选择 "心率" → 手动输入（如 68 BPM）
4. 选择 "心率变异性 (HRV)" → 手动输入（如 50ms）
5. 再回 SoundCare 测试数据流

---

## 7. 验证后端联动

### 7.1 配置 API 地址

1. 编辑 `app/src/config.js`
2. 确认 `API_BASE_URL` 指向后端：
   - Mac 本地后端：`http://localhost:8000`（或 `http://127.0.0.1:8000`）
   - 远程后端：`https://api.collegegenerator.cn/api/v1`
3. 改完重新运行 APP

### 7.2 触发 HRV 上报

实际播放页才能触发 HRV 上报（需要 sessionId）。最简单的端到端测试：
1. 启动后端 `uvicorn app.main:app --reload --port 8000`
2. 后端日志开启 DEBUG 级别
3. iPhone 进入 SoundCare 播放页
4. 点击"开始播放"
5. 观察后端日志：每 5-10 秒应有一条 `POST /api/v1/music/session/.../hrv-update`
6. 响应包含 `adjustment.bpm_delta` 和 `session_metrics`

---

## 8. 调试技巧

### 8.1 查看 Swift 端日志（Xcode console）

1. Xcode → Window → Devices and Simulators → 选 iPhone → Open Console
2. 过滤 "SoundCare" 或 "HealthKit"
3. 在 Swift 代码里加 `print()` 即可看到

### 8.2 查看 JS 端日志（HBuilderX 控制台）

HBuilderX 底部"控制台"标签页直接显示 `console.log` 输出。

### 8.3 验证插件 API 是否正确

如果 `uniModule.executor.executeUniCallback` 编译报错或运行没效果：

打开 `app/nativeplugins/SoundCareHRV/ios/SoundCareHRVModule.swift` 第 200 行附近，尝试备选方案：
```swift
// 方案 A（默认，可能不正确）
uniModule.executor.executeUniCallback(event: event)

// 方案 B（备选 1）
self.executeUniCallback(event: event, keepAlive: true)

// 方案 C（备选 2：用 invoke）
self.invoke(methodName: "onHRVUpdate", params: event)
```

改完在 HBuilderX 重新"运行"。

### 8.4 重置 HealthKit 授权

如果授权状态错乱，删除 iPhone 上的 SoundCare APP 重装：
1. 长按 SoundCare 图标 → 移除 APP
2. 重新从 HBuilderX 运行安装
3. 首次启动会重新弹授权框

### 8.5 自定义基座过期

自定义调试基座默认 7 天过期。过期后：
- iPhone 上 APP 图标变白
- 重新"制作自定义调试基座"→ 重新安装

---

## 9. 常见问题

### Q0: 证书在 Keychain 显示 untrusted，能用吗？

**答**：Phase 1 直接用，能跑通 UI（标准基座 + JS mock）。

免费 Apple ID（Personal Team）下，Xcode 会在本机自签证书，Keychain 标记 untrusted 是正常现象。Apple 政策禁止 Personal Team 使用 HealthKit entitlement，所以**真 HealthKit 数据**不可用——但 v1.1 起 `hrv-plugin.js` 内置 JS mock 兜底，UI 流程完全跑得通。

**解决（Phase 2）**：升级付费开发者账号（$99/年），详见 §4.0。

### Q1: HBuilderX 找不到 SoundCareHRV 插件

**症状**：JS 端 `uni.requireNativePlugin('SoundCareHRV')` 返回 null

**排查**：
1. 检查 `app/src/manifest.json` 有没有 `nativePlugins.SoundCareHRV`
2. 检查 `app/nativeplugins/SoundCareHRV/package.json` 的 `id` 字段是不是 `SoundCareHRV`
3. 重启 HBuilderX
4. HBuilderX → 项目右键 → "重新识别项目类型"

### Q2: 真机上没收到 HRV 事件

**排查**：
1. 打开 Health App，确认有 HRV/HR 数据
2. 检查 `app/src/config.js` 的 `API_BASE_URL` 是否能访问（iPhone 和 Mac 在同一 WiFi）
3. Xcode console 看有没有 `Error executing observer query`
4. 用"测试数据流"按钮快速验证（5 秒内应收到事件）

### Q3: Xcode 编译报错 "DCUniPlugin.h not found"

**原因**：HBuilderX 自定义基座没正确安装

**解决**：
1. 重新"制作自定义调试基座"，确保 iOS 平台
2. 重新"运行到 iPhone 真机"让 HBuilderX 自动 link framework

### Q4: 授权弹窗不出现

**原因**：之前已授权或拒绝过，弹窗不会重复出现

**解决**：
1. 删除 iPhone 上的 SoundCare APP
2. 重新安装（弹窗会重现）
3. 或在 iPhone → 设置 → 健康 → 数据访问 → 设备 → SoundCare 修改权限

### Q5: 模拟器能跑吗？

**功能限制**：
- isAvailable: false（模拟器无 HealthKit）
- 授权弹窗：✅ 会出现
- 数据流：❌ 无数据（除非手动添加，参考 6.3）

**建议**：模拟器只用来跑 UI，数据流验证必须真机。

---

## 10. 完整流程 checklist

### Phase 1（免费 + 标准基座 + JS Mock）

按顺序勾选：

- [ ] Mac 已安装 Xcode 26.3 + HBuilderX 3.95+
- [ ] git clone + npm install 完成
- [ ] HBuilderX 打开 app/ 目录成功
- [ ] 免费 Apple ID 已登录 Xcode
- [ ] iPhone 真机已连接并信任
- [ ] HBuilderX → 运行到 iPhone 真机（**标准基座**）
- [ ] APP 启动，能进入"首页 / 生成 / 播放 / 个人"
- [ ] 进入"设备配对"页 → 触发授权（mock 模式不弹系统框）
- [ ] "测试数据流（5 秒）"按钮能在 5 秒内收到 Mock 事件
- [ ] 进入"HRV 监测"页 → 启动 → 看到 Mock 数据流
- [ ] 停止监测 → 数据流停止

全部勾完 = v1.1 Phase 1 验证成功 🎉

### Phase 2（付费 + 自定义基座 + 真 HealthKit）

- [ ] 已升级付费 Apple Developer（$99/年）
- [ ] 准备证书（§4.1）
- [ ] 创建 App ID 并勾选 HealthKit（§4.2）
- [ ] 制作自定义调试基座（§4.3）
- [ ] iPhone 真机已连接，自定义基座已安装
- [ ] Apple Watch 已配对 iPhone
- [ ] APP 启动 → "设备配对"页 → 系统弹授权框 → 允许
- [ ] "测试数据流"按钮能在 5 秒内收到 **Apple Watch 真实数据**
- [ ] 进入"HRV 监测"页 → 看到 source='Apple Watch'
- [ ] 后端能收到 `device_type='apple_watch'` 的 HRV 上报

全部勾完 = v1.1 Phase 2 验证成功 🎉

### 一句话选阶段

> 没付费 → Phase 1（5 分钟跑通） / 已付费 → Phase 2（完整真 HealthKit）

---

## 11. 下一步

v1 跑通后，可以考虑：

| 方向 | 价值 | 难度 |
|------|------|------|
| 后台监测（Background Modes） | 锁屏也能监测 | 中（需 entitlements + audio session） |
| 历史 HRV 查询 | 看每日/每周趋势 | 低（HKStatisticsQuery） |
| 华为手表 v2 | 拓展 Android 用户 | 中（huawei-health 插件） |
| App Store 上架 | 真用户 | 高（需要 production certificate、App Review） |

当前 v1 范围：仅前台 + 仅 iOS + 仅 Apple Watch。

---

**遇到本文档没覆盖的问题**：在 soundcare-native/ 目录启动 Claude Code 会话，告诉他具体现象和错误日志，会帮你查。
