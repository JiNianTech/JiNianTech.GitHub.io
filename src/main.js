// 应用入口 — 初始化路由、加载页面

import { initRouter, registerRoute } from './router.js'
import { getHistory } from './services/storage.js'
import { setState } from './app.js'

// 延迟导入页面模块 (按需加载)
const pageModules = {
  '/': () => import('./pages/index.js'),
  '/upload': () => import('./pages/upload.js'),
  '/analyzing': () => import('./pages/analyzing.js'),
  '/dashboard': () => import('./pages/dashboard.js'),
  '/module-detail': () => import('./pages/module-detail.js'),
  '/report': () => import('./pages/report.js'),
  '/history': () => import('./pages/history.js'),
  '/knowledge': () => import('./pages/knowledge.js')
}

// 页面内容容器
const pageContent = document.getElementById('page-content')

/**
 * 渲染页面
 */
async function renderPage(path, params) {
  if (!pageContent) return

  // 显示加载状态
  pageContent.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:60vh;"><div class="loading-dots"><span></span><span></span><span></span></div></div>'

  try {
    const loader = pageModules[path]
    if (!loader) {
      pageContent.innerHTML = '<div class="page-container text-center mt-32"><p>页面不存在</p></div>'
      return
    }

    const module = await loader()
    if (module.render) {
      await module.render(params, pageContent)
    }
  } catch (err) {
    console.error('Page render error:', err)
    pageContent.innerHTML = `<div class="page-container text-center mt-32"><p>页面加载失败: ${err.message}</p></div>`
  }
}

/**
 * 应用启动
 */
async function init() {
  // 注册所有路由
  Object.keys(pageModules).forEach(path => {
    registerRoute(path, (params) => renderPage(path, params))
  })

  // 加载历史记录到全局状态
  try {
    const history = await getHistory()
    setState({ history })
  } catch (e) {
    console.warn('Failed to load history:', e)
  }

  // 初始化路由 (会触发初始页面渲染)
  initRouter()
}

// 启动
init()
