import Foundation
import DCUniPlugin

// MARK: - SoundCare HRV 插件入口
// 继承自 DCUniModule，对外暴露 6 个 JS 可调用方法。
// JS 调用：`uni.requireNativePlugin('SoundCareHRV')`

@objc(SoundCareHRVModule)
class SoundCareHRVModule: DCUniModule {

    // 业务层（HealthKit 封装）
    private let service = HealthKitService()

    // 监测状态（防止重复启动）
    private var monitoringActive = false

    // 事件流：监测启动时拿到的 callback，需要 keepCallback=true
    // 以便后续 HKObserverQuery 触发时复用同一个 JS callback
    private var streamingCallback: DCUniCallback?

    // MARK: - 1. 检查设备是否支持 HealthKit

    @objc func isAvailable(_ options: Any, callback: @escaping DCUniCallback) {
        callback([
            "available": service.isAvailable()
        ], false, nil)
    }

    // MARK: - 2. 请求 HealthKit 授权

    @objc func requestAuthorization(_ options: Any, callback: @escaping DCUniCallback) {
        guard let params = options as? [String: Any],
              let readTypes = params["readTypes"] as? [String] else {
            callback([
                "success": false,
                "errorCode": "INVALID_PARAMS",
                "error": "readTypes 必须是字符串数组"
            ], false, nil)
            return
        }

        service.requestAuthorization(readTypes: Set(readTypes)) { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let granted):
                callback([
                    "success": true,
                    "grantedTypes": Array(granted)
                ], false, nil)
            case .failure(.healthKitUnavailable):
                callback([
                    "success": false,
                    "errorCode": "HEALTHKIT_UNAVAILABLE",
                    "error": "当前设备不支持 HealthKit（iPad 或模拟器）"
                ], false, nil)
            case .failure(.queryFailed(let err)):
                callback([
                    "success": false,
                    "errorCode": "QUERY_FAILED",
                    "error": err.localizedDescription
                ], false, nil)
            case .failure:
                callback([
                    "success": false,
                    "errorCode": "AUTH_FAILED"
                ], false, nil)
            }
        }
    }

    // MARK: - 3. 启动实时监测

    @objc func startMonitoring(_ options: Any, callback: @escaping DCUniCallback) {
        guard let params = options as? [String: Any],
              let types = params["types"] as? [String] else {
            callback([
                "success": false,
                "errorCode": "INVALID_PARAMS",
                "error": "types 必须是字符串数组"
            ], false, nil)
            return
        }

        // Q3：mockMode 默认 false（生产安全）
        let mockMode = params["mockMode"] as? Bool ?? false

        // 如果已在监测，先停
        if monitoringActive {
            service.stopMonitoring()
            monitoringActive = false
            streamingCallback = nil
        }

        // 保存 callback 用于后续事件推送
        streamingCallback = callback

        if mockMode {
            // Mock 模式
            service.startMockTimer { [weak self] event in
                self?.sendEventToJS(event)
            }
        } else {
            // 真机 HealthKit 模式
            service.startMonitoring(types: Set(types)) { [weak self] event in
                self?.sendEventToJS(event)
            }
        }

        monitoringActive = true

        // 关键：keepCallback = true
        // 后续 HKObserverQuery 触发的 event 会通过 sendEventToJS
        // 复用同一个 callback 推送给 JS
        callback([
            "success": true,
            "monitoring": true,
            "mockMode": mockMode
        ], true, nil)
    }

    // MARK: - 4. 停止监测

    @objc func stopMonitoring(_ options: Any, callback: @escaping DCUniCallback) {
        service.stopMonitoring()
        monitoringActive = false
        streamingCallback = nil

        callback([
            "success": true,
            "monitoring": false
        ], false, nil)
    }

    // MARK: - 5. 拉取最近一次数据（一次性）

    @objc func getLatest(_ options: Any, callback: @escaping DCUniCallback) {
        guard let params = options as? [String: Any],
              let type = params["type"] as? String else {
            callback([
                "success": false,
                "errorCode": "INVALID_PARAMS",
                "error": "type 必须是字符串"
            ], false, nil)
            return
        }

        service.fetchLatest(type: type) { [weak self] result in
            guard self != nil else { return }
            switch result {
            case .success(let data):
                callback([
                    "success": true,
                    "value": data["value"] ?? 0,
                    "timestamp": data["timestamp"] ?? 0,
                    "source": data["source"] ?? ""
                ], false, nil)
            case .failure(.noDataAvailable):
                callback([
                    "success": false,
                    "errorCode": "NO_DATA_AVAILABLE",
                    "error": "HealthKit 中暂无该类型数据"
                ], false, nil)
            case .failure(.healthKitUnavailable):
                callback([
                    "success": false,
                    "errorCode": "HEALTHKIT_UNAVAILABLE"
                ], false, nil)
            case .failure:
                callback([
                    "success": false,
                    "errorCode": "QUERY_FAILED"
                ], false, nil)
            }
        }
    }

    // MARK: - 6. 设置 Mock 模式（开发用）

    /// 此方法仅作为运行时切换 mock 的入口。
    /// 实际启用 mock 必须在 startMonitoring 时传 mockMode: true。
    @objc func setMockMode(_ options: Any, callback: @escaping DCUniCallback) {
        guard let params = options as? [String: Any],
              let enabled = params["enabled"] as? Bool else {
            callback([
                "success": false,
                "errorCode": "INVALID_PARAMS"
            ], false, nil)
            return
        }

        // 当前实现：仅记录状态，真正启用通过 startMonitoring({mockMode: true})
        // 后续 v2 可在 service 里加 runtime 切换
        callback([
            "success": true,
            "mockEnabled": enabled,
            "note": "请在 startMonitoring 时传 mockMode: true 真正生效"
        ], false, nil)
    }

    // MARK: - 事件推送

    /// 把 HealthKit / Mock 事件推送给 JS。
    /// 依赖 streamingCallback 在 startMonitoring 时以 keepCallback=true 注册。
    private func sendEventToJS(_ event: [String: Any]) {
        guard let cb = streamingCallback else {
            return
        }
        // DCUniModule 的 executor 推送事件到 JS
        // 如果 API 名字不匹配，Mac 端集成时调整此行为
        // - 方案 A（默认）：self.uniModule.executor.executeUniCallback(event: event)
        // - 方案 B（备选）：self.executeUniCallback(event: event, keepAlive: true)
        // - 方案 C（备选）：self.invoke(methodName: "onHRVUpdate", params: event)
        uniModule.executor.executeUniCallback(event: event)
    }

    deinit {
        service.stopMonitoring()
        streamingCallback = nil
    }
}
