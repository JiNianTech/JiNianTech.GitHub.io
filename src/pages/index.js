// 首页 (转换自 pages/index/index)
import { navigateTo, switchTab } from '../router.js'
import { getState } from '../app.js'

export async function render(params, container) {
  const state = getState()

  container.innerHTML = `
    <div class="page-container">
      <!-- Hero -->
      <div style="text-align:center;padding:1.5rem 0 1rem;">
        <div style="font-size:3.5rem;margin-bottom:0.75rem;">🔬</div>
        <h1 style="font-size:1.5rem;font-weight:700;color:#fff;margin-bottom:0.25rem;">iPhone 故障诊断</h1>
        <p style="color:var(--text-muted);font-size:0.8125rem;">维修工程师专业工具 · ${state.kbVersion}版</p>
      </div>

      <!-- 功能卡片 -->
      <div class="card" style="margin-bottom:1.5rem;">
        <div class="card-subtitle">知识库概况</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
          <div style="text-align:center;padding:0.75rem;background:rgba(59,130,246,0.1);border-radius:0.75rem;">
            <div style="font-size:1.5rem;font-weight:700;color:var(--color-blue);">107</div>
            <div style="font-size:0.6875rem;color:var(--text-muted);">诊断规则</div>
          </div>
          <div style="text-align:center;padding:0.75rem;background:rgba(16,185,129,0.1);border-radius:0.75rem;">
            <div style="font-size:1.5rem;font-weight:700;color:var(--color-normal);">42</div>
            <div style="font-size:0.6875rem;color:var(--text-muted);">款机型识别</div>
          </div>
        </div>
      </div>

      <!-- 特性列表 -->
      <div class="card" style="margin-bottom:2rem;">
        <div class="card-subtitle">核心能力</div>
        ${[
          { icon: '📱', title: '截图/粘贴日志 → 秒级诊断', desc: '上传iPhone分析数据截图或粘贴panic日志文本' },
          { icon: '🎯', title: '组件级维修定位', desc: '精确到排线/IC/晶振，概率+排查优先级' },
          { icon: '⚠️', title: '软件分诊避免误拆', desc: '自动区分软件崩溃与硬件故障，减少无效拆机' },
          { icon: '📊', title: '健康度评分 + 维修流程', desc: '分阶段维修步骤 + 工具清单 + 判断标准' }
        ].map(f => `
          <div style="display:flex;gap:0.75rem;padding:0.625rem 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:1.5rem;flex-shrink:0;">${f.icon}</span>
            <div>
              <div style="font-weight:600;font-size:0.875rem;">${f.title}</div>
              <div style="color:var(--text-muted);font-size:0.75rem;margin-top:0.125rem;">${f.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- CTA 按钮 -->
      <button class="btn-primary" id="btn-start" style="width:100%;margin-bottom:0.75rem;font-size:1.0625rem;gap:0.5rem;">
        🔍 开始诊断
      </button>
      <div style="display:flex;gap:0.75rem;">
        <button class="btn-secondary" id="btn-history" style="flex:1;">📋 诊断记录</button>
        <button class="btn-secondary" id="btn-knowledge" style="flex:1;">📚 知识库</button>
      </div>

      <div style="text-align:center;margin-top:2rem;color:var(--text-muted);font-size:0.6875rem;">
        数据来源：纪年科技维修手册 · Apple TN2151 · WWDC18/414
      </div>
    </div>
  `

  // 绑定事件
  container.querySelector('#btn-start')?.addEventListener('click', () => navigateTo('/upload'))
  container.querySelector('#btn-history')?.addEventListener('click', () => switchTab('/history'))
  container.querySelector('#btn-knowledge')?.addEventListener('click', () => switchTab('/knowledge'))
}
