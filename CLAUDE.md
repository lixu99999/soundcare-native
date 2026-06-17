# SoundCare Native APP (Claude Code 上下文)

## 当前聚焦

iOS HRV 原生插件开发。

## 当前进度

- ✅ 架构设计：`docs/HRV原生插件架构.md`
- ✅ 设计 review：6 个设计决策已确认（2026-06-11）
- ✅ Swift 插件代码（commit `553f35a`，5 文件 520 行）
- ✅ JS 封装层（commit `ad0a353`，hrv-plugin.js + music.js startHRVSession）
- ✅ 接入层（commit `3128f44`，manifest.json + device-pair + Mac集成指南.md）
- ✅ hrv-monitor 接入 hrv-plugin（commit `24f6be1`，替换空 stub）
- ✅ v1.1-mock 方案设计 + 实施（5 个 commit）：`docs/v1.1_JS层Mock兜底方案.md`
  - `eee1eba` hrv-plugin.js JS 层 mock 兜底（30 秒 RMSSD 窗口 + 5 级状态）
  - `3e35de1` hrv-monitor 5 级状态 + 初始值对齐
  - `30c787a` music.js startHRVSession 按数据源分支 device_type
  - `9daa822` Mac集成指南 §4.0 拆为 Phase 1（免费+mock）+ Phase 2（付费+HealthKit）
- ✅ 2026-06-15 Windows 端 H5 调试（Mac 不在身边时本地验流程）：
  - HBuilderX 3.95+ alpha 4 个已知问题修复（manifest.json vueVersion / index.html 入口 / tabBar 字体 / 标题栏颜色）
  - HRV mock 算法修正（移除 feedback loop，5 秒节拍）
  - hrv-monitor 页面 UI 对齐小程序播放器（虚线参考线 20/50/80/100ms、坐标轴翻转、状态/趋势副文本更小、紫色卡片 + 橙色边框）
  - **DCloud 公共企业签名停用**：Mac 集成指南 §3.6 新增。Phase 1 拆分为 1A（模拟器+标准基座，零证书 5 分钟）+ 1B（iPhone+自定义基座，免费 Apple ID 30 分钟）；§4.0 + §10 同步更新
  - **HRV mock 测试不需要后端**：Mac 集成指南 §6.0 新增。和小程序不一样，hrv-monitor / device-pair 完全本地（`plugin==null` 触发 `startJsMock`），Phase 1A/1B 零 Python 后端跑通；§7 + §10 同步标注
  - **Xcode 设备列表看不到 iPhone 15 Pro**：Mac 集成指南 §9 Q6 新增。Finder/HBuilderX 用文件传输信任，Xcode 需额外开发者配对信任（独立机制）。7 步排查（开发者模式 / 信任弹窗 / usbmuxd 重启 / USB 配件 / 手动添加 / DeviceSupport / 换线）
  - **Q6 step 1 重写：iOS 开发者模式开关默认隐藏**（2026-06-15）：必须先让 Xcode 主动握手（`xcrun devicectl enable-developer-mode` 或 Devices 窗口），开关才出现；附 iOS 26 备用路径（设置搜索 / 关于本机彩蛋 / Apps → 开发者）
  - **Q7 新增：模拟器添加设备型号**（2026-06-15）：HBuilderX 用的就是 Xcode Simulator.app（不是独立程序）；GUI 添加步骤 + `xcrun simctl list devicetypes/runtimes` 查询；型号不在列表里 = 升级 Xcode
  - **Phase 0 新增：H5 模拟预验证**（2026-06-15）：HBuilderX H5 模拟 + 本地后端实测可生成 LLM 提示词 + 播放音频（效果和微信小程序一样），iOS 模拟器大概率也通。§4.0 决策表 + §10 checklist 同步加入 Phase 0
  - **Q8 新增：HBuilderX 编译产物位置**（2026-06-15）：HBuilderX GUI 输出在 `app/unpackage/`（H5 / app-plus / IPA），CLI (`npm run dev`) 输出在 `app/dist/`；自定义基座 .ipa 在 HBuilderX 插件目录（控制台打印或 `find ~/HBuilderX -name "*SoundCare*.ipa"`）
  - **Q8 修正 + Q9 新增**（2026-06-16）：Q8 写 `app/unpackage/` 是错的 — 3.95+ alpha + Vite GUI 编译产物不在项目目录。Q9 新增：iOS 模拟器白屏 = manifest.json 声明的 SoundCareHRV 原生插件标准基座没带，HBuilderX 严格校验失败。Q6 的 `xcrun devicectl enable-developer-mode` 移除（Xcode 26.3 不支持，需 Xcode 27+）
  - **Q9 落地 + Phase 1A manifest.json 修复**（2026-06-16）：JSON 不支持 `//` 注释，正确做法是 `app/src/manifest.json` 把 `nativePlugins` 清成 `{}`（已 commit `5d2d97b`），有 SoundCareHRV 声明的版本备份成 `app/src/manifest.json.phase1b`，Mac 端 `git pull` 后用 `cp manifest.json.phase1b manifest.json` 切换 Phase 1B/2
  - **pages.json 修复**（2026-06-16）：缺 `"vueVersion": "3"`（manifest 有但 pages 没有，编译器走 Vue 2 路径，`createSSRApp` 不识别 → 白屏）；`tabBar.fontSize/iconWidth` 是字符串带 "px"（应该是数字）。修复后 Phase 1A 应该跑通
  - **manifest.json 进一步修复**（2026-06-16）：1) `splashscreen.alwaysShowBeforeRender: true` → false（如果 Vue 挂载失败启动图永远不关，伪装成白屏）2) `nvueStyleCompiler: "uni-app"` → "vue3"（Vue 3 下应该是 vue3，不是 uni-app）
  - **CORS 白屏根因 + 修复**（2026-06-16，commit `64fbb2f`）：Safari Console 抓到真凶 — `Origin null is not allowed by Access-Control-Allow-Origin`。HBuilderX 标准基座用 file:// 加载 Vite build 产物，Vite 默认 `<script type="module" crossorigin>` 触发 CORS 预检，file:// origin 是 null → JS/CSS 全部拒绝加载 → 白屏。修复：vite.config.js 加 transformIndexHtml 插件，build 输出（识别 crossorigin）自动去除 script 的 type="module" 和 link 的 crossorigin，让 WKWebView 按 classic 资源加载。dev server 不受影响
  - **Mac集成指南 Q10 记录 CORS 死锁**（2026-06-16，commit `886a765`）：Q9 是 manifest 声明导致 base 不启动；Q10 是 base 启动了但 file:// CORS 让 JS 跑不起来。两个白屏看起来一样，要靠 Safari Console 区分
  - **HBuilderX "已存在同名项目" 状态恢复**（2026-06-16）：视图 → 显示项目管理器 → 关闭原项目。比 rm ~/Library 各种路径都直接（已记 memory）
  - **Q11 重大根因 + Phase 1A 重写**（2026-06-17）：OpenClaw 思路对，精确化后确认 — HBuilderX 5.07 标准 iOS 基座 = **5+Runtime**（WKWebView + JS 桥），不是纯 Weex。WKWebView 本身支持 Vue 3，但 5+Runtime 的 JS 桥接层假设 Vue 2 风格 `new Vue()`，Vue 3 的 `createSSRApp` 静默失败 → 白屏。`weex-vue-render` 仓库 `vue: "^2.5.16"` 硬编码 + 最后 push 2022-03-02 + Apache Weex 2020 退役，4 年没维护。结论：Vue 3 + 标准基座 = 架构级别不兼容，**Phase 1A 必须改成"模拟器 + 自定义基座"**（30-60 分钟，绕开 5+Runtime）。原"5 分钟标准基座"流程作废。证据：Mac 端 main.js console.log 能输出 + alert 能弹 + onLaunch 不触发 + Vue 组件不渲染 + Safari Inspector 显示 "weex context"
