<template>
  <view class="hrv-monitor">
    <view class="header">
      <text class="title">HRV 实时监测</text>
      <text class="subtitle">{{ subtitleText }}</text>
    </view>

    <view class="device-badge" :class="deviceType">
      <text>{{ deviceTypeText }}</text>
    </view>

    <!-- 设备不支持 -->
    <view v-if="!available" class="alert-card">
      <text class="alert-title">设备不支持</text>
      <text class="alert-content">{{ unavailableReason }}</text>
      <button class="alert-btn" @click="recheck">重新检测</button>
    </view>

    <!-- 正常监测 -->
    <view v-else class="status-card">
      <view class="status-row">
        <view class="status-item">
          <text class="label">心率</text>
          <text class="value hr">{{ heartRateDisplay }} <text class="unit">BPM</text></text>
        </view>
        <view class="status-item">
          <text class="label">HRV</text>
          <text class="value" :class="hrvStatus">{{ hrvDisplay }} <text class="unit">ms</text></text>
        </view>
      </view>
      <view class="status-row">
        <view class="status-item">
          <text class="label">状态</text>
          <text class="value status" :class="hrvStatus">{{ hrvStatusText }}</text>
        </view>
        <view class="status-item">
          <text class="label">趋势</text>
          <text class="value trend" :class="trendDirection">{{ trendText }}</text>
        </view>
      </view>
      <view class="status-row">
        <view class="status-item estimate-notice">
          <text class="label">数据来源</text>
          <text class="value">{{ sourceText }}</text>
        </view>
      </view>
    </view>

    <view v-if="available" class="chart-container">
      <text class="section-title">HRV 实时曲线（最近 {{ hrvHistory.length }} 个样本 / 实测 {{ mockRange.min }}-{{ mockRange.max }} ms）</text>
      <view v-if="hrvHistory.length < 2" class="chart-placeholder">
        <text>数据采集中…</text>
      </view>
      <view v-else class="chart">
        <view
          v-for="ref in referenceLines"
          :key="ref.value"
          class="grid-line"
          :style="{ bottom: ref.y + 'px' }"
        >
          <text class="grid-label">{{ ref.value }}ms</text>
        </view>
        <view
          v-for="(p, i) in chartDots"
          :key="i"
          class="curve-dot"
          :style="{
            left: p.x + '%',
            bottom: p.y + 'px',
            backgroundColor: i === chartDots.length - 1 ? '#FF6B00' : '#FF8C42'
          }"
        ></view>
        <view class="curve-line" :style="{ width: curveWidth }"></view>
      </view>
    </view>

    <view v-if="available" class="music-adjustment">
      <text class="section-title">本地 BPM 建议</text>
      <view class="adjustment-info">
        <text>建议调整：</text>
        <text class="delta" :class="bpmDeltaClass">{{ bpmDeltaText }}</text>
      </view>
      <text class="adjustment-note">（实际调整由播放页通过后端动态控制）</text>
    </view>

    <view v-if="available" class="monitoring-control">
      <button v-if="!monitoring" class="control-btn" @click="startMonitoring">开始监测</button>
      <button v-else class="control-btn stop" @click="stopMonitoring">停止监测</button>
    </view>
  </view>
</template>

<script>
import hrv from '@/api/hrv-plugin.js'

