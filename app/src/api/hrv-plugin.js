/**
 * SoundCare HRV 原生插件 JS 封装层
 *
 * 平台：iOS 原生 APP（小程序端此模块仍可加载，但所有函数返回 PLUGIN_NOT_LOADED 错误）
 * 原生插件定义：app/nativeplugins/SoundCareHRV/
 *
 * 模式：
 *   - 一次性调用（isAvailable / requestAuthorization / getLatest）→ 返回 Promise
 *   - 事件流（startMonitoring）→ 内部用 callback，外部用 onUpdate 订阅
 *
 * 错误码：
 *   PLUGIN_NOT_LOADED         - 插件未注册（小程序端 / 未配置 nativePlugins）
 *   HEALTHKIT_UNAVAILABLE     - 当前设备不支持 HealthKit（iPad / 模拟器）
 *   NOT_AUTHORIZED            - 用户拒绝授权
 *   INVALID_PARAMS            - JS 参数错误
 *   QUERY_FAILED              - HealthKit 查询失败
 *   MONITORING_ALREADY_STARTED - 重复调用 startMonitoring
 *   NO_DATA_AVAILABLE         - 已授权但 HealthKit 无数据
 *   WATCH_NOT_PAIRED          - 检测到 iPhone 但无 Apple Watch
 */

// 错误码常量
export const HRV_ERROR = {
  PLUGIN_NOT_LOADED: 'PLUGIN_NOT_LOADED',
  HEALTHKIT_UNAVAILABLE: 'HEALTHKIT_UNAVAILABLE',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  INVALID_PARAMS: 'INVALID_PARAMS',
  QUERY_FAILED: 'QUERY_FAILED',
  MONITORING_ALREADY_STARTED: 'MONITORING_ALREADY_STARTED',
  NO_DATA_AVAILABLE: 'NO_DATA_AVAILABLE',
  WATCH_NOT_PAIRED: 'WATCH_NOT_PAIRED'
}

// Mock 模式标识常量（暴露给业务层判断数据来源）
export const HRV_SOURCE = {
  APPLE_WATCH: 'Apple Watch',
  MOCK: 'Mock'
}

// 支持的数据类型
export const HRV_TYPE = {
  HRV: 'hrv',
  HEART_RATE: 'heartRate'
}

// ============ 模块状态（单例）============

let plugin = null
let initialized = false
let isAvailableFlag = false
let mockModeActive = false
let monitoringActive = false
let mockFallbackActive = false  // 标准基座下启用 JS 层 mock

// JS mock 定时器
let jsMockTimer = null

// 事件订阅者
const subscribers = new Set()

// 最新数据缓存
const latestCache = {
  hrv: null,
  heartRate: null
}

// ============ 内部函数 ============

/**
 * 懒加载 native plugin 引用
 * 小程序端或未配置插件时，plugin 保持 null（graceful degradation）
 */
function init() {
  if (initialized) return
  initialized = true
  try {
    if (typeof uni !== 'undefined' && typeof uni.requireNativePlugin === 'function') {
      plugin = uni.requireNativePlugin('SoundCareHRV')
      if (!plugin) {
        // requireNativePlugin 返回 null（插件未在 manifest.json 声明）
        plugin = null
      }
    }
  } catch (e) {
    plugin = null
  }
}

/**
 * 用 Promise 包装原生插件的一次性调用
 */
function call(method, params) {
  return new Promise((resolve, reject) => {
    init()
    if (!plugin) {
      reject({ success: false, errorCode: HRV_ERROR.PLUGIN_NOT_LOADED })
      return
    }
    plugin[method](params, (res) => {
      if (res && res.errorCode) {
        reject(res)
      } else {
        resolve(res || {})
      }
    })
  })
}

/**
 * 处理原生推送的事件：更新缓存 + 通知订阅者
 */
function handleNativeEvent(event) {
  if (!event) return

  if (event.type === HRV_TYPE.HRV || event.type === HRV_TYPE.HEART_RATE) {
    latestCache[event.type] = {
      value: event.value,
      timestamp: event.timestamp,
      source: event.source
    }
  }

  subscribers.forEach((cb) => {
    try {
      cb(event)
    } catch (e) {
      console.error('[hrv-plugin] subscriber error:', e)
    }
  })
}

