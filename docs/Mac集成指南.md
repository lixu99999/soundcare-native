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

> **2026-06-15 复盘**：问题 4 **不是必要修复**。Windows 端单独加 `vueVersion: "3"`（问题 1）就已解决编译问题，未降级 vite 也跑通 H5。如果 Mac 端按问题 1 修复后能正常编译，**跳过本节**，`package.json` 保持 5.x 默认即可。如果 Mac 端昨天为了修编译问题降级了 vite 依赖，可以放心还原：`git checkout package.json package-lock.json`（或直接 `git reset --hard origin/main`）。

### 3.6 DCloud 公共企业签名已停用（2026-06-15 新增，必读）

> **重要变更**：HBuilderX 之前内置的 DCloud 公共企业开发者 ID（用于给所有用户的标准基座打签名）已停用。**iOS 真机测试不再支持用 HBuilderX 自带签名直接安装**，必须使用开发者自己的 Apple ID + 证书 + Profile + 私钥导入。

#### DCloud 官方说明（2026-06-15 引用）

> HBuilderX 中自带的标准真机运行基座，使用 DCloud 向苹果申请的企业开发者证书签名，根据苹果开发者企业计划许可协议要求，使用企业开发者证书签名的 App 只允许企业员工内部使用，不允许企业外部人员安装使用。
>
> 因收到苹果公司警告，目前开发者已无法在 iOS 真机设备使用标准运行基座。（Mac 电脑中的 iOS 模拟器中还可以继续使用标准基座，它不限制企业证书使用）

**对我们的影响**：
- ❌ iOS 真机（iPhone）→ 标准基座不可用 → **必须**自备 Apple ID + 证书签自定义基座
- ✅ iOS 模拟器（Mac）→ 标准基座**仍可用**（无企业证书限制），跑 UI 流程不需要做自定义基座

#### 影响范围

| 阶段 | 之前 | 现在 |
|------|------|------|
| Phase 1（免费 Apple ID + 标准基座） | HBuilderX 用 DCloud 公共证书签标准基座 → 直接装到 iPhone | **必须**用自己的免费 Apple ID 签 **自定义基座** |
| Phase 2（付费 + HealthKit） | 本来就要自带证书 | 不变 |
| iOS 模拟器（任意阶段） | 标准基座 | **不受影响**，仍可用标准基座跑 UI 流程 |

> 简言之：**Phase 1 也不再"开箱即用"了**，但仍可免费跑通（Apple ID + 自签 dev cert 不花钱），只是 Mac 端需要多走 §4.0.5 的"导入证书"流程，并跳过 DCloud 的"标准基座"选项，自己做 **自定义调试基座**。
>
> **替代方案**：如果 Mac 端暂时不想做自定义基座，可以先用 iOS 模拟器（标准基座可用）跑通 UI 流程。但模拟器无 HealthKit，无法验证真数据流。

#### 关于"标准基座"选项

HBuilderX 菜单「运行 → 运行到手机或模拟器」时让你选基座：
- 之前：可选"标准基座"（DCloud 公共签名的免配置基座）
- 现在：
  - 选 "iPhone 真机" → **"标准基座" 不可用**，只能选「自定义调试基座」
  - 选 "iOS 模拟器" → "标准基座" **仍可用**（推荐先用模拟器验 UI 流程）

自定义基座在 §4.0.5 / §4.1 / §4.2 流程，**Phase 1 跳到 §4.0.5**，**Phase 2 走完整 §4.0.5 + §4.1 + §4.2**。

---

## 4. 制作自定义调试基座（关键步骤）

**为什么需要自定义基座**：uniapp 官方基座不包含 HealthKit framework。要调用 HealthKit API，必须自己打包一个带 HealthKit 的基座。

### 4.0 账号与阶段说明

v1.1 起，HRV 插件支持**三阶段策略**，先在模拟器 5 分钟跑通，再免费上 iPhone 真机，最后付费接真 HealthKit。

