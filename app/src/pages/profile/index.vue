<script setup>
import { ref, onMounted } from 'vue'

const userNickname = ref('SoundCare用户')
const todayMinutes = ref(45)
const sleepImprovement = ref('+12%')
const meditationCount = ref(3)

const preferences = ref({
  instrument: '钢琴',
  ambient: '雨声',
  wakeTime: '7:00',
  sleepTime: '23:00'
})

const historyRecords = ref([
  { time: '昨天 22:30', scene: '睡前助眠', duration: '30分钟', hrvImprove: '+28%' },
  { time: '今天 12:15', scene: '午休放松', duration: '15分钟', hrvImprove: '+15%' },
  { time: '今天 14:00', scene: '下午专注', duration: '45分钟', hrvImprove: '+22%' }
])

const deviceStatus = ref({
  appleWatch: { connected: true, lastSync: '2分钟前' },
  huaweiWatch: { connected: false, lastSync: '-' }
})

onMounted(() => {
  // 模拟加载用户数据
})
</script>

<template>
  <view class="container">
    <!-- 用户信息 -->
    <view class="user-header">
      <view class="avatar">
        <text class="avatar-icon">👤</text>
      </view>
      <view class="user-info">
        <text class="nickname">{{ userNickname }}</text>
        <text class="user-desc">HRV疗愈记录者</text>
      </view>
    </view>

    <!-- 今日数据 -->
    <view class="today-stats-card">
      <text class="card-title">📊 今日数据</text>
      <view class="stats-grid">
        <view class="stat-item">
          <text class="stat-value">🎵</text>
          <text class="stat-number">{{ todayMinutes }}</text>
          <text class="stat-label">疗愈分钟</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">💤</text>
          <text class="stat-number">{{ sleepImprovement }}</text>
          <text class="stat-label">睡眠改善</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">🧘</text>
          <text class="stat-number">{{ meditationCount }}</text>
          <text class="stat-label">冥想次数</text>
        </view>
      </view>
    </view>

    <!-- 我的偏好 -->
    <view class="preferences-card">
      <text class="card-title">⚙️ 我的偏好</text>
      <view class="preference-list">
        <view class="preference-item">
          <text class="pref-icon">🎹</text>
          <text class="pref-label">最爱乐器</text>
          <text class="pref-value">{{ preferences.instrument }}</text>
          <text class="pref-arrow">›</text>
        </view>
        <view class="preference-item">
          <text class="pref-icon">🌧️</text>
          <text class="pref-label">氛围音</text>
          <text class="pref-value">{{ preferences.ambient }}</text>
          <text class="pref-arrow">›</text>
        </view>
        <view class="preference-item">
          <text class="pref-icon">⏰</text>
          <text class="pref-label">起床时间</text>
          <text class="pref-value">{{ preferences.wakeTime }}</text>
          <text class="pref-arrow">›</text>
        </view>
        <view class="preference-item">
          <text class="pref-icon">😴</text>
          <text class="pref-label">入睡时间</text>
          <text class="pref-value">{{ preferences.sleepTime }}</text>
          <text class="pref-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 设备管理 -->
    <view class="devices-card">
      <text class="card-title">⌚ 设备管理</text>
      <view class="device-list">
        <view class="device-item">
          <text class="device-icon">🍎</text>
          <view class="device-info">
            <text class="device-name">Apple Watch</text>
            <text class="device-status" v-if="deviceStatus.appleWatch.connected">
              <text class="status-dot connected"></text>
              已连接 · {{ deviceStatus.appleWatch.lastSync }}
            </text>
            <text class="device-status disconnected" v-else>未连接</text>
          </view>
          <button class="btn-device">管理</button>
        </view>
        <view class="device-item">
          <text class="device-icon">📱</text>
          <view class="device-info">
            <text class="device-name">华为手表</text>
            <text class="device-status disconnected" v-if="!deviceStatus.huaweiWatch.connected">
              未连接
            </text>
            <text class="device-status" v-else>
              <text class="status-dot connected"></text>
              已连接 · {{ deviceStatus.huaweiWatch.lastSync }}
            </text>
          </view>
          <button class="btn-device">配对</button>
        </view>
      </view>
    </view>

    <!-- 历史记录 -->
    <view class="history-card">
      <text class="card-title">📜 历史记录</text>
      <view class="history-list">
        <view class="history-item" v-for="(record, index) in historyRecords" :key="index">
          <view class="history-left">
            <text class="history-time">{{ record.time }}</text>
            <text class="history-scene">{{ record.scene }}</text>
          </view>
          <view class="history-right">
            <text class="history-duration">{{ record.duration }}</text>
            <text class="history-hrv">{{ record.hrvImprove }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 设置菜单 -->
    <view class="settings-card">
      <view class="setting-item">
        <text class="setting-icon">🔔</text>
        <text class="setting-label">提醒设置</text>
        <text class="setting-arrow">›</text>
      </view>
      <view class="setting-item">
        <text class="setting-icon">📊</text>
        <text class="setting-label">数据同步</text>
        <text class="setting-arrow">›</text>
      </view>
      <view class="setting-item">
        <text class="setting-icon">❓</text>
        <text class="setting-label">帮助</text>
        <text class="setting-arrow">›</text>
      </view>
      <view class="setting-item">
        <text class="setting-icon">ℹ️</text>
        <text class="setting-label">关于</text>
        <text class="setting-arrow">›</text>
      </view>
    </view>

    <!-- 版本信息 -->
    <view class="version-info">
      <text class="version-text">SoundCare v1.0.0</text>
    </view>
  </view>
</template>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(180deg, #1A1A2E 0%, #252540 100%);
  padding: 20rpx;
  color: #F8F8FF;
}

.user-header {
  flex-direction: row;
  align-items: center;
  padding: 40rpx 20rpx;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20rpx;
  margin-bottom: 20rpx;
}

.avatar {
  width: 100rpx;
  height: 100rpx;
  background: linear-gradient(135deg, #FF6B00, #FF8C42);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
}

.avatar-icon {
  font-size: 50rpx;
}

.user-info {
  flex: 1;
}

.nickname {
  font-size: 36rpx;
  font-weight: bold;
  display: block;
  margin-bottom: 8rpx;
}

.user-desc {
  font-size: 24rpx;
  color: #888;
}

.today-stats-card,
.preferences-card,
.devices-card,
.history-card,
.settings-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.card-title {
  font-size: 28rpx;
  color: #a0a0a0;
  margin-bottom: 20rpx;
  display: block;
}

.stats-grid {
  flex-direction: row;
  justify-content: space-around;
}

.stat-item {
  align-items: center;
}

.stat-value {
  font-size: 40rpx;
  display: block;
  margin-bottom: 8rpx;
}

.stat-number {
  font-size: 40rpx;
  font-weight: bold;
  color: #60a5fa;
  display: block;
}

.stat-label {
  font-size: 22rpx;
  color: #888;
}

.preference-list,
.device-list,
.history-list {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16rpx;
  padding: 10rpx 0;
}

.preference-item,
.setting-item {
  flex-direction: row;
  align-items: center;
  padding: 24rpx 20rpx;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.preference-item:last-child,
.setting-item:last-child {
  border-bottom: none;
}

.pref-icon,
.setting-icon {
  font-size: 32rpx;
  margin-right: 20rpx;
}

.pref-label,
.setting-label {
  font-size: 28rpx;
  color: #e0e0e0;
  flex: 1;
}

.pref-value,
.setting-label {
  font-size: 28rpx;
  color: #888;
}

.pref-arrow,
.setting-arrow {
  font-size: 32rpx;
  color: #666;
  margin-left: 16rpx;
}

.device-item {
  flex-direction: row;
  align-items: center;
  padding: 24rpx 20rpx;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.device-item:last-child {
  border-bottom: none;
}

.device-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
}

.device-info {
  flex: 1;
}

.device-name {
  font-size: 28rpx;
  color: #e0e0e0;
  display: block;
  margin-bottom: 6rpx;
}

.device-status {
  font-size: 22rpx;
  color: #888;
}

.status-dot {
  display: inline-block;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  margin-right: 8rpx;
}

.status-dot.connected {
  background: #4ade80;
}

.device-status.disconnected {
  color: #666;
}

.btn-device {
  font-size: 24rpx;
  background: rgba(255, 107, 0, 0.2);
  color: #FF6B00;
  padding: 12rpx 24rpx;
  border-radius: 20rpx;
  border: none;
}

.history-item {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.history-item:last-child {
  border-bottom: none;
}

.history-left {
  flex: 1;
}

.history-time {
  font-size: 24rpx;
  color: #888;
  display: block;
  margin-bottom: 6rpx;
}

.history-scene {
  font-size: 28rpx;
  color: #e0e0e0;
}

.history-right {
  align-items: flex-end;
}

.history-duration {
  font-size: 24rpx;
  color: #888;
  display: block;
  margin-bottom: 6rpx;
}

.history-hrv {
  font-size: 26rpx;
  color: #4ade80;
  font-weight: bold;
}

.version-info {
  text-align: center;
  padding: 40rpx 0;
}

.version-text {
  font-size: 24rpx;
  color: #666;
}
</style>