// ============ JS 层 Mock 兜底（标准基座 / 免费 Apple ID）============
//
// 触发条件：uni.requireNativePlugin('SoundCareHRV') 返回 null
// 行为：setInterval 每 1 秒生成假 HRV/HR 事件，事件通过同一个 handleNativeEvent 路径
//
// 算法思路借鉴 soundcare-app 的 HRVCalculator（30 秒滚动窗口 + RMSSD）：
//   - 心率 60-80 BPM 随机漂移
//   - 每秒生成 1 个 RRI（ms）写入滚动窗口
//   - 窗口内 RMSSD 计算 = sqrt(mean(diff²))
//   - 初始目标 HRV = 40ms（对齐小程序初始值）
//
// 与真 HealthKit 的区别：
//   - event.source = 'Mock'（业务层据此决定后端 device_type）
//   - 没有真实生理约束，仅作为 UI 流程演示

const MOCK_INITIAL_HR = 70        // 初始心率（BPM）
const MOCK_INITIAL_HRV = 40       // 初始 HRV（ms，对齐小程序）
const MOCK_HR_MIN = 60
const MOCK_HR_MAX = 80
const MOCK_WINDOW_MS = 30 * 1000  // 30 秒滚动窗口（与小程序一致）
const MOCK_INTERVAL_MS = 5000     // 事件频率 5 秒（与原生 HealthKit Observer 推送节奏一致）

function startJsMock(types) {
  if (jsMockTimer) return  // 防重入

  // 滚动窗口内的 RRI 样本
  const rriBuffer = []
  let baseHR = MOCK_INITIAL_HR

  jsMockTimer = setInterval(() => {
    const now = Date.now()

    // 1. 心率随机漂移（限制 60-80）
    baseHR += (Math.random() - 0.5) * 2
    baseHR = Math.max(MOCK_HR_MIN, Math.min(MOCK_HR_MAX, baseHR))
    const hr = Math.round(baseHR)

    // 2. 模拟一个 RRI 写入窗口
    //    variation 必须独立于计算出的 RMSSD，否则会形成 feedback loop
    //    让 HRV 一路漂向 0。固定 variation=100 → 期望 RMSSD ≈ 40ms（正常放松）
    const interval = 60000 / hr
    const variation = 100
    const rri = interval + (Math.random() - 0.5) * variation
    rriBuffer.push({ value: rri, timestamp: now })
    // 清理窗口外
    while (rriBuffer.length && rriBuffer[0].timestamp < now - MOCK_WINDOW_MS) {
      rriBuffer.shift()
    }

    // 3. 算 RMSSD（直接基于 RRI 差分，不做 smoothing/feedback）
    let rmssd = MOCK_INITIAL_HRV
    if (rriBuffer.length >= 2) {
      let sumSq = 0
      for (let i = 0; i < rriBuffer.length - 1; i++) {
        const diff = rriBuffer[i + 1].value - rriBuffer[i].value
        sumSq += diff * diff
      }
      rmssd = Math.sqrt(sumSq / (rriBuffer.length - 1))
    }

    // 4. 推事件（与原生事件同格式）
    if (types.includes(HRV_TYPE.HEART_RATE)) {
      handleNativeEvent({
        type: HRV_TYPE.HEART_RATE,
        value: hr,
        timestamp: now,
        source: HRV_SOURCE.MOCK
      })
    }
    if (types.includes(HRV_TYPE.HRV)) {
      handleNativeEvent({
        type: HRV_TYPE.HRV,
        value: Math.max(0, Math.round(rmssd)),
        timestamp: now,
        source: HRV_SOURCE.MOCK
      })
    }
  }, MOCK_INTERVAL_MS)
}

function stopJsMock() {
  if (jsMockTimer) {
    clearInterval(jsMockTimer)
    jsMockTimer = null
  }
}

// ============ 公开 API ============

/**
 * 检查设备是否支持 HealthKit
 * iPad / 模拟器 / 小程序端返回 { available: false }
 * 标准基座（plugin==null）但启用 mock 兜底时返回 { available: true, mockFallback: true }
 * @returns {Promise<{ available: boolean, mockFallback?: boolean }>}
 */
function isAvailable() {
  return new Promise((resolve) => {
    init()
    if (!plugin) {
      // 标准基座下走 JS mock，视为"可用"
      resolve({ available: true, mockFallback: true })
      return
    }
    plugin.isAvailable({}, (res) => {
      isAvailableFlag = !!(res && res.available)
      resolve({ available: isAvailableFlag })
    })
  })
}

/**
 * 请求 HealthKit 授权
 * mock 兜底模式下无系统弹窗，直接返回 success
 * @param {string[]} readTypes - 要读取的指标，默认 ['hrv', 'heartRate']
 * @returns {Promise<{ success: boolean, grantedTypes?: string[], mockFallback?: boolean, errorCode?: string }>}
 */