export default {
  data() {
    return {
      available: false,
      unavailableReason: '',
      monitoring: false,
      deviceType: 'apple',
      heartRate: 70,        // 初始 70 BPM（mock 默认值，对齐小程序）
      hrvValue: 40,         // 初始 40ms（mock 默认值，对齐小程序）
      hrvStatus: 'normal',
      trendDirection: 'stable',
      hrvHistory: [40],     // 初始历史含一个 40ms 样本（避免空数组）
      bpmDelta: 0,
      dataSource: '',  // 'Apple Watch' / 'Mock' / 等
      unsubscribe: null,
      lastEventTime: 0,
      mockRange: { min: 999, max: 0 }  // mock 数据实测范围（调试用）
    }
  },
  computed: {
    subtitleText() {
      if (!this.available) return '未连接设备'
      if (this.monitoring) return `监测中 · ${this.dataSource || '等待数据...'}`
      return '已连接 · 待启动'
    },
    deviceTypeText() {
      const typeMap = { apple: 'Apple Watch', huawei: '华为手表', polar: 'Polar H10' }
      return typeMap[this.deviceType] || '未知设备'
    },
    heartRateDisplay() {
      return this.heartRate > 0 ? this.heartRate : '--'
    },
    hrvDisplay() {
      return this.hrvValue > 0 ? this.hrvValue : '--'
    },
    hrvStatusText() {
      const statusMap = {
        relaxed: '深度放松',
        normal: '正常放松',
        stressed: '中度压力',
        high: '高压力',
        anxious: '焦虑状态'
      }
      return statusMap[this.hrvStatus] || '未知'
    },
    trendText() {
      if (this.hrvHistory.length < 3) return '数据收集中'
      return this.trendDirection === 'up' ? '↑ 放松中' : (this.trendDirection === 'down' ? '↓ 紧张中' : '→ 稳定')
    },
    bpmDeltaText() {
      if (this.bpmDelta === 0) return '保持当前 BPM'
      return this.bpmDelta > 0 ? `+${this.bpmDelta} BPM` : `${this.bpmDelta} BPM`
    },
    bpmDeltaClass() {
      if (this.bpmDelta < 0) return 'down'  // 降低 = 好
      if (this.bpmDelta > 0) return 'up'    // 升高 = 需刺激
      return ''
    },
    sourceText() {
      return this.dataSource || '等待首次事件...'
    },
    chartDots() {
      // 取最近 20 个样本 → 曲线上的点（百分比定位 X，像素定位 Y）
      const data = this.hrvHistory.slice(-20)
      if (data.length === 0) return []
      const maxHrv = 100
      const height = 160  // 跟 .chart 高度一致
      return data.map((value, index) => {
        const x = (index / (data.length - 1 || 1)) * 100
        const yRatio = Math.max(0, Math.min(1, value / maxHrv))
        const y = Math.round(height * yRatio)  // 高值在上、低值在下（标准图表布局）
        return { x, y, value }
      })
    },
    curveWidth() {
      // 底部进度线：随样本数从 0% 增长到 100%（最大 20 个样本）
      const data = this.hrvHistory.slice(-20)
      if (data.length < 2) return '0%'
      return ((data.length - 1) / 19) * 100 + '%'
    },
    referenceLines() {
      // HRV 阈值参考线（20/50/80 对应状态分界，100 是图表上限）
      const height = 160
      const maxHrv = 100
      return [20, 50, 80, 100].map((value) => ({
        value,
        y: Math.round(height * value / maxHrv)  // 高值在上、低值在下
      }))
    }
  },
  onLoad() {
    this.checkAvailability()
  },
  onUnload() {
    this.stopMonitoring()
  },
  methods: {
    async checkAvailability() {
      try {
        const res = await hrv.isAvailable()
        this.available = !!res.available
        if (!res.available) {
          this.unavailableReason = '需要 iPhone + Apple Watch。iPad 和模拟器暂不支持。'
        }
      } catch (e) {
        this.available = false
        this.unavailableReason = `检测失败：${e.errorCode || e.message || 'UNKNOWN'}`
      }
    },

    recheck() {
      this.unavailableReason = ''
      this.checkAvailability()
    },

    async startMonitoring() {
      if (this.monitoring) return

      // 1. 请求授权（已授权时 no-op）
      try {
        const auth = await hrv.requestAuthorization(['hrv', 'heartRate'])
        if (!auth.success) {
          uni.showToast({ title: `授权失败：${auth.errorCode}`, icon: 'none' })
          return
        }
      } catch (e) {
        uni.showToast({ title: `授权异常：${e.errorCode || e.message}`, icon: 'none' })
        return
      }

      // 2. 订阅事件
      this.unsubscribe = hrv.onUpdate((event) => this.handleEvent(event))

      // 3. 启动监测
      const result = hrv.startMonitoring({ types: ['hrv', 'heartRate'] })
      if (!result.success) {
        if (this.unsubscribe) this.unsubscribe()
        this.unsubscribe = null
        uni.showToast({ title: `启动失败：${result.errorCode}`, icon: 'none' })
        return
      }

      this.monitoring = true
      this.hrvHistory = []
      this.mockRange = { min: 999, max: 0 }
      this.lastEventTime = Date.now()
    },

    stopMonitoring() {
      if (this.unsubscribe) {
        this.unsubscribe()
        this.unsubscribe = null
      }
      hrv.stopMonitoring()
      this.monitoring = false
    },

    handleEvent(event) {
      if (!event) return

      this.lastEventTime = Date.now()
      this.dataSource = event.source || (hrv.isMockMode() ? 'Mock' : 'unknown')

      if (event.type === 'heartRate') {
        this.heartRate = Math.round(event.value)
      } else if (event.type === 'hrv') {
        const hrv = Math.round(event.value)
        this.hrvValue = hrv
        this.hrvStatus = this.classifyHRV(hrv)
        this.bpmDelta = this.suggestBpmDelta(hrv)
        this.updateHistory(hrv)
      }
    },

    /**
     * HRV 状态分级（5 级，对齐 soundcare-app HRVCalculator）
     *   >80ms   → relaxed     (深度放松)
     *   50-80   → normal      (正常放松)
     *   30-50   → stressed    (中度压力)
     *   15-30   → high        (高压力)
     *   <15     → anxious     (焦虑状态)
     */
    classifyHRV(value) {
      if (value >= 80) return 'relaxed'
      if (value >= 50) return 'normal'
      if (value >= 30) return 'stressed'
      if (value >= 15) return 'high'
      return 'anxious'
    },

    /**
     * 本地 BPM 建议（前端规则，最终由后端根据 session 上下文决定）
     * 5 级对齐：<15 焦虑 -10 / 15-30 高压力 -8 / 30-50 中度 -4 / 50-80 保持 / >80 +2
     */
    suggestBpmDelta(hrv) {
      if (hrv < 15) return -10  // 焦虑：大幅降速
      if (hrv < 30) return -8   // 高压力：显著降速
      if (hrv < 50) return -4   // 中度压力：适度降速
      if (hrv > 80) return +2   // 深度放松：略提神或保持
      return 0
    },

    updateHistory(value) {
      this.hrvHistory.push(value)
      if (this.hrvHistory.length > 60) this.hrvHistory.shift()
      if (value < this.mockRange.min) this.mockRange.min = value
      if (value > this.mockRange.max) this.mockRange.max = value

      // 趋势：最近 3 个 vs 最早 3 个
      if (this.hrvHistory.length >= 6) {
        const recent = this.hrvHistory.slice(-3).reduce((a, b) => a + b, 0) / 3
        const earlier = this.hrvHistory.slice(0, 3).reduce((a, b) => a + b, 0) / 3
        const diff = recent - earlier
        if (diff > 5) this.trendDirection = 'up'
        else if (diff < -5) this.trendDirection = 'down'
        else this.trendDirection = 'stable'
      }
    }
  }
}
</script>