> **2026-06-15 重要更正**：DCloud 公共企业签名已停用（详见 §3.6），iPhone 真机路径**需要自带 Apple ID + 证书**。但**模拟器路径不受影响**（苹果只限制真机的企业证书），仍可使用 DCloud 标准基座 — 这给了我们一个零证书的快速验证入口。

#### Phase 1A（最快入口，0 证书）：模拟器 + 标准基座 + JS Mock

| 项 | 说明 |
|----|------|
| 设备 | Mac 自带 iOS 模拟器 |
| 账号 | **不需要** |
| 基座 | HBuilderX **标准基座**（DCloud 公共签名，**模拟器仍可用**，§3.6） |
| HRV 数据 | **JS 层 mock**（`hrv-plugin.js` 内部 `startJsMock`，与 soundcare-app 同样算法） |
| 工作量 | 5 分钟 |
| 限制 | 模拟器无真传感器 / 无真 HealthKit / 无 iOS 真机 UX 细节差异 |
| 适合 | 第一轮验 UI 流程 + HRV mock 数据流是否能正常跑通 |

**为什么模拟器 + 标准基座能跑通 HRV mock？**

`hrv-plugin.js` 加载时调 `uni.requireNativePlugin('SoundCareHRV')`：
- 标准基座没注册 SoundCareHRV 插件 → `plugin === null` → 触发 `startJsMock()` 兜底
- `isAvailable()` 返回 `{ available: true, mockFallback: true }` → UI 不显示"设备不支持"
- 监测启动后 5 秒一帧 mock 数据（RMSSD ≈ 40ms，5 级状态对齐小程序）
- 真机 + 自定义基座场景：插件已注册 → 走原生层，但只要 `mockMode: true` 同样能跑 mock

**Phase 1A 的 Mac 端工作**（5 分钟搞定）：
1. HBuilderX 打开 `soundcare-native/app` 项目
2. HBuilderX → 运行 → 运行到 iOS 模拟器（**标准基座**直接可选）
3. 进入 APP 验证：首页 / 生成 / 播放 / 个人 / 设备配对 / HRV 监测
4. 进入「HRV 监测」→ 启动 → 5 秒后看到 mock 数据流（曲线、状态、趋势）
5. 停止监测

#### Phase 1B（真机 UX，免费）：iPhone 真机 + 自定义基座（免费 Apple ID）+ JS Mock

| 项 | 说明 |
|----|------|
| 设备 | iPhone 真机（iOS 17+） |
| 账号 | 免费 Apple ID（Personal Team） |
| 基座 | HBuilderX **自定义调试基座**（用自己 Apple ID 签的，**不**勾选 HealthKit） |
| HRV 数据 | **JS 层 mock**（同 Phase 1A） |
| 工作量 | 30 分钟（首次做基座） |
| 限制 | 真实 Apple Watch 数据**不可用**，仅 UI 流程 + mock 数据 |
| 适合 | 验证 iPhone 真机 UX（与模拟器的渲染差异、性能、手势） |

**Phase 1B 的 Mac 端工作**：
1. Phase 1A 跑通后，确认要走真机再继续
2. 用自己的免费 Apple ID 登录（Xcode → Settings → Accounts）
3. Xcode 自动生成 Personal Team dev cert（§4.0.5）
4. HBuilderX → 运行 → 制作自定义调试基座（**不**勾选 HealthKit），用自己的免费证书签
5. iPhone 连 Mac → 信任设备
6. HBuilderX → 运行 → 运行到 iPhone 真机（**自定义基座**）
7. 进入 APP 验证：首页 / 生成 / 播放 / 个人 / 设备配对 / HRV 监测
8. 在「设备配对」页点「测试数据流（5 秒）」，应看到 Mock 事件

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
- 然后走下面的 §4.0.5 + §4.1 + §4.2

#### 决策表

