<template>
  <view class="healing-report">
    <view class="header">
      <text class="title">疗愈报告</text>
      <text class="date">{{ formattedDate }}</text>
    </view>

    <view class="summary-card">
      <view class="summary-item">
        <text class="value">{{ totalMinutes }}</text>
        <text class="label">疗愈时长(分钟)</text>
      </view>
      <view class="summary-item">
        <text class="value">{{ hrvImprovement }}</text>
        <text class="label">HRV改善</text>
      </view>
      <view class="summary-item">
        <text class="value">{{ sessionCount }}</text>
        <text class="label">疗愈次数</text>
      </view>
    </view>

    <view class="report-list">
      <text class="section-title">历史记录</text>
      <view class="report-item" v-for="(item, index) in historyList" :key="index">
        <view class="report-header">
          <text class="report-time">{{ item.time }}</text>
          <text class="report-duration">{{ item.duration }}分钟</text>
        </view>
        <view class="report-detail">
          <text class="scene">{{ item.scene }}</text>
          <text class="hrv-change" :class="item.hrvTrend">
            HRV {{ item.hrvBefore }}ms → {{ item.hrvAfter }}ms
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      formattedDate: '',
      totalMinutes: 45,
      hrvImprovement: '+18%',
      sessionCount: 3,
      historyList: [
        {
          time: '昨天 22:30',
          duration: 30,
          scene: '睡前助眠',
          hrvBefore: 32,
          hrvAfter: 52,
          hrvTrend: 'up'
        },
        {
          time: '今天 12:15',
          duration: 15,
          scene: '午休放松',
          hrvBefore: 45,
          hrvAfter: 58,
          hrvTrend: 'up'
        },
        {
          time: '今天 14:00',
          duration: 45,
          scene: '下午专注',
          hrvBefore: 40,
          hrvAfter: 48,
          hrvTrend: 'up'
        }
      ]
    }
  },
  onLoad() {
    const now = new Date()
    this.formattedDate = `${now.getMonth() + 1}月${now.getDate()}日 疗愈报告`
  }
}
</script>

<style scoped>
.healing-report {
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
.date {
  font-size: 14px;
  color: #888;
}
.summary-card {
  display: flex;
  justify-content: space-around;
  background: linear-gradient(135deg, #4ade80 0%, #22d3ee 100%);
  border-radius: 16px;
  padding: 25px;
  margin-bottom: 30px;
}
.summary-item {
  text-align: center;
}
.summary-item .value {
  font-size: 28px;
  font-weight: bold;
  color: #000;
}
.summary-item .label {
  font-size: 12px;
  color: #333;
}
.section-title {
  font-size: 16px;
  color: #888;
  display: block;
  margin-bottom: 15px;
}
.report-list {
  margin-bottom: 20px;
}
.report-item {
  background: rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 15px;
}
.report-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}
.report-time {
  font-size: 14px;
  color: #888;
}
.report-duration {
  font-size: 14px;
  color: #60a5fa;
}
.report-detail {
  display: flex;
  justify-content: space-between;
}
.scene {
  font-size: 16px;
  font-weight: bold;
}
.hrv-change {
  font-size: 14px;
}
.hrv-change.up {
  color: #4ade80;
}
</style>