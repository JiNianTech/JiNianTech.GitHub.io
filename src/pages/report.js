// 完整报告页 (转换自 pages/report/report)
import { getCurrentDiagnosis } from '../app.js'
import { showToast, showActionSheet } from '../components/toast.js'
import { esc } from '../utils/util.js'
import { navigateBack } from '../router.js'

export async function render(params, container) {
  const d = getCurrentDiagnosis()
  if (!d) {
    container.innerHTML = `<div class="page-container text-center"><p>数据丢失</p></div>`
    return
  }

  const faultsWithDetails = (d.faults || []).map(f => ({
    ...f,
    info: f.entry.faultInfo,
    components: (f.entry.faultInfo?.affectedComponents || []).map(c => ({
      ...c, percent: Math.round((c.probability || 0) * 100)
    })),
    evidencesCount: (f.evidences || []).length
  }))

  const rawText = d.rawText || ''

  container.innerHTML = `
    <div class="page-container">
      <div class="page-header" style="display:flex;align-items:center;gap:0.5rem;">
        <button class="btn-ghost" id="btn-back" style="padding:0.25rem 0;">← 返回</button>
        <h1 style="font-size:1.25rem;margin:0;flex:1;">📊 诊断报告</h1>
      </div>

      <!-- 操作按钮 -->
      <div style="display:flex;gap:0.5rem;margin-bottom:1rem;">
        <button class="btn-secondary" id="btn-export" style="flex:1;">📤 导出</button>
        <button class="btn-secondary" id="btn-copy" style="flex:1;">📋 复制</button>
        <button class="btn-secondary" id="btn-html" style="flex:1;">🌐 HTML</button>
      </div>

      <!-- 设备信息 -->
      <div class="card">
        <div class="card-title">📱 设备信息</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.375rem 1rem;font-size:0.8125rem;">
          ${renderInfoRow('设备型号', d.summary.modelName)}
          ${renderInfoRow('Hardware', d.summary.modelId, true)}
          ${renderInfoRow('系统版本', d.summary.osVersion)}
          ${renderInfoRow('编译版本', d.summary.osBuild, true)}
          ${renderInfoRow('内核', truncateS(d.summary.kernelVersion, 30), true)}
          ${renderInfoRow('运行时长', d.summary.uptime)}
          ${renderInfoRow('重启时间', d.summary.timestamp)}
          ${renderInfoRow('日志类型', d.summary.bugType?.typeCN + ' (bug_type ' + d.summary.bugType?.code + ')')}
          ${d.summary.incidentId ? renderInfoRow('Incident ID', d.summary.incidentId, true) : ''}
          ${d.summary.socRevision ? renderInfoRow('SoC版本', 'Rev ' + d.summary.socRevision) : ''}
        </div>
      </div>

      <!-- 诊断结果 -->
      <div class="card">
        <div class="card-title">🏥 诊断结果</div>
        <div style="margin-bottom:0.75rem;">${d.summary.recommendation}</div>
        <div style="display:flex;gap:1.5rem;font-size:0.8125rem;">
          <span style="color:#EF4444;">🔴 严重: ${d.summary.criticalCount}</span>
          <span style="color:#F59E0B;">🟡 警告: ${d.summary.warningCount}</span>
          <span style="color:#3B82F6;">📋 总计: ${d.summary.totalFaults}</span>
        </div>
      </div>

      <!-- 维修方案 -->
      ${d.repairPlan ? renderRepairPlan(d.repairPlan) : ''}

      <!-- 故障详情 -->
      <div class="card-title" style="margin-top:1rem;">🔍 故障详情</div>
      <div id="fault-list">
        ${faultsWithDetails.map((f, i) => renderFaultCard(f, i)).join('')}
      </div>

      <!-- 原始日志 -->
      <button class="btn-secondary" id="btn-rawlog" style="width:100%;margin-top:1rem;">📄 查看原始日志 (${rawText.length} 字符)</button>
      <div id="rawlog-section" style="display:none;margin-top:0.75rem;">
        <div class="code-block" style="max-height:20rem;overflow-y:auto;">${esc(rawText.length > 5000 ? rawText.slice(0, 5000) + '...' : rawText)}</div>
        <button class="btn-secondary" id="btn-copy-raw" style="width:100%;margin-top:0.5rem;">📋 复制原始日志</button>
      </div>
    </div>
  `

  // 事件绑定
  container.querySelector('#btn-back')?.addEventListener('click', () => navigateBack())

  // 导出
  container.querySelector('#btn-export')?.addEventListener('click', async () => {
    const idx = await showActionSheet(['复制到剪贴板', '导出 TXT', '导出 HTML'])
    if (idx.tapIndex === 0) copyReport()
    else if (idx.tapIndex === 1) exportTxt()
    else if (idx.tapIndex === 2) exportHtml()
  })

  container.querySelector('#btn-copy')?.addEventListener('click', copyReport)
  container.querySelector('#btn-html')?.addEventListener('click', exportHtml)

  // 原始日志展开
  container.querySelector('#btn-rawlog')?.addEventListener('click', () => {
    const section = container.querySelector('#rawlog-section')
    section.style.display = section.style.display === 'none' ? 'block' : 'none'
  })

  container.querySelector('#btn-copy-raw')?.addEventListener('click', () => {
    navigator.clipboard.writeText(rawText).then(() => showToast('已复制'))
  })

  function copyReport() {
    navigator.clipboard.writeText(buildReportText(d)).then(() => showToast('报告已复制'))
  }

  function exportTxt() {
    const blob = new Blob([buildReportText(d)], { type: 'text/plain;charset=utf-8' })
    downloadBlob(blob, `iPhone_report_${d.diagnosisId}.txt`)
  }

  function exportHtml() {
    const html = buildHtmlReport(d)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    downloadBlob(blob, `iPhone_report_${d.diagnosisId}.html`)
  }
}

