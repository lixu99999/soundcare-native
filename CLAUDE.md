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
- ✅ v1.1-mock 方案设计（用户已确认沿用 soundcare-app HRV mock 设计）：`docs/v1.1_JS层Mock兜底方案.md`
- ⏸ v1.1-mock 实施：hrv-plugin.js + hrv-monitor + music.js（Windows 端可写，5 个 commit）
- ⏸ **Mac 端待用户执行**：`docs/Mac集成指南.md` Phase 1（mock 验证）+ Phase 2（付费后真 HealthKit）
- ⏸ v1.2：player 接入 startHRVSession（963 行，重构风险高）
- ⏸ v2.0：付费 Apple Developer + 自定义基座 + 真 HealthKit

## 必读

1. `README.md` - 项目介绍、构建命令、与微信小程序的关系
2. `docs/HRV原生插件架构.md` - iOS 插件架构设计（必读）
3. `docs/Mac集成指南.md` - Mac 端集成步骤（Mac Claude Code 必读）
4. `docs/v1.1_JS层Mock兜底方案.md` - v1.1-mock 阶段设计（Mac 评审必读）

## Mac 集成待办

- [ ] HBuilderX 制作自定义调试基座（勾选 HealthKit）
- [ ] 真机运行测试
- [ ] 调试授权 / 数据流

## 仓库

https://github.com/lixu99999/soundcare-native.git

## 协作机制

- Windows 端：写设计、写代码
- Mac 端：编译、调试、测试
- 通过 git + 本文件同步上下文（详见 `../CLAUDE.md`）
