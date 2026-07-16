// 仪表盘 (转换自 pages/dashboard/dashboard)
import { redirectTo, navigateTo } from '../router.js'
import { getCurrentDiagnosis, clearCurrentDiagnosis } from '../app.js'
import { severityMap } from '../utils/util.js'
import { showToast } from '../components/toast.js'

export async function render(params, container) {
  const diag = getCurrentDiagnosis()
  if (!diag) {
    container.innerHTML = `<div class="page-container text-center mt-32"><p>诊断数据丢失</p><button class="btn-primary" id="btn-home">返回首页</button></div>`
    container.querySelector('#btn-home')?.addEventListener('click', () => redirectTo('/'))
    return
  }

  const triageIds = ['system_termination', 'exception_dispatcher']
  const modulesWithData = diag.health.modules.map(m => ({
    ...m,
    faultCount: m.faults?.length || 0,
    severityInfo: severityMap[m.status] || severityMap.normal
  }))

  const hardwareModules = modulesWithData.filter(m => !triageIds.includes(m.id))
  const triageModules = modulesWithData.filter(m => triageIds.includes(m.id) && m.faultCount > 0)

  const scoreColor = diag.health.overallStatus === 'normal' ? '#10B981' : diag.health.overallStatus === 'warning' ? '#F59E0B' : '#EF4444'
  const statusLabel = diag.health.overallStatus === 'normal' ? '状态良好' : diag.health.overallStatus === 'warning' ? '需要关注' : '需要维修'

  container.innerHTML = `
    <div class="page-container">
      <!-- 顶部 -->
      <div style="text-align:center;padding:1rem 0;">
        <div style="font-size:2.5rem;margin-bottom:0.25rem;">📱</div>
        <h2 style="font-weight:600;">${diag.summary.modelName || '未识别'}</h2>
        <p style="color:var(--text-muted);font-size:0.75rem;">${diag.summary.osVersion || ''} · ${diag.summary.bugType?.typeCN || ''}</p>
      </div>

      <!-- 健康度环形图 -->
      <div class="card" style="text-align:center;">
        <div style="position:relative;width:12rem;height:12rem;margin:0 auto 1rem;">
          <svg viewBox="0 0 200 200" style="transform:rotate(-90deg);">
            <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="16"/>
            <circle cx="100" cy="100" r="85" fill="none" stroke="${scoreColor}" stroke-width="16"
              stroke-dasharray="${diag.health.overall * 5.34} 534" stroke-linecap="round"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <span style="font-size:3rem;font-weight:800;color:#fff;line-height:1;">${diag.health.overall}</span>
            <span style="color:var(--text-muted);font-size:0.75rem;">/ 100</span>
          </div>
        </div>
        <div style="display:inline-block;padding:0.375rem 1rem;border-radius:999px;font-weight:600;font-size:0.8125rem;background:${scoreColor}22;color:${scoreColor};border:1px solid ${scoreColor}55;">${statusLabel}</div>

        <div style="margin-top:0.75rem;padding:0.75rem;background:${scoreColor}15;border-radius:0.75rem;font-size:0.75rem;color:var(--text-primary);">${diag.summary.recommendation}</div>

        <div style="display:flex;justify-content:center;gap:1.5rem;margin-top:0.75rem;">
          <div><span style="color:#EF4444;font-weight:700;">${diag.summary.criticalCount}</span><span style="color:var(--text-muted);font-size:0.6875rem;"> 严重</span></div>
          <div><span style="color:#F59E0B;font-weight:700;">${diag.summary.warningCount}</span><span style="color:var(--text-muted);font-size:0.6875rem;"> 警告</span></div>
          <div><span style="color:#3B82F6;font-weight:700;">${diag.summary.totalFaults}</span><span style="color:var(--text-muted);font-size:0.6875rem;"> 总故障</span></div>
        </div>
      </div>

      <!-- 分诊警示 -->
      ${triageModules.length > 0 ? `
        <div class="card" style="border:1px solid rgba(59,130,246,0.35);background:rgba(59,130,246,0.05);">
          <div style="display:flex;gap:0.5rem;align-items:flex-start;margin-bottom:0.5rem;">
            <span style="font-size:1.5rem;">⚠️</span>
            <div>
              <div style="font-weight:600;">检测到系统级/软件问题</div>
              <div style="color:#93C5FD;font-size:0.75rem;">拆机前请务必先排查以下软件因素</div>
            </div>
          </div>
          ${triageModules.map(m => `
            <div style="padding:0.625rem;background:rgba(0,0,0,0.25);border-radius:0.625rem;margin-bottom:0.375rem;display:flex;justify-content:space-between;">
              <span>${m.icon} ${m.name}</span>
              <span style="color:#93C5FD;">${m.faultCount} 项</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- 六大模块 -->
      <div class="card-title" style="margin-top:0.5rem;">硬件模块</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1rem;">
        ${hardwareModules.map(m => `
          <div class="card module-card" data-module="${m.id}" style="padding:0.75rem;cursor:pointer;border-color:${m.severityInfo.color}44;">
            <div style="display:flex;align-items:center;gap:0.375rem;margin-bottom:0.375rem;">
              <span style="font-size:1.25rem;">${m.icon}</span>
              <span style="font-size:0.75rem;font-weight:500;">${m.name}</span>
            </div>
            <div style="font-size:1.125rem;font-weight:700;color:${m.severityInfo.color};margin:0.25rem 0;">${m.score}</div>
            <div style="height:0.25rem;background:rgba(255,255,255,0.06);border-radius:0.125rem;">
              <div style="height:100%;width:${m.score}%;background:${m.severityInfo.color};border-radius:0.125rem;transition:width 0.5s;"></div>
            </div>
            <div style="font-size:0.625rem;color:var(--text-muted);margin-top:0.25rem;">${m.faultCount > 0 ? m.faultCount + ' 项故障' : '未检出'}</div>
          </div>
        `).join('')}
      </div>

      <!-- 操作按钮 -->
      <button class="btn-primary" id="btn-report" style="width:100%;margin-bottom:0.5rem;">📊 查看完整报告</button>
      <button class="btn-secondary" id="btn-rediagnose" style="width:100%;">🔄 重新诊断</button>
    </div>
  `

  // 模块点击
  container.querySelectorAll('.module-card').forEach(card => {
    card.addEventListener('click', () => navigateTo('/module-detail', { moduleId: card.dataset.module }))
  })

  container.querySelector('#btn-report')?.addEventListener('click', () => navigateTo('/report'))
  container.querySelector('#btn-rediagnose')?.addEventListener('click', () => {
    clearCurrentDiagnosis()
    redirectTo('/upload')
  })
}