| 你的情况 | 推荐阶段 |
|----------|----------|
| 第一次跑通 / 想 5 分钟看效果 | **Phase 1A**（模拟器 + 标准基座，零证书） |
| 模拟器过了，要验真机 UX | **Phase 1B**（iPhone + 免费 Apple ID + 自定义基座） |
| 已有付费账号 / 准备上线 | Phase 2（直接做自定义基座） |
| 团队多人 + 长期项目 | Phase 2（一次到位） |
| 时间紧 + 验证后端 | Phase 1A → Phase 1B（先快后稳） |

### 4.0.5 通用：导入 Apple ID 证书（Phase 1B + Phase 2 必做）

> **2026-06-15 新增**：DCloud 公共签名停用（§3.6）后，**iPhone 真机路径必须自带证书**。**Phase 1A（模拟器 + 标准基座）跳过本节**。Phase 1B / Phase 2 都从这开始。

#### Phase 1B（免费 Apple ID）

1. 打开 Xcode → Settings → Accounts
2. 左下角 "+" → 添加你的免费 Apple ID
3. 选中刚添加的账号 → 点 "Manage Certificates"
4. 点 "+" → 选 "Apple Development" → Xcode 会自动生成并下载到 Keychain
5. 关闭即可。Provisioning profile 由 Xcode 自动管理（Xcode 15+ 默认开启 "Automatic provisioning"）

> **注意**：免费 Personal Team 的 dev cert 有效期 7 天，过期前 Xcode 会自动续期，**无需手动操作**。但安装到 iPhone 的基座 7 天后会过期（§8.5），届时重新"制作自定义基座 + 重新运行"即可。

#### Phase 2（付费 Apple Developer）

1. 打开 Xcode → Settings → Accounts
2. 左下角 "+" → 添加你的付费 Apple ID
3. 选中刚添加的账号 → 点 "Manage Certificates"
4. 点 "+" → 选 "Apple Development" → Xcode 从 Apple Developer 后台拉取/生成 dev cert
5. 如需手动管理 Profile：登录 https://developer.apple.com → Certificates, Identifiers & Profiles → Profiles → 创建 iOS App Development profile（关联 §4.2 创建的 App ID）
6. 回到 Xcode，profile 会自动同步

### 4.1 创建 App ID + 勾选 HealthKit（仅 Phase 2 必做）

> Phase 1 跳过本节，**不需要**显式 App ID（Xcode 自动用 wildcard）。直接跳到 §4.3。

1. 登录 https://developer.apple.com
2. Certificates, Identifiers & Profiles → Identifiers → "+"
3. 选择 "App IDs" → Continue
4. Description: `SoundCare Dev`
5. Bundle ID: `com.soundcare.app`（显式，不是通配符）
6. Capabilities → 勾选 "HealthKit"
7. Continue → Register

> **重要**：如果用通配符 Bundle ID（`com.soundcare.*`），无法勾选 HealthKit。必须用显式 ID。

### 4.2 在 HBuilderX 制作自定义调试基座（Phase 1 + Phase 2 都必做）

> **2026-06-15 重要**：DCloud 公共签名停用（§3.6），HBuilderX "标准基座" 不可用。**两阶段都必须制作自己的自定义调试基座**。Phase 1 不勾选 HealthKit，Phase 2 勾选 HealthKit。

1. HBuilderX 菜单：运行 → 运行到手机或模拟器 → 制作自定义调试基座
2. 在弹出的"自定义基座"对话框中：
   - 顶部：选择 "iOS"
   - 包名：
     - **Phase 1**：可保留默认的 `io.dcloud.HBuilder`（用 Xcode 自动管理 wildcard profile）
     - **Phase 2**：填 `com.soundcare.app`（与 §4.1 的 Bundle ID 一致）
   - 证书：选择 §4.0.5 导入的证书
     - **Phase 1**：免费 Apple ID 的 "Apple Development"（Personal Team）
     - **Phase 2**：付费 Apple Developer 的 "Apple Development"
   - profile：选择对应的 development profile
     - **Phase 1**：Xcode 自动生成
     - **Phase 2**：§4.0.5 同步下来的 profile
   - 勾选能力：
     - **Phase 1**：**不**勾选 HealthKit（Personal Team 无 HealthKit entitlement）
     - **Phase 2**：勾选 **HealthKit**（必须）
