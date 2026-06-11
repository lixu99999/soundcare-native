// SoundCare API Client

import CONFIG from '../config.js'

const API_BASE_URL = CONFIG.API_BASE_URL
const API_TIMEOUT = CONFIG.API_TIMEOUT

/**
 * Generate healing music based on HRV and time period
 * @param {Object} params
 * @param {string} params.time_period - Time period: morning_wake, morning_focus, noon_break, afternoon_focus, evening_relax, sleep
 * @param {Object} params.hrv_data - HRV data {rmssd, heart_rate}
 * @param {string} params.hrv_status - HRV status: relaxed, normal, stressed, anxious
 * @param {string} params.scene - Scene: sleep, relax, focus, meditate, study
 * @param {Object} params.preferences - Music parameters {bpm, key, instrument, ambient, mix_ratio}
 * @param {number} params.duration_minutes - Duration in minutes
 */
export async function generateMusic(params) {
  try {
    const response = await uni.request({
      url: `${API_BASE_URL}/music/generate`,
      method: 'POST',
      timeout: API_TIMEOUT,
      data: params,
      header: {
        'Content-Type': 'application/json',
      },
    })

    if (response.statusCode === 200) {
      return response.data
    } else {
      throw new Error(`API error: ${response.statusCode}`)
    }
  } catch (error) {
    console.error('generateMusic error:', error)
    // Return mock data for demo
    return {
      session_id: 'mock-session-id',
      music_url: 'https://example.com/music/demo.mp3',
      parameters: {
        bpm: params.preferences?.bpm || 72,
        key: 'C_major',
        instrument: params.preferences?.instrument || 'piano',
        ambient: params.preferences?.ambient || 'rain',
        mix_ratio: params.preferences?.mix_ratio || 30,
      },
      hrv_adjustment: {
        target_bpm_reduction: 5,
        suggested_mood: 'relaxing',
        focus_low_freq: true,
      },
      healing_metrics: {
        hrv_sync_index: 85,
        rhythm_sync_index: 88,
        relaxation_potential: 82,
      },
    }
  }
}

/**
 * Update HRV during playback and get adjustment
 * @param {string} session_id
 * @param {Object} hrvData - {
 *   rmssd, heart_rate, elapsed_seconds,
 *   device_type: 'apple_watch' | 'huawei_watch' | 'polar',
 *   sdnn?: number, pnn50?: number, rri_data?: number[]
 * }
 */
export async function updateHRV(session_id, hrvData) {
  try {
    const response = await uni.request({
      url: `${API_BASE_URL}/music/session/${session_id}/hrv-update`,
      method: 'POST',
      timeout: API_TIMEOUT,
      data: hrvData,
      header: {
        'Content-Type': 'application/json',
      },
    })

    if (response.statusCode === 200) {
      return response.data
    }
  } catch (error) {
    console.error('updateHRV error:', error)
  }

  // Return mock adjustment for demo
  return {
    adjustment: {
      bpm_delta: -3,
      next_segment_params: {
        bpm: 65,
        suggested_mood: 'relaxing',
        focus_low_freq: true,
      },
    },
    session_metrics: {
      hrv_trend: '+12%',
      healing_progress: 78,
    },
  }
}

/**
 * Update HRV from Apple Watch (heart rate only, estimates HRV)
 * @param {string} session_id
 * @param {number} heartRate - Heart rate in BPM
 * @param {number} rmssd - Estimated RMSSD from heart rate sequence
 * @param {number} elapsedSeconds - Elapsed time in seconds
 */
export async function updateHRVFromAppleWatch(session_id, heartRate, rmssd, elapsedSeconds) {
  return updateHRV(session_id, {
    rmssd,
    heart_rate: heartRate,
    elapsed_seconds: elapsedSeconds,
    device_type: 'apple_watch'
  })
}

/**
 * Update HRV from Huawei Watch (raw RRI data, precise HRV)
 * @param {string} session_id
 * @param {number} heartRate - Heart rate in BPM
 * @param {number[]} rriData - Raw RRI data in milliseconds
 * @param {number} elapsedSeconds - Elapsed time in seconds
 */
export async function updateHRVFromHuaweiWatch(session_id, heartRate, rriData, elapsedSeconds) {
  return updateHRV(session_id, {
    rmssd: 0,  // Will be calculated by backend from RRI
    heart_rate: heartRate,
    elapsed_seconds: elapsedSeconds,
    device_type: 'huawei_watch',
    rri_data: rriData
  })
}

/**
 * Get user's healing sessions
 * @param {string} user_id
 */
export async function getUserSessions(user_id) {
  try {
    const response = await uni.request({
      url: `${API_BASE_URL}/music/sessions/${user_id}`,
      method: 'GET',
    })

    if (response.statusCode === 200) {
      return response.data
    }
  } catch (error) {
    console.error('getUserSessions error:', error)
  }

  // Return mock data for demo
  return []
}

/**
 * Get user preferences
 * @param {string} user_id
 */
export async function getUser(user_id) {
  try {
    const response = await uni.request({
      url: `${API_BASE_URL}/user/${user_id}`,
      method: 'GET',
    })

    if (response.statusCode === 200) {
      return response.data
    }
  } catch (error) {
    console.error('getUser error:', error)
  }

  // Return mock data for demo
  return {
    id: 'mock-user-id',
    nickname: 'SoundCare用户',
    preferences: {
      instrument: 'piano',
      ambient: 'rain',
      mix_ratio: 30,
    },
  }
}

/**
 * Update user preferences
 * @param {string} user_id
 * @param {Object} preferences
 */
export async function updateUserPreferences(user_id, preferences) {
  try {
    const response = await uni.request({
      url: `${API_BASE_URL}/user/${user_id}/preferences`,
      method: 'PUT',
      timeout: API_TIMEOUT,
      data: preferences,
      header: {
        'Content-Type': 'application/json',
      },
    })

    if (response.statusCode === 200) {
      return response.data
    }
  } catch (error) {
    console.error('updateUserPreferences error:', error)
  }

  return preferences
}
