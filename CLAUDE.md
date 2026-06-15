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
- ⏸ **Mac 端待用户执行**：Phase 1（标准基座 + mock 验证）或 Phase 2（付费 + 真 HealthKit）
- ⏸ v1.2：player 接入 startHRVSession（963 行，重构风险高）
- ⏸ v2.0：付费 Apple Developer + 自定义基座 + 真 HealthKit（可选升级）

## 必读

1. `README.md` - 项目介绍、构建命令、与微信小程序的关系
2. `docs/HRV原生插件架构.md` - iOS 插件架构设计（必读）
3. `docs/Mac集成指南.md` - Mac 端集成步骤（Mac Claude Code 必读）
4. `docs/v1.1_JS层Mock兜底方案.md` - v1.1-mock 阶段设计（Mac 评审必读）

## Mac 集成待办

### Phase 1（推荐入口，免费）

- [ ] HBuilderX 打开 app/ 项目
- [ ] 用自己的免费 Apple ID 登录 Xcode
- [ ] iPhone 连 Mac → 信任设备
- [ ] HBuilderX → 运行 → 运行到 iPhone 真机（**标准基座**）
- [ ] 验证首页 / 生成 / 播放 / 个人页
- [ ] 进入"设备配对" → 测试数据流（5 秒内应看到 Mock 事件）
- [ ] 进入"HRV 监测" → 启动 → 看到 Mock 数据流
- [ ] 停止监测

### Phase 2（付费后升级）

- [ ] Apple Developer 付费账号激活
- [ ] HBuilderX 制作自定义调试基座（勾选 HealthKit）
- [ ] 真机运行 + Apple Watch 配对
- [ ] 调试真实 HealthKit 数据流
- [ ] 验证后端收到 `device_type='apple_watch'`

## 仓库

https://github.com/lixu99999/soundcare-native.git

## 协作机制

- Windows 端：写设计、写代码
- Mac 端：编译、调试、测试
- 通过 git + 本文件同步上下文（详见 `../CLAUDE.md`）
