<template>
  <view class="hrv-monitor">
    <view class="header">
      <text class="title">HRV 实时监测</text>
      <text class="subtitle">Connected to {{ deviceName }}</text>
    </view>

    <view class="device-badge" :class="deviceType">
      <text>{{ deviceTypeText }}</text>
    </view>

    <view class="status-card">
      <view class="status-row">
        <view class="status-item">
          <text class="label">心率</text>
          <text class="value">{{ heartRate }} <text class="unit">BPM</text></text>
        </view>
        <view class="status-item">
          <text class="label">HRV</text>
          <text class="value">{{ hrvValue }} <text class="unit">ms</text></text>
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
      <view class="status-row" v-if="deviceType === 'apple'">
        <view class="status-item estimate-notice">
          <text class="label">数据说明</text>
          <text class="value">Apple Watch心率估算，精度有限</text>
        </view>
      </view>
      <view class="status-row" v-if="deviceType === 'huawei'">
        <view class="status-item">
          <text class="label">SDNN</text>
          <text class="value">{{ sdnnValue }} <text class="unit">ms</text></text>
        </view>
        <view class="status-item">
          <text class="label">pNN50</text>
          <text class="value">{{ pnn50Value }} <text class="unit">%</text></text>
        </view>
      </view>
    </view>

    <view class="chart-container">
      <text class="section-title">HRV 引导曲线</text>
      <view class="chart-placeholder">
        <text>实时HRV曲线</text>
      </view>
    </view>

    <view class="music-adjustment">
      <text class="section-title">音乐动态调整</text>
      <view class="adjustment-info">
        <text>BPM: {{ currentBpm }} → {{ adjustedBpm }}</text>
        <text class="delta" :class="bpmDeltaClass">{{ bpmDeltaText }}</text>
      </view>
    </view>

    <view class="healing-progress">
      <text class="section-title">疗愈进度</text>
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: healingProgress + '%' }"></view>
      </view>
      <text class="progress-text">{{ healingProgress }}%</text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      deviceName: 'Apple Watch',
      deviceType: 'apple',  // 'apple' | 'huawei' | 'polar'
      heartRate: 68,
      hrvValue: 52,
      sdnnValue: 45,
      pnn50Value: 12,
      hrvStatus: 'normal',
      trendDirection: 'up',
      currentBpm: 72,
      adjustedBpm: 68,
      healingProgress: 78
    }
  },
  computed: {
    deviceTypeText() {
      const typeMap = {
        apple: 'Apple Watch',
        huawei: '华为手表',
        polar: 'Polar H10'
      }
      return typeMap[this.deviceType] || '未知设备'
    },
    hrvStatusText() {
      const statusMap = {
        relaxed: '深度放松',
        normal: '正常放松',
        stressed: '中度压力',
        anxious: '焦虑状态'
      }
      return statusMap[this.hrvStatus] || '未知'
    },
    trendText() {
      return this.trendDirection === 'up' ? '↑ 放松中' : '↓ 紧张中'
    },
    bpmDeltaText() {
      const delta = this.adjustedBpm - this.currentBpm
      return delta > 0 ? `+${delta}` : `${delta}`
    },
    bpmDeltaClass() {
      return this.adjustedBpm < this.currentBpm ? 'down' : 'up'
    }
  },
  onLoad() {
    this.startMonitoring()
  },
  onUnload() {
    this.stopMonitoring()
  },
  methods: {
    startMonitoring() {
      // 调用原生插件获取HRV数据
      if (this.deviceType === 'apple') {
        this.startAppleHealthKit()
      } else if (this.deviceType === 'huawei') {
        this.startHuaweiHealth()
      }
    },
    startAppleHealthKit() {
      // Apple Watch: 通过HealthKit获取心率，计算估算HRV
      // const healthkit = uni.requireNativePlugin('healthkit')
      // healthkit.startHeartRateQuery({ ... })
    },
    startHuaweiHealth() {
      // 华为手表: 获取原始RRI数据，计算精确HRV
      // const huaweiHealth = uni.requireNativePlugin('huawei-health')
      // huaweiHealth.startRRIReading({ ... })
    },
    stopMonitoring() {
      // 停止HRV监测
    }
  }
}
</script>

<style scoped>
.hrv-monitor {
  padding: 20px;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  min-height: 100vh;
  color: #fff;
}
.header {
  margin-bottom: 15px;
}
.title {
  font-size: 24px;
  font-weight: bold;
}
.subtitle {
  font-size: 14px;
  color: #888;
}
.device-badge {
  display: inline-block;
  padding: 5px 12px;
  border-radius: 12px;
  font-size: 12px;
  margin-bottom: 15px;
}
.device-badge.apple {
  background: #000;
  color: #fff;
}
.device-badge.huawei {
  background: #cf0a2c;
  color: #fff;
}
.device-badge.polar {
  background: #fff;
  color: #000;
}
.estimate-notice {
  background: rgba(245, 158, 11, 0.2);
  border-radius: 8px;
  padding: 10px;
}
.estimate-notice .value {
  font-size: 12px;
  color: #f59e0b;
}
.status-card {
  background: rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
}
.status-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
}
.status-item {
  flex: 1;
}
.label {
  font-size: 12px;
  color: #888;
}
.value {
  font-size: 24px;
  font-weight: bold;
}
.unit {
  font-size: 14px;
  color: #888;
}
.status.relaxed { color: #4ade80; }
.status.normal { color: #60a5fa; }
.status.stressed { color: #f59e0b; }
.status.anxious { color: #ef4444; }
.trend.up { color: #4ade80; }
.trend.down { color: #ef4444; }
.section-title {
  font-size: 16px;
  color: #888;
  margin: 20px 0 10px;
}
.chart-container {
  margin-bottom: 20px;
}
.chart-placeholder {
  height: 150px;
  background: rgba(255,255,255,0.05);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #555;
}
.music-adjustment {
  background: rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
}
.adjustment-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.delta.down { color: #4ade80; }
.delta.up { color: #ef4444; }
.healing-progress {
  background: rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 20px;
}
.progress-bar {
  height: 8px;
  background: rgba(255,255,255,0.2);
  border-radius: 4px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ade80, #22d3ee);
  border-radius: 4px;
  transition: width 0.3s;
}
.progress-text {
  text-align: center;
  margin-top: 10px;
  font-size: 14px;
  color: #888;
}
</style>