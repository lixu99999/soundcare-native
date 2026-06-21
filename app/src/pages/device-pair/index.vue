<template>
  <view class="device-pair">
    <view class="header">
      <text class="title">设备配对</text>
      <text class="subtitle">连接您的可穿戴设备</text>
    </view>

    <!-- v1.0 演示模式提示 -->
    <view class="demo-banner">
      <view class="demo-banner-row">
        <text class="demo-banner-icon">🎭</text>
        <text class="demo-banner-title">v1.0 演示模式</text>
      </view>
      <text class="demo-banner-text">未连接 Apple Watch 时，点击「Apple Watch」可模拟配对流程，但不会采集真实 HRV 数据。真实数据采集需要 iPhone + Apple Watch + 付费 Apple Developer 账号。</text>
    </view>

    <view class="device-list">
      <!-- Apple Watch：v1 实装 -->
      <view class="device-item" @click="pairDevice('apple')">
        <view class="device-icon apple"></view>
        <view class="device-info">
          <text class="device-name">Apple Watch</text>
          <text class="device-desc">{{ appleDescText }}</text>
        </view>
        <view class="device-status" :class="appleStatus">
          {{ appleStatusText }}
        </view>
      </view>

      <!-- 华为手表：v2 -->
      <view class="device-item" @click="pairDevice('huawei')">
        <view class="device-icon huawei"></view>
        <view class="device-info">
          <text class="device-name">华为手表</text>
          <text class="device-desc">v2 版本支持</text>
        </view>
        <view class="device-status">敬请期待</view>
      </view>

      <!-- Polar H10：v2 -->
      <view class="device-item" @click="pairDevice('polar')">
        <view class="device-icon polar"></view>
        <view class="device-info">
          <text class="device-name">Polar H10</text>
          <text class="device-desc">v2 版本支持</text>
        </view>
        <view class="device-status">敬请期待</view>
      </view>
    </view>

    <!-- Apple Watch 已配对后：测试数据流按钮 -->
    <view v-if="appleStatus === 'connected'" class="test-section">
      <button class="test-btn" @click="testDataFlow">
        {{ testing ? '测试中...' : '测试数据流（5 秒）' }}
      </button>
      <view v-if="lastTestEvent" class="test-result">
        <text class="test-label">最近事件：</text>
        <text class="test-value">{{ lastTestEvent }}</text>
      </view>
    </view>

    <view class="tips">
      <text class="tips-title">配对提示</text>
      <text class="tips-content">
        1. Apple Watch 需在 iPhone 健康 App 中授权\n
        2. 授权失败请到 iPhone 设置 → 健康 → 数据访问 → 设备 中允许\n
        3. 测试数据流按钮可验证 HRV 插件是否正常工作
      </text>
    </view>
  </view>
</template>

<script>
import hrv from '@/api/hrv-plugin.js'

export default {
  data() {
    return {
      // Apple Watch 状态
      appleAvailable: false,
      appleStatus: 'idle', // idle | authorizing | connected | error
      appleError: '',

      // 测试
      testing: false,
      lastTestEvent: ''
    }
  },
  computed: {
    appleStatusText() {
      switch (this.appleStatus) {
        case 'idle': return this.appleAvailable ? '点击配对' : '不支持'
        case 'authorizing': return '授权中...'
        case 'connected': return '已连接'
        case 'error': return '重试'
        default: return ''
      }
    },
    appleDescText() {
      if (this.appleError) return `错误：${this.appleError}`
      if (this.appleStatus === 'connected') return '正在监测心率 + HRV'
      if (!this.appleAvailable) return '需要 iPhone + Apple Watch'
      return '实时心率 + HRV 估算'
    }
  },
  onLoad() {
    this.checkAppleWatchAvailability()
  },
  onUnmounted() {
    // 清理测试中的监测
    if (this.testing) {
      hrv.stopMonitoring()
    }
  },
  methods: {
    /**
     * 检查 HealthKit 是否可用
     * iPad / 模拟器 / 小程序端返回 false
     */
    async checkAppleWatchAvailability() {
      try {
        const res = await hrv.isAvailable()
        this.appleAvailable = !!res.available
      } catch (e) {
        console.error('[device-pair] isAvailable error:', e)
        this.appleAvailable = false
      }
    },

    /**
     * 设备配对入口（按类型路由）
     */
    pairDevice(type) {
      if (type === 'apple') {
        this.pairAppleWatch()
      } else {
        uni.showModal({
          title: '敬请期待',
          content: '华为手表和 Polar H10 将在 v2 版本支持。',
          showCancel: false
        })
      }
    },

    /**
     * Apple Watch 配对：触发 HealthKit 授权
     * Q4 设计：iPad 等无 HealthKit 设备会优雅降级
     */
    async pairAppleWatch() {
      if (!this.appleAvailable) {
        uni.showModal({
          title: '当前设备不支持',
          content: 'HRV 监测需要 iPhone + Apple Watch。\niPad 和模拟器暂不支持。',
          showCancel: false
        })
        return
      }

      this.appleStatus = 'authorizing'
      this.appleError = ''

      try {
        const auth = await hrv.requestAuthorization(['hrv', 'heartRate'])
        if (!auth.success) {
          throw new Error(auth.errorCode || 'AUTH_FAILED')
        }
        this.appleStatus = 'connected'
        uni.showToast({ title: '已连接 Apple Watch', icon: 'success' })
      } catch (e) {
        this.appleStatus = 'error'
        this.appleError = e.errorCode || e.message || 'UNKNOWN'
        console.error('[device-pair] auth error:', e)
        uni.showModal({
          title: '授权失败',
          content: `请到 iPhone 设置 → 健康 → 数据访问 → 设备 中允许 SoundCare 访问。\n\n错误码：${this.appleError}`,
          showCancel: false
        })
      }
    },

    /**
     * 测试数据流：启动监测 5 秒，看是否收到 HRV/HR 事件
     * 用于 Mac 端验证插件工作正常
     */
    async testDataFlow() {
      if (this.testing) return

      this.testing = true
      this.lastTestEvent = ''

      const unsubscribe = hrv.onUpdate((event) => {
        if (event.type === 'hrv') {
          this.lastTestEvent = `HRV ${event.value.toFixed(1)}ms (${event.source || 'unknown'})`
        } else if (event.type === 'heartRate') {
          this.lastTestEvent = `HR ${event.value.toFixed(0)} BPM (${event.source || 'unknown'})`
        }
      })

      const result = hrv.startMonitoring({ types: ['hrv', 'heartRate'] })
      if (!result.success) {
        unsubscribe()
        this.testing = false
        uni.showToast({ title: `启动失败：${result.errorCode}`, icon: 'none' })
        return
      }

      // 5 秒后停止
      setTimeout(() => {
        hrv.stopMonitoring()
        unsubscribe()
        this.testing = false
        if (!this.lastTestEvent) {
          this.lastTestEvent = '5 秒内未收到事件（请确认 HealthKit 里有 HRV/HR 数据）'
        }
      }, 5000)
    }
  }
}
</script>