// ===== 辅助渲染函数 =====

function renderInfoRow(label, value, mono = false) {
  if (!value) return ''
  return `<div style="display:flex;justify-content:space-between;padding:0.25rem 0;border-bottom:1px solid rgba(255,255,255,0.04);">
    <span style="color:var(--text-muted);">${label}</span>
    <span style="${mono ? 'font-family:var(--font-mono);color:#7DD3FC;font-size:0.75rem;' : ''}text-align:right;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(value)}</span>
  </div>`
}

function truncateS(str, len) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '...' : str
}

function renderRepairPlan(plan) {
  let html = '<div class="card"><div class="card-title">🔧 维修方案</div>'
  if (plan.mainConclusion) html += `<div style="padding:0.75rem;background:rgba(59,130,246,0.1);border-left:3px solid #3B82F6;border-radius:0.5rem;color:#93C5FD;margin-bottom:0.75rem;">${esc(plan.mainConclusion)}</div>`
  html += `<div style="color:#9CA3AF;font-size:0.8125rem;margin-bottom:0.75rem;">${esc(plan.summary)}</div>`

  if (plan.softwareActions) {
    html += `<div style="font-weight:600;margin-bottom:0.5rem;">📋 软件排查步骤</div><ol style="padding-left:1.25rem;font-size:0.8125rem;line-height:1.6;">`
    plan.softwareActions.forEach(s => html += `<li>${esc(s)}</li>`)
    html += `</ol>`
  }

  if (plan.hasRepair && plan.priorityModules) {
    html += `<div style="font-weight:600;margin:0.75rem 0 0.5rem;">🎯 优先维修模块</div>`
    plan.priorityModules.forEach((m, i) => {
      const mColor = m.severity === 'critical' ? '#EF4444' : '#F59E0B'
      html += `<div style="padding:0.75rem;margin-bottom:0.5rem;border:1px solid ${mColor}44;border-radius:0.75rem;background:${mColor}0d;">
        <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;">
          <span style="width:1.5rem;height:1.5rem;border-radius:50%;background:rgba(59,130,246,0.15);color:#60A5FA;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.75rem;">${i+1}</span>
          <span style="font-size:1.25rem;">${m.icon}</span>
          <span style="font-weight:600;">${esc(m.name)}</span>
          <span style="margin-left:auto;padding:0.25rem 0.625rem;border-radius:0.5rem;font-size:0.6875rem;background:${mColor}22;color:${mColor};">${m.severity === 'critical' ? '严重' : '警告'}</span>
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.5rem;">${esc(m.faultTitles?.join(' · ') || '')}</div>
        <div style="display:flex;flex-wrap:wrap;gap:0.375rem;">
          <span style="font-size:0.6875rem;color:var(--text-muted);">嫌疑元件:</span>
          ${(m.suspectedComponents || []).map(c => `<span style="padding:0.25rem 0.5rem;background:rgba(59,130,246,0.12);border-radius:0.375rem;font-size:0.6875rem;color:#93C5FD;">${esc(c.name)} <b>${c.percent}%</b></span>`).join('')}
        </div>
      </div>`
    })

    // 工作流
    if (plan.workflows?.length) {
      html += `<div style="font-weight:600;margin:0.75rem 0 0.5rem;">📖 分阶段维修流程</div>`
      plan.workflows.forEach(wf => {
        html += `<div style="padding:0.75rem;margin-bottom:0.5rem;background:var(--card-bg);border-radius:0.75rem;">
          <div style="font-weight:600;margin-bottom:0.75rem;">${wf.icon} ${esc(wf.moduleName)}</div>`
        wf.workflow.forEach(stg => {
          html += `<div style="margin-bottom:0.75rem;padding-left:0.5rem;border-left:2px solid rgba(59,130,246,0.3);">
            <div style="font-weight:500;margin-bottom:0.25rem;">
              <span style="padding:0.125rem 0.5rem;background:rgba(59,130,246,0.15);color:#60A5FA;border-radius:0.375rem;font-size:0.6875rem;">Stage ${stg.stage}</span>
              <span style="margin-left:0.5rem;">${esc(stg.title)}</span>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.25rem;">🛠️ ${esc(stg.tools)}</div>
            <ol style="padding-left:1rem;font-size:0.75rem;line-height:1.5;">${stg.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
          </div>`
        })
        html += `</div>`
      })
    }
  }
  html += `</div>`
  return html
}