- ⏸ **Mac 端待用户执行**：Phase 0（H5 验证，5 分钟）→ Phase 1A（**自定义基座 + 模拟器**，30-60 分钟）→ Phase 1B（iPhone + 同一个自定义基座）→ Phase 2（付费 + 自定义基座 + 真 HealthKit + 后端）
- ⏸ v1.2：player 接入 startHRVSession（963 行，重构风险高）
- ⏸ v2.0：付费 Apple Developer + 自定义基座 + 真 HealthKit（可选升级）

## 必读

1. `README.md` - 项目介绍、构建命令、与微信小程序的关系
2. `docs/HRV原生插件架构.md` - iOS 插件架构设计（必读）
3. `docs/Mac集成指南.md` - Mac 端集成步骤（Mac Claude Code 必读）
4. `docs/v1.1_JS层Mock兜底方案.md` - v1.1-mock 阶段设计（Mac 评审必读）

## Mac 集成待办

### Phase 0（H5 模拟预验证，需后端 5 分钟）

- [ ] 启后端：`uvicorn app.main:app --reload --port 8000`
- [ ] HBuilderX → 运行 → 运行到 **浏览器**（H5）
- [ ] 首页 / 生成 / 播放 / 个人 / AI 生成页全跑通
- [ ] LLM 提示词生成 + 音频播放效果对得上小程序

### Phase 1A（最推荐入口，零证书 5 分钟）

- [ ] HBuilderX 打开 app/ 项目
- [ ] HBuilderX → 运行 → 运行到 iOS 模拟器（**标准基座**直接可选）
- [ ] 验证首页 / 生成 / 播放 / 个人页
- [ ] 进入"设备配对" → 测试数据流（5 秒内应看到 Mock 事件）
- [ ] 进入"HRV 监测" → 启动 → 看到 Mock 数据流
- [ ] 停止监测

### Phase 1B（iPhone 真机 UX，免费 30 分钟）

- [ ] Phase 1A 全部勾完
- [ ] 用自己的免费 Apple ID 登录 Xcode（§4.0.5）
- [ ] Xcode 自动生成 Personal Team "Apple Development" 证书
- [ ] HBuilderX → 制作自定义调试基座（**不**勾选 HealthKit，§4.2）
- [ ] iPhone 连 Mac → 信任设备
- [ ] HBuilderX → 运行 → 运行到 iPhone 真机（**自定义基座**）
- [ ] 验证首页 / 生成 / 播放 / 个人页
- [ ] 进入"设备配对" → 测试数据流（5 秒内应看到 Mock 事件）
- [ ] 进入"HRV 监测" → 启动 → 看到 Mock 数据流
- [ ] 停止监测

### Phase 2（付费后升级）

- [ ] Apple Developer 付费账号激活
- [ ] §4.0.5 准备付费 Apple ID 证书
- [ ] §4.1 创建 App ID（com.soundcare.app）+ 勾选 HealthKit
- [ ] §4.2 HBuilderX 制作自定义调试基座（**勾选 HealthKit**）
- [ ] 真机运行 + Apple Watch 配对
- [ ] 调试真实 HealthKit 数据流
- [ ] 验证后端收到 `device_type='apple_watch'`

## 仓库

https://github.com/lixu99999/soundcare-native.git

## 协作机制

- Windows 端：写设计、写代码
- Mac 端：编译、调试、测试
- 通过 git + 本文件同步上下文（详见 `../CLAUDE.md`）