<style scoped>
.hrv-monitor {
  padding: 20px;
  background: linear-gradient(180deg, #1A1A2E 0%, #252540 100%);
  min-height: 100vh;
  color: #F8F8FF;
}
.header {
  margin-bottom: 15px;
}
.title {
  font-size: 24px;
  font-weight: bold;
  color: #F8F8FF;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
.subtitle {
  font-size: 14px;
  color: #A0A0C0;
}
.device-badge {
  display: inline-block;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 12px;
  margin-bottom: 15px;
  background: rgba(255, 107, 0, 0.2);
  color: #FF6B00;
}
.device-badge.apple { background: rgba(0, 0, 0, 0.5); color: #F8F8FF; }
.device-badge.huawei { background: rgba(207, 10, 44, 0.3); color: #ff7a8c; }
.device-badge.polar { background: rgba(255, 255, 255, 0.15); color: #F8F8FF; }

/* 设备不支持提示 */
.alert-card {
  background: rgba(42, 42, 69, 0.8);
  border: 1px solid rgba(245, 158, 11, 0.4);
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20px;
}
.alert-title {
  font-size: 16px;
  color: #f59e0b;
  font-weight: bold;
  display: block;
  margin-bottom: 8px;
}
.alert-content {
  font-size: 13px;
  color: #A0A0C0;
  line-height: 1.5;
  display: block;
  margin-bottom: 15px;
}
.alert-btn {
  background: #f59e0b;
  color: #000;
  font-size: 13px;
  padding: 8px 16px;
  border-radius: 8px;
}

.status-card {
  background: rgba(42, 42, 69, 0.8);
  border: 1px solid rgba(255, 107, 0, 0.2);
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20px;
}
.status-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
}
.status-row:last-child { margin-bottom: 0; }
.status-item {
  flex: 1;
}
.label {
  font-size: 12px;
  color: #A0A0C0;
  display: block;
  margin-bottom: 4px;
}
.value {
  font-size: 24px;
  font-weight: bold;
  color: #F8F8FF;
}
.value.hr { color: #ef4444; }  /* 心率：红 */
.value.relaxed { color: #16a34a; }  /* 充分放松：深绿 */
.value.normal { color: #4ade80; }   /* 正常放松：浅绿 */
.value.stressed { color: #f59e0b; }
.value.high { color: #fb923c; }
.value.anxious { color: #ef4444; }
.unit {
  font-size: 14px;
  color: #A0A0C0;
}
/* 状态 / 趋势：副文本，更小且不加粗 */
.value.status, .value.trend {
  font-size: 14px;
  font-weight: normal;
}
.status.relaxed { color: #16a34a; }
.status.normal { color: #4ade80; }
.status.stressed { color: #f59e0b; }
.status.high { color: #fb923c; }
.status.anxious { color: #ef4444; }
.trend.up { color: #4ade80; }
.trend.down { color: #ef4444; }
.trend.stable { color: #A0A0C0; }
.estimate-notice {
  background: rgba(96, 165, 250, 0.1);
  border-radius: 8px;
  padding: 8px 10px;
}
.estimate-notice .value {
  font-size: 12px;
  color: #93c5fd;
}

.section-title {
  font-size: 14px;
  color: #A0A0C0;
  margin: 20px 0 10px;
  display: block;
}

.chart-container {
  background: rgba(42, 42, 69, 0.8);
  border: 1px solid rgba(255, 107, 0, 0.2);
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20px;
}
.chart-placeholder {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #A0A0C0;
  font-size: 13px;
}
.chart {
  position: relative;
  height: 160px;
  margin-top: 4px;
}
.curve-dot {
  position: absolute;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  transform: translateX(-50%);
  transition: all 0.3s;
}
.curve-line {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 4rpx;
  background: linear-gradient(90deg, #FF8C42 0%, #FF6B00 100%);
  border-radius: 2rpx;
  transition: width 0.3s;
}
.grid-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px dashed rgba(255, 255, 255, 0.18);
  pointer-events: none;
}
.grid-label {
  position: absolute;
  right: 4px;
  top: -14rpx;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.45);
  background: rgba(26, 26, 46, 0.7);
  padding: 1px 4px;
  border-radius: 2px;
}

.music-adjustment {
  background: rgba(42, 42, 69, 0.8);
  border: 1px solid rgba(255, 107, 0, 0.2);
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20px;
}
.adjustment-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #F8F8FF;
}
.delta {
  color: #F8F8FF;
  font-weight: bold;
}
.delta.down { color: #4ade80; }
.delta.up { color: #ef4444; }
.adjustment-note {
  display: block;
  margin-top: 8px;
  font-size: 11px;
  color: #A0A0C0;
}

.monitoring-control {
  margin-top: 20px;
}
.control-btn {
  background: linear-gradient(90deg, #FF8C42 0%, #FF6B00 100%);
  color: #fff;
  border-radius: 12px;
  padding: 14px;
  font-size: 16px;
  font-weight: bold;
}
.control-btn.stop {
  background: #6b7280;
}
</style>
