<template>
  <view class="device-pair">
    <view class="header">
      <text class="title">设备配对</text>
      <text class="subtitle">连接您的可穿戴设备</text>
    </view>

    <view class="device-list">
      <view class="device-item" @click="pairDevice('apple')">
        <view class="device-icon apple"></view>
        <view class="device-info">
          <text class="device-name">Apple Watch</text>
          <text class="device-desc">实时心率 + HRV估算</text>
        </view>
        <view class="device-status" :class="appleStatus">
          {{ appleStatusText }}
        </view>
      </view>

      <view class="device-item" @click="pairDevice('huawei')">
        <view class="device-icon huawei"></view>
        <view class="device-info">
          <text class="device-name">华为手表</text>
          <text class="device-desc">实时心率 + RRI精确HRV</text>
        </view>
        <view class="device-status" :class="huaweiStatus">
          {{ huaweiStatusText }}
        </view>
      </view>

      <view class="device-item" @click="pairDevice('polar')">
        <view class="device-icon polar"></view>
        <view class="device-info">
          <text class="device-name">Polar H10</text>
          <text class="device-desc">专业心率带，最准确RRI</text>
        </view>
        <view class="device-status" :class="polarStatus">
          {{ polarStatusText }}
        </view>
      </view>
    </view>

    <view class="tips">
      <text class="tips-title">配对提示</text>
      <text class="tips-content">
        1. Apple Watch需在iPhone健康App中授权\n
        2. 华为手表需在运动健康App中开启权限\n
        3. Polar H10需通过蓝牙连接
      </text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      appleStatus: 'disconnected',
      huaweiStatus: 'disconnected',
      polarStatus: 'disconnected'
    }
  },
  computed: {
    appleStatusText() {
      return this.appleStatus === 'connected' ? '已连接' : '点击配对'
    },
    huaweiStatusText() {
      return this.huaweiStatus === 'connected' ? '已连接' : '点击配对'
    },
    polarStatusText() {
      return this.polarStatus === 'connected' ? '已连接' : '点击配对'
    }
  },
  methods: {
    pairDevice(type) {
      // 调用原生插件配对设备
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
}
.device-status.connected {
  background: #4ade80;
  color: #000;
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
}
</style>