function requestAuthorization(readTypes = [HRV_TYPE.HRV, HRV_TYPE.HEART_RATE]) {
  init()
  if (!plugin) {
    return Promise.resolve({ success: true, grantedTypes: readTypes, mockFallback: true })
  }
  return call('requestAuthorization', { readTypes })
}

/**
 * 启动实时监测（事件流）
 * 标准基座（plugin==null）下自动启用 JS 层 mock
 * @param {Object} options
 * @param {string[]} [options.types] - 要监测的指标，默认 ['hrv', 'heartRate']
 * @param {boolean} [options.mockMode] - 是否使用 Mock 数据（开发用）
 * @returns {{ success: boolean, monitoring?: boolean, mockMode?: boolean, mockFallback?: boolean, errorCode?: string }}
 */
function startMonitoring(options = {}) {
  init()

  if (monitoringActive) {
    return { success: false, errorCode: HRV_ERROR.MONITORING_ALREADY_STARTED }
  }

  const {
    types = [HRV_TYPE.HRV, HRV_TYPE.HEART_RATE],
    mockMode = false
  } = options

  if (!plugin) {
    // ✨ JS 层 mock 兜底
    startJsMock(types)
    monitoringActive = true
    mockModeActive = true
    mockFallbackActive = true
    return { success: true, monitoring: true, mockMode: true, mockFallback: true }
  }

  mockModeActive = mockMode

  // 启动后，原生层会持续通过 callback 推送事件
  plugin.startMonitoring({ types, mockMode }, handleNativeEvent)
  monitoringActive = true

  return { success: true, monitoring: true, mockMode }
}

/**
 * 停止监测
 * mock 兜底模式下清理 JS setInterval
 * @returns {{ success: boolean, monitoring: boolean, errorCode?: string }}
 */
function stopMonitoring() {
  if (!plugin) {
    stopJsMock()
    monitoringActive = false
    mockModeActive = false
    mockFallbackActive = false
    return { success: true, monitoring: false }
  }
  plugin.stopMonitoring({}, (res) => {
    monitoringActive = false
    mockModeActive = false
  })
  return { success: true, monitoring: false }
}

/**
 * 拉取指定类型的最新一条数据（一次性，不启动监测）
 * @param {string} type - 'hrv' | 'heartRate'
 * @returns {Promise<{ success: boolean, value?: number, timestamp?: number, source?: string, errorCode?: string }>}
 */
function getLatest(type) {
  return call('getLatest', { type })
}

/**
 * 订阅 HRV 事件流
 * @param {Function} callback - (event) => void，event 包含 type/value/timestamp/source
 * @returns {Function} unsubscribe 函数
 */
function onUpdate(callback) {
  if (typeof callback !== 'function') {
    throw new Error('[hrv-plugin] callback must be a function')
  }
  subscribers.add(callback)
  return () => subscribers.delete(callback)
}

/**
 * 获取缓存的最新数据（同步，无原生调用）
 * @param {string} type - 'hrv' | 'heartRate'
 * @returns {{ value, timestamp, source } | null}
 */
function getLatestCached(type) {
  return latestCache[type] || null
}

/**
 * 是否处于 Mock 模式
 * @returns {boolean}
 */
function isMockMode() {
  return mockModeActive
}

/**
 * 是否正在监测
 * @returns {boolean}
 */
function isMonitoring() {
  return monitoringActive
}

/**
 * 是否处于 Mock 兜底模式（标准基座 / 免费 Apple ID）
 * 业务层据此决定后端 device_type（'simulated' vs 'apple_watch'）
 * @returns {boolean}
 */
function isMockFallback() {
  return mockFallbackActive
}

/**
 * 重置所有状态（用于测试或切账号）
 */
function reset() {
  if (jsMockTimer) {
    stopJsMock()
  }
  if (monitoringActive && plugin) {
    plugin.stopMonitoring({}, () => {})
  }
  subscribers.clear()
  latestCache.hrv = null
  latestCache.heartRate = null
  monitoringActive = false
  mockModeActive = false
  mockFallbackActive = false
  isAvailableFlag = false
  initialized = false
  plugin = null
}

// 命名导出 + 默认导出
export {
  isAvailable,
  requestAuthorization,
  startMonitoring,
  stopMonitoring,
  getLatest,
  onUpdate,
  getLatestCached,
  isMockMode,
  isMockFallback,
  isMonitoring,
  reset
}

export default {
  isAvailable,
  requestAuthorization,
  startMonitoring,
  stopMonitoring,
  getLatest,
  onUpdate,
  getLatestCached,
  isMockMode,
  isMockFallback,
  isMonitoring,
  reset
}