3. 点击 "打包"
4. 等待 2-5 分钟（首次较慢，需要下载 framework）
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

### 6.0 后端依赖一览

> **2026-06-15 重要**：和微信小程序不一样，**native APP 的 HRV 数据流测试不需要后端**。HRV mock 是 `hrv-plugin.js` 内部的纯 JS setInterval，不走网络。所以 Mac 端 Phase 1A 验证可以**完全离线**进行，不用启 Python 后端。

| 流程 / 页面 | 是否需要后端 | 说明 |
|-------------|--------------|------|
| HRV 监测页（hrv-monitor） | **❌ 不需要** | 纯前端 mock，5 秒一帧推送 |
| 设备配对页（device-pair） | **❌ 不需要** | 测试数据流按钮 → 5 秒内本地 mock 事件 |
| 首页（index） | ✅ 需要 | 调 `/music/sessions/{user_id}` 等接口 |
| 生成页（generate） | ✅ 需要 | 调 `/music/generate` |
| AI 生成页（ai-generate） | ✅ 需要 | 调 `/music/llm-optimize` |
| 播放页（player） | ✅ 需要 | 调 `/music/generate` + `/session/.../hrv-update` |
| 个人页（profile） | ✅ 需要 | 调 `/user/{user_id}/stats` 等接口 |

**Mac 端推荐测试策略**：
- **Phase 1A 验证**：**完全不启后端**，只测 HRV 监测页 + 设备配对页的 mock 数据流是否正常
- **Phase 1B 验证**：同上
- **端到端联调**：再启后端（`uvicorn app.main:app --reload --port 8000`），跑完整首页 → 生成 → 播放流程

> **对比微信小程序**：小程序**所有**流程都要后端（没有 native mock 能力），所以小程序测试 = 必启后端。native APP 在这一点上更友好。

### 6.1 模拟器 + 标准基座 + JS Mock（Phase 1A 推荐路径）

> **2026-06-15 路径修正**：DCloud 标准基座在 iOS 模拟器上**仍可用**（§3.6），所以 Phase 1A 验证**零证书、零后端、5 分钟**。

模拟器 + 标准基座的运行时行为：
- `hrv-plugin.js` 调 `uni.requireNativePlugin('SoundCareHRV')` → 标准基座没注册该插件 → `plugin === null`
- `isAvailable()` 走 fallback 分支 → 返回 `{ available: true, mockFallback: true }`（**不**返回 false！）
- hrv-monitor 页 `available` 字段为 `true` → 渲染正常监测卡片（**不**显示"设备不支持"）
- 点击"开始监测" → `startMonitoring()` 走 fallback → 触发 `startJsMock()` → 5 秒一帧 mock 数据
- 曲线、状态、趋势、BPM 建议全部正常更新

**所以 Phase 1A 模拟器验证能跑通的内容**：
- ✅ UI 流程（首页 / 生成 / 播放 / 个人 / 设备配对 / HRV 监测 页跳转）
- ✅ HRV mock 数据流（曲线、状态、趋势）
- ✅ 设备配对页"测试数据流（5 秒）"按钮

**模拟器跑不通**：
- ❌ 真 HealthKit 数据（无硬件）
- ❌ 真传感器（陀螺仪、加速度）
- ❌ 任何依赖 Apple Watch 的功能

### 6.2 真机 + 自定义基座（Phase 1B）

1. Phase 1A 跑通后再做这一步
2. iPhone 连 Mac → 信任设备
3. HBuilderX → 运行 → 运行到 iPhone 真机（**自定义基座**）
4. APP 启动后进入 APP
5. 进入"设备配对"页 → 触发授权（mock 模式不弹系统框）
6. 点击"测试数据流（5 秒）"按钮：
   - 应在 5 秒内显示 "HRV 52.3ms (Mock)" 或 "HR 70 BPM (Mock)"
   - 如果没显示，参考 §8 调试