function renderFaultCard(f, i) {
  const c = { critical: '#EF4444', warning: '#F59E0B', info: '#3B82F6', normal: '#10B981' }[f.info.severity] || '#3B82F6'
  return `<div class="card" style="border-left:3px solid ${c};margin-bottom:0.75rem;">
    <div style="display:flex;gap:0.75rem;align-items:center;margin-bottom:0.375rem;">
      <span style="width:1.5rem;height:1.5rem;border-radius:50%;background:${c}22;color:${c};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.6875rem;">${i+1}</span>
      <span style="font-size:0.75rem;color:var(--text-muted);">${esc(f.categoryName)}</span>
      <span class="tag" style="background:${c}22;color:${c};">${f.info.severity === 'critical' ? '严重' : f.info.severity === 'warning' ? '警告' : '提示'}</span>
    </div>
    <div style="font-weight:600;margin-bottom:0.375rem;">${esc(f.info.title)}</div>
    <div style="color:#9CA3AF;font-size:0.75rem;margin-bottom:0.5rem;">${esc(f.info.description)}</div>
    <div style="font-size:0.6875rem;color:var(--text-muted);">命中: <code style="background:rgba(59,130,246,0.1);padding:0.125rem 0.375rem;border-radius:0.25rem;color:#7DD3FC;">${esc(f.hitKeyword)}</code></div>
  </div>`
}

function buildReportText(d) {
  const lines = [
    '════════════════════════════════════════',
    '       iPhone 诊断报告',
    '════════════════════════════════════════',
    '', `诊断编号: ${d.diagnosisId}`, `诊断时间: ${d.createdAtStr}`,
    `输入方式: ${d.inputMode === 'text' ? '粘贴文本' : '图片OCR'}`,
    '', '━━━━━━━━━━ 设备信息 ━━━━━━━━━━',
    `设备型号: ${d.summary.modelName}`, `Hardware: ${d.summary.modelId || '未识别'}`,
    `系统版本: ${d.summary.osVersion || '未识别'}`, `编译版本: ${d.summary.osBuild || '未识别'}`,
    `内核版本: ${d.summary.kernelVersion || '未识别'}`,
    `运行时长: ${d.summary.uptime || '未识别'}`,
    `重启时间: ${d.summary.timestamp || '未识别'}`,
    '', '━━━━━━━━━━ 日志分析 ━━━━━━━━━━',
    `日志类型: ${d.summary.bugType.typeCN} (bug_type ${d.summary.bugType.code})`,
    '', '━━━━━━━━━━ 诊断结果 ━━━━━━━━━━',
    `整机健康度: ${d.health.overall}/100`, `建议: ${d.summary.recommendation}`,
    `故障: 严重${d.summary.criticalCount} 警告${d.summary.warningCount} 总计${d.summary.totalFaults}`,
    '', '════════════════════════════════════════',
    'iPhone故障诊断工具 — 数据来源：纪年科技维修手册 · Apple Developer Documentation'
  ]
  return lines.join('\n')
}

function buildHtmlReport(d) {
  // 简化版 HTML，完整版太长了
  const statusColor = { normal: '#10B981', warning: '#F59E0B', critical: '#EF4444' }
  const sc = statusColor[d.health.overallStatus] || '#3B82F6'

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>iPhone诊断报告 · ${esc(d.summary.modelName)}</title></head><body style="font-family:-apple-system,PingFang SC;background:#0A1628;color:#E5EAF0;padding:24px;"><h1>iPhone 诊断报告</h1><h2>${esc(d.summary.modelName)} · 健康度 ${d.health.overall}/100</h2><pre style="background:#050B14;padding:16px;border-radius:8px;font-size:12px;color:#7DD3FC;overflow-x:auto;">${esc(d.rawText.slice(0, 5000))}</pre></body></html>`
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showToast('下载中...', 'success')
}
