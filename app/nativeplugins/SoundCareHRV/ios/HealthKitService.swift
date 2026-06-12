import Foundation
import HealthKit

// MARK: - HealthKit 业务层
// 封装 HealthKit API，对上层（DCUniModule）屏蔽细节。
// 设计决策：
//   - 仅前台监测（Q2）：不需要 Background Modes 能力
//   - HRV 采样频率 = 系统默认（Q1）：HKObserverQuery 变化即推送
//   - 错误不上抛重试（Q6）：调用方决定重试策略

class HealthKitService {

    enum ServiceError: Error {
        case healthKitUnavailable
        case notAuthorized
        case queryFailed(Error)
        case noDataAvailable
        case monitoringAlreadyStarted
    }

    // 单例 HealthKit store
    private let store = HKHealthStore()

    // 当前活跃的 observers（按类型）
    private var observers: [HKObserverQuery] = []

    // 监测状态
    private(set) var isMonitoring = false

    // Mock 模式
    private var mockTimer: Timer?

    // MARK: - 基础检查

    /// iPad 等无 HealthKit 设备返回 false（Q4 优雅降级）
    func isAvailable() -> Bool {
        return HKHealthStore.isHealthDataAvailable()
    }

    // MARK: - 授权

    /// 请求 HealthKit 授权
    /// - Parameters:
    ///   - readTypes: 要读取的指标集合，支持 "hrv" / "heartRate"
    ///   - completion: 成功返回原始 readTypes；失败返回错误
    func requestAuthorization(
        readTypes: Set<String>,
        completion: @escaping (Result<Set<String>, ServiceError>) -> Void
    ) {
        guard isAvailable() else {
            completion(.failure(.healthKitUnavailable))
            return
        }

        var typesToRequest: Set<HKObjectType> = []
        for type in readTypes {
            if let hkType = mapToHKType(type) {
                typesToRequest.insert(hkType)
            }
        }

        // 注意：HealthKit 的授权请求无 success/failure 区分
        // 用户拒绝后，store.authorizationStatus 仍会返回 .sharingAuthorized
        // 真正的数据权限通过后续 query 是否返回数据来判断
        store.requestAuthorization(toShare: [], read: typesToRequest) { _, error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(.failure(.queryFailed(error)))
                } else {
                    completion(.success(readTypes))
                }
            }
        }
    }

    // MARK: - 监测

    /// 启动监测（真机 HealthKit 模式）
    func startMonitoring(
        types: Set<String>,
        onUpdate: @escaping ([String: Any]) -> Void
    ) {
        if isMonitoring {
            // 已在监测中，先停
            stopMonitoring()
        }

        for type in types {
            guard let sampleType = mapToHKType(type) else { continue }

            // HKObserverQuery：HealthKit 数据变化时触发
            let observer = HKObserverQuery(
                sampleType: sampleType,
                predicate: nil
            ) { [weak self] _, completionHandler, error in
                if error == nil {
                    self?.fetchLatest(
                        type: sampleType,
                        identifier: type,
                        onUpdate: onUpdate
                    )
                }
                // 必须调用 completionHandler 否则系统会停止推送
                completionHandler()
            }
            store.execute(observer)
            observers.append(observer)

            // 启动时立即拉一次（不等数据变化）
            fetchLatest(type: sampleType, identifier: type, onUpdate: onUpdate)
        }

        isMonitoring = true
    }

    /// 启动 Mock 模式（Q3：显式启用）
    func startMockTimer(onUpdate: @escaping ([String: Any]) -> Void) {
        stopMockTimer()

        // 模拟放松状态：HRV 40±10ms, HR 65±5 BPM
        mockTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { _ in
            let mockHRV = 40.0 + Double.random(in: -10...15)
            let mockHR = 65.0 + Double.random(in: -5...10)
            let now = Date().timeIntervalSince1970 * 1000

            onUpdate([
                "type": "hrv",
                "value": mockHRV,
                "timestamp": now,
                "source": "Mock"
            ])
            onUpdate([
                "type": "heartRate",
                "value": mockHR,
                "timestamp": now,
                "source": "Mock"
            ])
        }
    }

    /// 停止所有监测
    func stopMonitoring() {
        for observer in observers {
            store.stop(observer)
        }
        observers.removeAll()
        stopMockTimer()
        isMonitoring = false
    }

    private func stopMockTimer() {
        mockTimer?.invalidate()
        mockTimer = nil
    }

    // MARK: - 单次查询

    /// 拉取指定类型的最新一条数据
    func fetchLatest(
        type: String,
        completion: @escaping (Result<[String: Any], ServiceError>) -> Void
    ) {
        guard let sampleType = mapToHKType(type) else {
            completion(.failure(.noDataAvailable))
            return
        }

        fetchLatest(type: sampleType, identifier: type) { data in
            if data.isEmpty {
                completion(.failure(.noDataAvailable))
            } else {
                completion(.success(data))
            }
        }
    }

    // MARK: - 私有方法

    /// 将 JS 端传入的字符串标识符映射到 HealthKit 类型
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
            guard self != nil,
                  let sample = samples?.first as? HKQuantitySample else {
                onUpdate([:])
                return
            }

            // 单位：心率用 次/分钟，HRV 用 毫秒
            let unit: HKUnit = (identifier == "heartRate")
                ? HKUnit.count().unitDivided(by: .minute())
                : HKUnit.secondUnit(with: .milli)

            let payload: [String: Any] = [
                "type": identifier,
                "value": sample.quantity.doubleValue(for: unit),
                "timestamp": sample.startDate.timeIntervalSince1970 * 1000,
                "source": sample.sourceRevision.source.name
            ]

            // HealthKit 回调在 background queue，切回 main
            DispatchQueue.main.async {
                onUpdate(payload)
            }
        }
        store.execute(query)
    }

    deinit {
        stopMonitoring()
    }
}