7. 进入"HRV 监测"页 → 启动 → 看到 Mock 数据流（曲线、状态、趋势、BPM 建议）
8. 停止监测

### 6.3 真机 + 自定义基座 + 真 HealthKit（Phase 2）

1. 佩戴 Apple Watch（确保已与 iPhone 配对）
2. 在 Watch 上打开 "Heart Rate" 应用，让它测一次心率（确保 HealthKit 里有数据）
3. iPhone 打开 SoundCare → 设备配对 → 点 "Apple Watch" → 触发系统授权弹窗
4. 允许授权后，页面应显示 "已连接"
5. 点击 "测试数据流（5 秒）" 按钮：
   - 应在 5 秒内显示 "HRV 52.3ms (Apple Watch)" 或 "HR 68 BPM (Apple Watch)"
   - 如果没显示，参考 §8 调试

### 6.4 手动添加 HealthKit 数据（如果 Apple Watch 没数据）

1. iPhone 打开 Health App
2. 摘要 → 心脏 → 添加数据
3. 选择 "心率" → 手动输入（如 68 BPM）
4. 选择 "心率变异性 (HRV)" → 手动输入（如 50ms）
5. 再回 SoundCare 测试数据流

---

## 7. 验证后端联动

> **2026-06-15 重要**：Phase 1A/1B 的 HRV 数据流测试**不需要**后端（详见 §6.0）。本章只在你需要端到端验证播放页 / 生成页 / 首页 时才需要。

### 7.1 配置 API 地址

1. 编辑 `app/src/config.js`
2. 确认 `API_BASE_URL` 指向后端：
   - Mac 本地后端：`http://localhost:8000`（或 `http://127.0.0.1:8000`）
   - 远程后端：`https://api.collegegenerator.cn/api/v1`
3. 改完重新运行 APP

> **Phase 1A 提示**：如果只想验 HRV mock 数据流，**不需要改 config.js**，保持默认 `http://localhost:8000` 即可（即使后端没启，HRV 流程也不调用）。

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

**答**：Phase 1 直接用，能跑通 UI（**自定义基座** + JS mock）。

免费 Apple ID（Personal Team）下，Xcode 会在本机自签证书，Keychain 标记 untrusted 是正常现象。Apple 政策禁止 Personal Team 使用 HealthKit entitlement，所以**真 HealthKit 数据**不可用——但 v1.1 起 `hrv-plugin.js` 内置 JS mock 兜底，UI 流程完全跑得通。

> **2026-06-15 注意**：DCloud 公共企业签名停用（§3.6），Phase 1 也不再用"标准基座"了，必须用自己的 Apple ID 签的**自定义基座**（**不**勾选 HealthKit）。流程见 §4.0.5 + §4.2。

**解决（Phase 2）**：升级付费开发者账号（$99/年），详见 §4.0。

### Q0.5: HBuilderX 提示"未配置 DCloud 公共证书"或"标准基座不可用"？

**原因**：DCloud 公共企业签名已停用（§3.6）。HBuilderX 的"标准基座"选项不再可用。

**解决**：按 §4.2 自己制作自定义调试基座（用自己的 Apple ID 签）。Phase 1 不勾选 HealthKit，Phase 2 勾选 HealthKit。

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

**功能限制**（Phase 2 自定义基座带 HealthKit 场景）：
- isAvailable: false（模拟器无 HealthKit）
- 授权弹窗：✅ 会出现
- 数据流：❌ 无数据（除非手动添加，参考 6.4）

**建议**：Phase 2 真机验证前，模拟器只用来跑 UI。

> **2026-06-15 好消息（Phase 1A 路径）**：模拟器 + 标准基座 + JS mock **能跑通 HRV 数据流**（`plugin==null` 触发 mock，§6.1），5 分钟跑通全部 UI 流程，**不需要**做自定义基座，**不需要**后端。详见 §10 Phase 1A。

