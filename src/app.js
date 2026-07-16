// 全局状态管理 (替代 app.js globalData)

const state = {
  userInfo: null,
  history: [],
  currentDiagnosis: null,
  kbVersion: '1.0',
  appVersion: '1.0.0'
}

export function getState() {
  return state
}

export function setState(partial) {
  Object.assign(state, partial)
}

export function getCurrentDiagnosis() {
  return state.currentDiagnosis
}

export function setCurrentDiagnosis(diagnosis) {
  state.currentDiagnosis = diagnosis
}

export function clearCurrentDiagnosis() {
  state.currentDiagnosis = null
}

export default { getState, setState, getCurrentDiagnosis, setCurrentDiagnosis, clearCurrentDiagnosis }