<style scoped>
.device-pair {
  padding: 20px;
  background: #1a1a2e;
  min-height: 100vh;
  color: #fff;
}
.header {
  margin-bottom: 30px;
}
.title {
  font-size: 24px;
  font-weight: bold;
}
.subtitle {
  font-size: 14px;
  color: #888;
}
.device-list {
  margin-bottom: 30px;
}
.device-item {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 15px;
}
.device-icon {
  width: 50px;
  height: 50px;
  border-radius: 25px;
  margin-right: 15px;
}
.device-icon.apple { background: #000; }
.device-icon.huawei { background: #cf0a2c; }
.device-icon.polar { background: #fff; }
.device-info {
  flex: 1;
}
.device-name {
  font-size: 16px;
  font-weight: bold;
  display: block;
}
.device-desc {
  font-size: 12px;
  color: #888;
}
.device-status {
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 10px;
  background: rgba(255,255,255,0.1);
  white-space: nowrap;
}
.device-status.connected {
  background: #4ade80;
  color: #000;
}
.device-status.error {
  background: #f87171;
  color: #000;
}
.device-status.authorizing {
  background: #fbbf24;
  color: #000;
}

/* 测试数据流区块 */
.test-section {
  background: rgba(255,255,255,0.05);
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 30px;
}
.test-btn {
  background: #FF6B00;
  color: #fff;
  border-radius: 8px;
  font-size: 14px;
  padding: 10px;
}
.test-result {
  margin-top: 10px;
  padding: 10px;
  background: rgba(0,0,0,0.3);
  border-radius: 6px;
  font-size: 12px;
}
.test-label {
  color: #888;
  display: block;
  margin-bottom: 4px;
}
.test-value {
  color: #4ade80;
  font-family: monospace;
}

.tips {
  background: rgba(255,255,255,0.05);
  border-radius: 12px;
  padding: 15px;
}
.tips-title {
  font-size: 14px;
  color: #888;
  display: block;
  margin-bottom: 10px;
}
.tips-content {
  font-size: 12px;
  color: #666;
  line-height: 1.6;
  white-space: pre-line;
}
  /* v1.0 演示模式 banner */
  .demo-banner {
    margin: 20rpx 30rpx 10rpx;
    padding: 20rpx 24rpx;
    background: linear-gradient(135deg, rgba(255, 107, 0, 0.15) 0%, rgba(255, 140, 66, 0.10) 100%);
    border: 1rpx solid rgba(255, 107, 0, 0.4);
    border-radius: 16rpx;
  }
  .demo-banner-row {
    display: flex;
    align-items: center;
    margin-bottom: 8rpx;
  }
  .demo-banner-icon {
    font-size: 32rpx;
    margin-right: 12rpx;
  }
  .demo-banner-title {
    font-size: 28rpx;
    font-weight: bold;
    color: #FF8C42;
  }
  .demo-banner-text {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.75);
    line-height: 1.5;
  }
</style>