### Q6: iPhone 15 Pro 连 Mac 后，Finder 和 HBuilderX 都看到了，Xcode 的 Devices and Simulators 列表里却没显示？

> **2026-06-15 新增**：常见于 DCloud 公共签名停用之后，Mac 端第一次做自定义基座的场景。

**原因**：Finder 和 HBuilderX 用的是 iPhone 文件传输的"基础信任"（Trust this Mac for files），而 Xcode 需要的是**额外的开发配对信任**（developer pairing）。两个信任机制独立，状态不同步就会出现这个症状。

#### 排查步骤（按顺序试）

1. **开启 iPhone 开发者模式**（最常被忽略）
   - iPhone → 设置 → 隐私与安全性 → **开发者模式** → 打开
   - iPhone 会要求重启，重启后再次解锁确认
   - 不开这个 Xcode 永远不显示设备

2. **检查 iPhone 的"信任此 Mac"弹窗**
   - 连上数据线时，iPhone 应该弹出 "信任此 Mac?" 对话框 → 点"信任" + 输入解锁密码
   - **如果没弹窗**（之前点过"不信任"或超时）：
     - iPhone → 设置 → 通用 → 传输或还原 iPhone → 还原 → **还原位置与隐私**
     - 重新插线，会再次弹"信任"框

3. **重置 Mac 端的设备配对缓存**
   - 退出 Xcode（Cmd+Q 完整退出，不要只是关窗口）
   - 终端执行：
     ```bash
     sudo killall -9 usbmuxd
     # 等待 5 秒，usbmuxd 会自动重启
     ```
   - 重开 Xcode → Window → Devices and Simulators，看设备是否出现

4. **检查 iPhone 的 USB 配件设置**（iOS 16+）
   - iPhone → 设置 → Face ID 与密码 → **USB 配件** → 打开
   - 不开的话锁屏状态 USB 可能被 iOS 安全策略拦截

5. **手动添加设备**（Xcode 没自动发现时）
   - Xcode → Window → Devices and Simulators
   - 左下角 "+" → 选 "Add Device"
   - 如果能在这里选到你的 iPhone 15 Pro → 说明配对通道是通的，只是没自动发现
   - 如果连"+"里都看不到 → 回到步骤 1-3 重置

6. **下载 iOS DeviceSupport**（iOS 版本不匹配时）
   - 现象：Xcode 报错 "Could not find Developer Disk Image"
   - 解决：https://github.com/filsv/iOSDeviceSupport 找对应 iOS 版本的 .zip
   - 解压到 `~/Library/Developer/Xcode/iOS DeviceSupport/`
   - 重启 Xcode

7. **最后一招：换数据线 / 换 USB 口**
   - 偶有 USB 集线器或特定 USB 口供电不稳，导致 usbmuxd 识别失败
   - 优先用 Mac 自带 USB 口 + 苹果原装或 MFi 认证线

**经验**：步骤 1 + 2（开发者模式 + 信任弹窗）能解决 80% 的情况。如果 1-3 都做完还是不显示，附上 `Console.app`（搜索 "usbmuxd" 或 "MobileDevice"）的日志给 Claude Code 排查。

---

## 10. 完整流程 checklist

> **2026-06-15 重要**：DCloud 公共签名停用（§3.6），iPhone 真机路径必须自带 Apple ID 证书 + 自定义基座。**但模拟器路径（Phase 1A）零证书、5 分钟跑通**，可作为第一轮验证。
>
> **后端依赖**：Phase 1A/1B 的 HRV 数据流测试**不需要** Python 后端（§6.0）；播放页 / 生成页 / 首页 / 个人页 才需要。

### Phase 1A（模拟器 + 标准基座 + JS Mock，5 分钟，**不需要后端**）

> **最推荐入口**：零 Apple ID / 零证书 / 零基座 / 零后端，直接用 DCloud 标准基座在 Mac iOS 模拟器上跑。HRV mock 数据流也能跑通（`plugin==null` 触发 JS mock 兜底，§4.0）。

