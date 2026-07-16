// SPA 路由 (History API + hash fallback)

const routes = {}
let currentRoute = '/'
let onRouteChange = null

// TabBar 路由列表
const TAB_ROUTES = ['/', '/history', '/knowledge']

/**
 * 注册路由
 */
export function registerRoute(path, handler) {
  routes[path] = handler
}

/**
 * 注册 TabBar 路由
 */
export function isTabRoute(path) {
  return TAB_ROUTES.includes(path)
}

/**
 * 监听路由变化
 */
export function onNavigate(fn) {
  onRouteChange = fn
}

/**
 * 导航到指定路由
 */
export function navigateTo(path, params = {}) {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const url = query ? `${path}?${query}` : path
  history.pushState({ path, params }, '', url)
  handleRoute(path, params)
}

/**
 * 替换当前路由 (redirectTo)
 */
export function redirectTo(path, params = {}) {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const url = query ? `${path}?${query}` : path
  history.replaceState({ path, params }, '', url)
  handleRoute(path, params)
}

/**
 * 切换到 TabBar 页面 (switchTab)
 */
export function switchTab(path) {
  if (!isTabRoute(path)) return
  history.replaceState({ path }, '', path)
  handleRoute(path, {})
}

/**
 * 重新启动 (reLaunch)
 */
export function reLaunch(path) {
  history.replaceState({ path, root: true }, '', path)
  handleRoute(path, {})
}

/**
 * 返回上一页
 */
export function navigateBack() {
  history.back()
}

/**
 * 处理路由
 */
function handleRoute(path, params) {
  currentRoute = path
  updateTabBar(path)
  const handler = routes[path]
  if (handler) {
    handler(params)
  } else {
    // 尝试默认路由
    const defaultHandler = routes['/']
    if (defaultHandler) defaultHandler(params)
  }
  if (onRouteChange) onRouteChange(path, params)
}

/**
 * 更新 TabBar 高亮
 */
function updateTabBar(path) {
  document.querySelectorAll('.tabbar-item').forEach(item => {
    const route = item.dataset.route
    if (route === path || (path.startsWith('/') && route === '/')) {
      item.classList.add('active')
    } else {
      item.classList.remove('active')
    }
  })
}

/**
 * 获取当前路由
 */
export function getCurrentRoute() {
  return currentRoute
}

/**
 * 解析当前 URL 参数
 */
export function getCurrentParams() {
  const params = {}
  const search = location.search.slice(1)
  if (search) {
    search.split('&').forEach(pair => {
      const [k, v] = pair.split('=')
      params[k] = decodeURIComponent(v || '')
    })
  }
  return params
}

/**
 * 解析历史记录的 state 参数
 */
export function getStateParams() {
  return history.state?.params || {}
}

/**
 * 初始化路由
 */
export function initRouter() {
  // 监听浏览器后退/前进
  window.addEventListener('popstate', (e) => {
    const path = e.state?.path || location.pathname || '/'
    const params = e.state?.params || {}
    handleRoute(path, params)
  })

  // TabBar 点击事件
  document.querySelectorAll('.tabbar-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const route = btn.dataset.route
      if (route) switchTab(route)
    })
  })

  // 初始路由
  const initPath = location.pathname || '/'
  const initParams = getCurrentParams()
  handleRoute(initPath, initParams)
}

export { handleRoute, updateTabBar }
