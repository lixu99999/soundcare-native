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

// ============ 公开 API ============

/**
 * 检查设备是否支持 HealthKit
 * iPad / 模拟器 / 小程序端返回 { available: false }
 * @returns {Promise<{ available: boolean }>}
 */
function isAvailable() {
  return new Promise((resolve) => {
    init()
    if (!plugin) {
      resolve({ available: false })
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
 * @param {string[]} readTypes - 要读取的指标，默认 ['hrv', 'heartRate']
 * @returns {Promise<{ success: boolean, grantedTypes?: string[], errorCode?: string }>}
 */
function requestAuthorization(readTypes = [HRV_TYPE.HRV, HRV_TYPE.HEART_RATE]) {
  return call('requestAuthorization', { readTypes })
}

/**
 * 启动实时监测（事件流）
 * @param {Object} options
 * @param {string[]} [options.types] - 要监测的指标，默认 ['hrv', 'heartRate']
 * @param {boolean} [options.mockMode] - 是否使用 Mock 数据（开发用）
 * @returns {{ success: boolean, monitoring?: boolean, mockMode?: boolean, errorCode?: string }}
 */
function startMonitoring(options = {}) {
  init()

  if (monitoringActive) {
    return { success: false, errorCode: HRV_ERROR.MONITORING_ALREADY_STARTED }
  }

  if (!plugin) {
    return { success: false, errorCode: HRV_ERROR.PLUGIN_NOT_LOADED }
  }

  const {
    types = [HRV_TYPE.HRV, HRV_TYPE.HEART_RATE],
    mockMode = false
  } = options

  mockModeActive = mockMode

  // 启动后，原生层会持续通过 callback 推送事件
  plugin.startMonitoring({ types, mockMode }, handleNativeEvent)
  monitoringActive = true

  return { success: true, monitoring: true, mockMode }
}

/**
 * 停止监测
 * @returns {{ success: boolean, monitoring: boolean, errorCode?: string }}
 */
function stopMonitoring() {
  if (!plugin) {
    return { success: false, errorCode: HRV_ERROR.PLUGIN_NOT_LOADED, monitoring: false }
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
 * 重置所有状态（用于测试或切账号）
 */
function reset() {
  if (monitoringActive && plugin) {
    plugin.stopMonitoring({}, () => {})
  }
  subscribers.clear()
  latestCache.hrv = null
  latestCache.heartRate = null
  monitoringActive = false
  mockModeActive = false
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
  isMonitoring,
  reset
}