按顺序勾选：

- [ ] Mac 已安装 Xcode 26.3 + HBuilderX 3.95+
- [ ] git clone + npm install 完成
- [ ] HBuilderX 打开 app/ 目录成功（首次遇到 §3.5 的 4 个坑按对应说明修）
- [ ] HBuilderX → 运行 → 运行到 **iOS 模拟器**（**标准基座**直接可选）
- [ ] APP 启动，能进入"首页 / 生成 / 播放 / 个人"（这些页可能因后端未启而部分加载失败，**正常**，本阶段不要求）
- [ ] 进入"设备配对"页 → 触发授权（mock 模式不弹系统框）
- [ ] "测试数据流（5 秒）"按钮能在 5 秒内收到 Mock 事件
- [ ] 进入"HRV 监测"页 → 启动 → 看到 Mock 数据流（曲线、状态、趋势、BPM 建议）
- [ ] 停止监测 → 数据流停止

全部勾完 = v1.1 Phase 1A 验证成功 🎉（**Mac 端零证书零后端工作**）

### Phase 1B（iPhone 真机 + 自定义基座 + JS Mock，30 分钟，**不需要后端**）

> Phase 1A 跑通后再做。多一步基座打包，验证 iPhone 真机 UX。

- [ ] Phase 1A 全部勾完
- [ ] 自己的免费 Apple ID 已登录 Xcode（§4.0.5 Phase 1B 部分）
- [ ] Xcode 已为该 Apple ID 生成 "Apple Development" 证书
- [ ] HBuilderX → 制作自定义调试基座（**不**勾选 HealthKit，§4.2）
- [ ] iPhone 真机已连接并信任
- [ ] HBuilderX → 运行到 iPhone 真机（**自定义基座**）
- [ ] APP 启动，能进入"首页 / 生成 / 播放 / 个人"（同上，后端相关可能失败）
- [ ] 进入"设备配对"页 → 触发授权（mock 模式不弹系统框）
- [ ] "测试数据流（5 秒）"按钮能在 5 秒内收到 Mock 事件
- [ ] 进入"HRV 监测"页 → 启动 → 看到 Mock 数据流
- [ ] 停止监测 → 数据流停止

全部勾完 = v1.1 Phase 1B 验证成功 🎉

### Phase 2（付费 + 自定义基座 + 真 HealthKit，**需要后端**）

> Phase 2 验真 HealthKit + 后端联动。`device_type='apple_watch'` 要上报到后端。

- [ ] 已升级付费 Apple Developer（$99/年）
- [ ] 准备证书（§4.0.5 Phase 2 部分）
- [ ] 创建 App ID 并勾选 HealthKit（§4.1）
- [ ] 制作自定义调试基座（§4.2，勾选 HealthKit）
- [ ] iPhone 真机已连接，自定义基座已安装
- [ ] Apple Watch 已配对 iPhone
- [ ] **启动后端**：`uvicorn app.main:app --reload --port 8000`（§7）
- [ ] config.js `API_BASE_URL` 指向正确后端
- [ ] APP 启动 → "设备配对"页 → 系统弹授权框 → 允许
- [ ] "测试数据流"按钮能在 5 秒内收到 **Apple Watch 真实数据**
- [ ] 进入"HRV 监测"页 → 看到 source='Apple Watch'
- [ ] 后端日志能看到 `POST /api/v1/music/session/.../hrv-update` 含 `device_type='apple_watch'`

全部勾完 = v1.1 Phase 2 验证成功 🎉

### 一句话选阶段

> 第一次跑通 → Phase 1A（模拟器 + 标准基座，5 分钟**零证书零后端**）→ 验真机 → Phase 1B（iPhone + 免费 Apple ID + 自定义基座，**仍不需要后端**）/ 已付费 → Phase 2（完整真 HealthKit + 后端联调）

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
