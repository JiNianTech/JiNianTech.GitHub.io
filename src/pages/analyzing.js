// 诊断中页 (转换自 pages/analyzing/analyzing)
import { redirectTo, navigateBack } from '../router.js'
import { getCurrentDiagnosis, setCurrentDiagnosis } from '../app.js'
import { batchOCR } from '../services/ocr.js'
import { parseLog } from '../services/log-parser.js'
import { diagnose } from '../services/fault-matcher.js'
import { saveHistory } from '../services/storage.js'
import { formatTime } from '../utils/util.js'

export async function render(params, container) {
  const diag = getCurrentDiagnosis()
  if (!diag) {
    container.innerHTML = `<div class="page-container text-center mt-32"><p>缺少诊断数据</p><button class="btn-primary" id="btn-back">返回首页</button></div>`
    container.querySelector('#btn-back')?.addEventListener('click', () => redirectTo('/'))
    return
  }

  const inputMode = diag.inputMode || 'image'
  const isText = inputMode === 'text'
  const stepLabels = isText ? [
    { label: '结构化解析', desc: '提取设备信息与关键字段' },
    { label: '故障匹配', desc: '对照107条知识库规则' },
    { label: '生成建议', desc: '分级修复建议与排查步骤' }
  ] : [
    { label: 'OCR识别', desc: '解析日志图片文字' },
    { label: '结构化解析', desc: '提取设备信息与关键字段' },
    { label: '故障匹配', desc: '对照107条知识库规则' },
    { label: '生成建议', desc: '分级修复建议与排查步骤' }
  ]

  container.innerHTML = `
    <div class="page-container" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;">
      <div style="text-align:center;margin-bottom:1.5rem;">
        <div style="font-size:3rem;margin-bottom:0.5rem;">🔬</div>
        <h2 style="font-weight:600;">正在诊断...</h2>
        <p style="color:var(--text-muted);font-size:0.8125rem;" id="diag-id">编号: ${diag.diagnosisId}</p>
      </div>

      <div id="steps-container" style="width:100%;max-width:20rem;">
        ${stepLabels.map((s, i) => `
          <div class="step-row" data-step="${i}" style="display:flex;align-items:flex-start;gap:0.75rem;padding:0.75rem;margin-bottom:0.5rem;background:var(--card-bg);border-radius:0.75rem;opacity:0.5;transition:all 0.3s;">
            <div class="step-icon" style="width:2rem;height:2rem;border-radius:50%;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;font-size:0.875rem;">${String(i+1)}</div>
            <div>
              <div class="step-label" style="font-size:0.875rem;font-weight:500;">${s.label}</div>
              <div class="step-desc" style="font-size:0.75rem;color:var(--text-muted);">${s.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <div id="error-area" style="display:none;margin-top:1rem;text-align:center;">
        <p style="color:var(--color-critical);margin-bottom:0.75rem;" id="error-msg"></p>
        <button class="btn-primary" id="btn-retry">🔄 重试</button>
        <button class="btn-ghost" id="btn-back-err" style="margin-top:0.5rem;">返回修改</button>
      </div>
    </div>
  `

  const stepRows = container.querySelectorAll('.step-row')

  const updateStep = (index, status) => {
    stepRows.forEach((row, i) => {
      if (i === index && status === 'running') {
        row.style.opacity = '1'
        row.style.borderLeft = '3px solid var(--color-blue)'
        row.querySelector('.step-icon').style.background = 'rgba(59,130,246,0.2)'
        row.querySelector('.step-icon').style.color = 'var(--color-blue)'
        row.querySelector('.step-icon').innerHTML = '<div class="loading-dots"><span></span></div>'
      } else if (i === index && status === 'done') {
        row.style.opacity = '1'
        row.style.borderLeft = '3px solid var(--color-normal)'
        row.querySelector('.step-icon').style.background = 'rgba(16,185,129,0.2)'
        row.querySelector('.step-icon').style.color = 'var(--color-normal)'
        row.querySelector('.step-icon').textContent = '✓'
      } else if (i === index && status === 'error') {
        row.style.opacity = '1'
        row.style.borderLeft = '3px solid var(--color-critical)'
        row.querySelector('.step-icon').style.background = 'rgba(239,68,68,0.2)'
        row.querySelector('.step-icon').style.color = 'var(--color-critical)'
        row.querySelector('.step-icon').textContent = '✕'
      }
    })
  }

  const showError = (msg) => {
    container.querySelector('#error-area').style.display = 'block'
    container.querySelector('#error-msg').textContent = msg
  }

  const runPipeline = async () => {
    try {
      let rawText = ''

      if (isText) {
        // 跳过 OCR，直接使用粘贴文本
        rawText = diag.rawText
      } else {
        // OCR 识别
        updateStep(0, 'running')
        const files = diag.images || []
        const ocrResult = await batchOCR(files, (p) => {})
        if (!ocrResult.mergedText || ocrResult.mergedText.trim().length < 20) {
          throw new Error('OCR 未能识别到有效文本')
        }
        rawText = ocrResult.mergedText
        updateStep(0, 'done')
      }

      const parseIdx = isText ? 0 : 1

      // 结构化解析
      updateStep(parseIdx, 'running')
      const parseResult = parseLog(rawText)
      if (!parseResult.success) throw new Error(parseResult.error || '解析失败')
      updateStep(parseIdx, 'done')

      // 故障匹配
      updateStep(parseIdx + 1, 'running')
      const diagData = diagnose(rawText)
      updateStep(parseIdx + 1, 'done')

      // 生成建议
      updateStep(parseIdx + 2, 'running')

      const diagnosis = {
        diagnosisId: diag.diagnosisId,
        inputMode: diag.inputMode,
        createdAt: Date.now(),
        createdAtStr: formatTime(new Date()),
        rawText,
        parsed: diagData.parsed,
        faults: diagData.faults,
        health: diagData.health,
        summary: diagData.summary,
        repairPlan: diagData.repairPlan
      }

      setCurrentDiagnosis(diagnosis)

      // 保存历史
      try { await saveHistory(diagnosis) } catch (e) { console.warn('Save history failed:', e) }

      updateStep(parseIdx + 2, 'done')

      // 跳转到仪表盘
      setTimeout(() => redirectTo('/dashboard', { id: diag.diagnosisId }), 500)

    } catch (err) {
      const currentStep = stepLabels.findIndex((_, i) => {
        const row = stepRows[i]
        return row.querySelector('.step-icon')?.querySelector('.loading-dots')
      })
      if (currentStep >= 0) updateStep(currentStep, 'error')
      showError(err.message || '诊断失败')
    }
  }

  // 重试
  container.querySelector('#btn-retry')?.addEventListener('click', () => {
    container.querySelector('#error-area').style.display = 'none'
    // 重置步骤
    stepRows.forEach((row) => {
      row.style.opacity = '0.5'
      row.style.borderLeft = 'none'
      row.querySelector('.step-icon').style.background = 'rgba(255,255,255,0.06)'
      row.querySelector('.step-icon').style.color = ''
      row.querySelector('.step-icon').textContent = String(Array.from(stepRows).indexOf(row) + 1)
    })
    updateStep(0, 'running')
    runPipeline()
  })

  container.querySelector('#btn-back-err')?.addEventListener('click', () => redirectTo('/upload'))

  // 启动
  runPipeline()
}
