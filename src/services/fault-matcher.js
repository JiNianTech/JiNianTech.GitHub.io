// 故障匹配引擎 (前端版本)
// 合并自: cloudfunctions/fault-matcher/index.js + utils/fault-matcher.js
// 包含完整的 REPAIR_PLAYBOOK

import { severityWeight, moduleDisplayMap } from '../utils/util.js'
import { getKB } from './kb-loader.js'
import { parseLog } from './log-parser.js'

const matchEntry = (text, entry) => {
  const { keywords = [], regex = null } = entry.matchPattern || {}
  const lowered = text.toLowerCase()

  for (const kw of keywords) {
    if (!kw) continue
    if (lowered.includes(kw.toLowerCase())) {
      return { matched: true, score: 1.0, matchedBy: 'keyword', hitKeyword: kw, evidences: locateEvidence(text, kw, 'keyword') }
    }
  }

  if (regex) {
    try {
      if (new RegExp(regex, 'i').test(text)) {
        return { matched: true, score: 0.7, matchedBy: 'regex', hitKeyword: regex, evidences: locateEvidence(text, regex, 'regex') }
      }
    } catch (e) { /* invalid regex */ }
  }

  return { matched: false, score: 0, matchedBy: null }
}

const locateEvidence = (rawText, keyword, matchedBy) => {
  if (!rawText || !keyword) return null
  const lines = rawText.split(/\r?\n/)
  const kwLower = keyword.toLowerCase()
  const evidences = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let hit = false
    if (matchedBy === 'keyword') hit = line.toLowerCase().includes(kwLower)
    else { try { hit = new RegExp(keyword, 'i').test(line) } catch(e){} }
    if (hit) {
      evidences.push({
        lineNumber: i + 1,
        content: line.trim().slice(0, 300),
        contextBefore: i > 0 ? lines[i-1].trim().slice(0, 200) : null,
        contextAfter: i < lines.length - 1 ? lines[i+1].trim().slice(0, 200) : null
      })
      if (evidences.length >= 3) break
    }
  }
  return evidences.length ? evidences : null
}

const matchFaults = (logText, kb) => {
  const results = []
  if (!logText || !kb || !kb.categories) return results
  for (const category of kb.categories) {
    for (const entry of category.entries) {
      const m = matchEntry(logText, entry)
      if (m.matched) {
        results.push({
          categoryId: category.id, categoryName: category.name,
          entry, matchScore: m.score, matchedBy: m.matchedBy,
          hitKeyword: m.hitKeyword, evidences: m.evidences
        })
      }
    }
  }
  results.sort((a, b) => b.matchScore - a.matchScore)
  return results
}

const calcHealthScore = (faults) => {
  const modules = {}
  Object.keys(moduleDisplayMap).forEach(id => {
    modules[id] = {
      id, name: moduleDisplayMap[id].name, icon: moduleDisplayMap[id].icon,
      order: moduleDisplayMap[id].order,
      score: 100, status: 'normal', faults: [],
      isHardware: !['system_termination', 'exception_dispatcher'].includes(id)
    }
  })
  const rank = { normal: 0, info: 1, warning: 2, critical: 3 }
  for (const fault of faults) {
    const m = modules[fault.categoryId]
    if (!m) continue
    const severity = fault.entry.faultInfo?.severity || 'info'
    const deduct = (severityWeight[severity] || 0) * fault.matchScore
    m.score = Math.max(0, m.score - deduct)
    m.faults.push(fault)
    if (rank[severity] > rank[m.status]) m.status = severity === 'info' ? 'normal' : severity
  }
  const hardware = Object.values(modules).filter(m => m.isHardware)
  const disp = modules['display'], pw = modules['power'], cpu = modules['cpu_board']
  const other = hardware.filter(m => !['display', 'power', 'cpu_board'].includes(m.id))
  const weightedSum = disp.score * 2 + pw.score * 2 + cpu.score * 2 + other.reduce((s, m) => s + m.score, 0)
  const weightSum = 6 + other.length
  const overall = Math.round(weightedSum / weightSum)
  return {
    overall,
    overallStatus: overall >= 85 ? 'normal' : overall >= 60 ? 'warning' : 'critical',
    modules: Object.values(modules).sort((a, b) => a.order - b.order)
  }
}

const generateSummary = (parsedLog, faults, healthReport, kb) => {
  const modelName = parsedLog.device.model && kb.deviceModelMap
    ? (kb.deviceModelMap[parsedLog.device.model] || parsedLog.device.model)
    : (parsedLog.device.model || '未识别机型')

  const criticalCount = faults.filter(f => f.entry.faultInfo?.severity === 'critical').length
  const warningCount = faults.filter(f => f.entry.faultInfo?.severity === 'warning').length

  const nonHardwareOnly = faults.length > 0 && faults.every(f =>
    ['system_termination', 'exception_dispatcher'].includes(f.categoryId)
  )

  return {
    modelName, modelId: parsedLog.device.model,
    osVersion: parsedLog.device.osVersion, osBuild: parsedLog.device.osBuild,
    kernelVersion: parsedLog.device.kernelVersion, uptime: parsedLog.device.uptime,
    socRevision: parsedLog.device.socRevision, incidentId: parsedLog.incidentId,
    timestamp: parsedLog.timestamp, bugType: parsedLog.bugType,
    totalFaults: faults.length, criticalCount, warningCount,
    healthScore: healthReport.overall, healthStatus: healthReport.overallStatus,
    nonHardwareOnly, recommendation: nonHardwareOnly
      ? '⚠️ 检测到系统级/软件级问题，建议先排查软件因素，避免不必要的拆机'
      : criticalCount > 0 ? '🔴 检测到严重硬件故障，建议专业维修'
      : warningCount > 0 ? '🟡 检测到硬件警告，建议先排查外部配件'
      : faults.length === 0 ? '未匹配到已知故障，建议人工分析'
      : '🟢 未见严重问题'
  }
}

// ========== REPAIR PLAYBOOK ==========
const REPAIR_PLAYBOOK = {
  display: {
    icon: '🖥️',
    workflow: [
      { stage: 1, title: '外部排查（免拆机）', tools: '目视 + 硬件重启', steps: ['强制重启机器（音量+/音量-/长按侧键）观察屏幕是否点亮','连接充电器观察是否出现充电动画，判断屏幕是否完全无显示','外接测试屏或已知良好屏幕验证是否为屏幕本身问题'] },
      { stage: 2, title: '拆机检查排线', tools: '五角螺丝刀 · 塑料撬棒 · 显微镜', steps: ['拆开屏幕，检查屏幕排线是否有明显变色、氧化、进水痕迹','重新插拔排线座BTB（Board-to-Board），观察针脚是否变形','清洁座子内部灰尘/氧化物（无水酒精+洗板水）','重点检查听筒感光排线（DCP DATA ABORT高频关联）'] },
      { stage: 3, title: '主板级检测', tools: '万用表 · 示波器 · 显微镜 · 恒温加热台', steps: ['测量屏幕座供电（一般2.8V/5.7V），无电压检查升压电路','示波器抓取DCP至屏幕的MIPI差分信号是否完整','检测显示IC（Backlight IC/LM3697等）供电脚是否短路','重植/更换显示IC与相关电容电感'] },
      { stage: 4, title: 'BGA返修（深度）', tools: 'BGA工作台 · 热风枪 · 植球台 · 无铅锡球', steps: ['拆卸DCP相关芯片（PMU_DISPLAY / DCPAV），检查焊球','清洁植球位并重新植球','装回芯片，用助焊剂精准回流焊接','通电测试，观察DCP相关日志是否消失'] }
    ]
  },
  power: {
    icon: '⚡',
    workflow: [
      { stage: 1, title: '电池与充电线路检测', tools: '电池检测仪 · 万用表', steps: ['读取电池健康度和循环次数（<80%或循环>500建议换）','检查电池排线是否氧化，BTB座子针脚有无变形','万用表二极管挡测量电池座子对地阻值（正常约0.5-0.8V）'] },
      { stage: 2, title: '充电IC与电源管理', tools: '万用表 · 显微镜 · 热成像仪', steps: ['连接可调电源模拟电池，观察开机瞬间电流是否漏电（>50mA异常）','热成像定位漏电点（电源IC / TIGRIS / 快充IC）','检测CPU供电电感是否短路（一般0.3-0.5Ω，短路为0Ω）','重植或更换电源管理IC（PMIC/PMU）'] },
      { stage: 3, title: 'BGA级供电修复', tools: 'BGA工作台 · 热风枪 · X-Ray（可选）', steps: ['拆卸PMIC与CPU间的供电电容，检查是否击穿','若CPU供电电感发烫，重植CPU（虚焊）或更换电感','拆卸主电源管理芯片，清洁植球，回流焊装回'] }
    ]
  },
  cpu_board: {
    icon: '🔧',
    workflow: [
      { stage: 1, title: '免拆软件排查', tools: '刷机线 · 3uTools/爱思助手', steps: ['进入DFU模式使用最新iOS刷机，排除固件损坏','刷机后不激活直接观察是否再现panic','记录复现规律（时间/触发场景/频率）'] },
      { stage: 2, title: 'CPU物理检测', tools: '万用表 · 恒温加热台 · 显微镜', steps: ['按压CPU区域观察是否恢复正常（虚焊高度嫌疑）','万用表测量CPU供电脚电压（1.0-1.2V浮动）','恒温台加热至150°C观察panic是否消失（虚焊判定）','示波器抓取CPU时钟信号完整性（24MHz主晶振）'] },
      { stage: 3, title: 'BGA重植/植球', tools: 'BGA工作台 · 热风枪 · 植球台 · 无铅锡球 · 助焊剂', steps: ['预热主板至100°C，热风枪330°C拆卸CPU','清洁焊盘（洗板水+除锡编织带）','使用0.4mm/0.45mm无铅锡球重新植球','涂助焊剂后精准回流焊接CPU','装回后测试开机，观察panic日志'] },
      { stage: 4, title: '板层修复（深度）', tools: '万用表 · 显微镜 · 飞线工具', steps: ['若CPU与硬盘/基带间通讯异常，检测NAND供电','飞线修复断线（12 Pro/13系列常见板层断裂）','严重情况：搬板（CPU+硬盘整体移植到新板）'] }
    ]
  },
  storage: {
    icon: '💾',
    workflow: [
      { stage: 1, title: '软件层排查', tools: '3uTools/爱思助手', steps: ['刷机排除文件系统损坏','如刷机报错4014/9/40，硬盘物理损坏概率>80%','查看序列号/激活状态是否异常'] },
      { stage: 2, title: '硬盘物理检测', tools: '硬盘编程器 · 万用表', steps: ['硬盘编程器读取硬盘信息，判断是否可通讯','万用表测硬盘供电（1.8V/1.2V/3.3V）是否正常','测硬盘CLK时钟脚电压（无信号则通讯中断）'] },
      { stage: 3, title: '硬盘更换/扩容', tools: 'BGA工作台 · 硬盘编程器', steps: ['拆卸原硬盘，读取序列号数据（如可读）','写入至新硬盘（保留SN避免不激活）','植球并回流焊装回','刷机验证'] }
    ]
  },
  baseband: {
    icon: '📡',
    workflow: [
      { stage: 1, title: '免拆排查', tools: '3uTools', steps: ['查看基带版本是否异常（Modem Firmware）','刷机时选择保留基带的方式测试','检查是否为无信号/无服务/IMEI丢失'] },
      { stage: 2, title: '基带电路检测', tools: '万用表 · 示波器 · 热成像仪', steps: ['热成像定位是否有基带区域异常发热','测量基带供电（1.8V/1.0V）是否正常','示波器抓取基带CLK信号','检测天线开关IC与射频功放（PA）'] },
      { stage: 3, title: '基带芯片BGA返修', tools: 'BGA工作台 · 植球台', steps: ['拆卸基带芯片（Intel XMM/Qualcomm SDX）','清洁植球','装回并测试信号'] }
    ]
  },
  aop: {
    icon: '🔊',
    workflow: [
      { stage: 1, title: '外部配件排查', tools: '万用表', steps: ['更换振动器排线测试（AOP panic K2-bosch首选）','更换听筒/扬声器排线','检查Mic麦克风排线是否松动氧化','按顺序检查底部左Mic → 后置降噪Mic → 前置Mic'] },
      { stage: 2, title: 'AOP协处理器电路', tools: '万用表 · 显微镜', steps: ['测量AOP协处理器电源（一般1.8V）','检查前置泛光排线接口（AOP panic pressure相关）','检查气压传感器供电与信号线'] },
      { stage: 3, title: 'AOP芯片级维修', tools: 'BGA工作台', steps: ['重植音频编解码芯片（Cirrus Logic）','重植AOP协处理器（若为独立芯片）'] }
    ]
  },
  smc: {
    icon: '⚙️',
    workflow: [
      { stage: 1, title: '外部排查', tools: '万用表 · 3uTools', steps: ['刷机排除固件问题','检查电池排线与充电线路','记录复现场景（充电/待机/使用中）'] },
      { stage: 2, title: 'I2C 总线检测', tools: '示波器 · 万用表', steps: ['示波器抓取I2C时钟(SCL)/数据(SDA)波形','SMC i2cm0 → tristar充电IC故障','SMC i2cm1 (A11系) → 24M主时钟晶振','SMC i2cm1 (A12系) → 广角摄像头/屏幕'] },
      { stage: 3, title: '晶振/供电修复', tools: 'BGA工作台 · 万用表', steps: ['若涉及24M晶振，示波器验证震荡波形，无波形则更换','重植CPU供电电路电感/电容','严重情况：中层板搬板（掉点虚焊）'] }
    ]
  },
  sensor: {
    icon: '📐',
    workflow: [
      { stage: 1, title: '排线检查', tools: '塑料撬棒 · 显微镜', steps: ['重新插拔尾插排线（TriStar2高频关联）','检查尾插座子内是否有异物/氧化','更换尾插排线测试'] },
      { stage: 2, title: '气压计/主晶振', tools: '万用表 · 示波器', steps: ['测量气压计供电与数据线','若为Prs0，重点排查尾排','Initpoc exited等→主时钟晶振问题，示波器验证24M波形'] }
    ]
  }
}

const generateEngineerRepairPlan = (faults, parsedLog) => {
  if (faults.length === 0) {
    return {
      hasRepair: false,
      summary: '未匹配到已知故障。建议：① 收集完整日志重新分析 ② 记录复现规律 ③ 若确认异常，进入更深入的排查流程',
      mainConclusion: '', priorityModules: [], workflows: []
    }
  }

  const nonHardwareOnly = faults.every(f =>
    ['system_termination', 'exception_dispatcher'].includes(f.categoryId)
  )

  if (nonHardwareOnly) {
    return {
      hasRepair: false,
      summary: '⚠️ 检测到均为软件级问题（如Watchdog超时/EXC_CRASH等）',
      mainConclusion: '本机不建议拆机维修，属于软件/系统层面问题',
      priorityModules: [],
      softwareActions: [
        '让用户尝试重启（长按侧键+音量键强制重启）',
        '进入DFU模式使用3uTools/爱思助手保数据刷机',
        '如刷机后仍复现，让用户提供更多复现场景（是否与特定App相关）',
        '若排除软件因素后再出现panic，才需要考虑硬件排查'
      ],
      workflows: []
    }
  }

  const moduleFaultsMap = new Map()
  for (const f of faults) {
    if (!moduleFaultsMap.has(f.categoryId)) moduleFaultsMap.set(f.categoryId, [])
    moduleFaultsMap.get(f.categoryId).push(f)
  }

  const priorityModules = []
  const workflows = []

  const sortedModules = Array.from(moduleFaultsMap.entries()).sort((a, b) => {
    const sevA = Math.max(...a[1].map(f => f.entry.faultInfo?.severity === 'critical' ? 3 : 1))
    const sevB = Math.max(...b[1].map(f => f.entry.faultInfo?.severity === 'critical' ? 3 : 1))
    return sevB - sevA
  })

  for (const [moduleId, moduleFaults] of sortedModules) {
    if (['system_termination', 'exception_dispatcher', 'kernel_panic_types'].includes(moduleId)) continue

    const playbook = REPAIR_PLAYBOOK[moduleId]
    if (!playbook) continue

    const componentsSet = new Map()
    const faultTitles = []
    for (const f of moduleFaults) {
      faultTitles.push(f.entry.faultInfo.title)
      const comps = f.entry.faultInfo.affectedComponents || []
      for (const c of comps) {
        const existing = componentsSet.get(c.name)
        if (!existing || c.probability > existing.probability) {
          componentsSet.set(c.name, c)
        }
      }
    }

    const suspectedComponents = Array.from(componentsSet.values())
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5)
      .map(c => ({ name: c.name, percent: Math.round((c.probability || 0) * 100) }))

    priorityModules.push({
      id: moduleId, name: moduleDisplayMap[moduleId].name, icon: playbook.icon,
      severity: moduleFaults[0].entry.faultInfo?.severity || 'warning',
      faultCount: moduleFaults.length, faultTitles, suspectedComponents
    })

    workflows.push({
      icon: playbook.icon,
      moduleName: moduleDisplayMap[moduleId].name,
      moduleId,
      faultTitles,
      suspectedComponents,
      workflow: playbook.workflow
    })
  }

  const topSeverity = priorityModules.length > 0
    ? priorityModules.some(m => m.severity === 'critical') ? 'critical' : 'warning'
    : 'info'

  return {
    hasRepair: true,
    summary: topSeverity === 'critical'
      ? '检测到严重硬件故障，建议按以下优先级逐步排查'
      : '检测到硬件警告，建议从外部配件开始排查',
    mainConclusion: '',
    priorityModules,
    workflows
  }
}

/**
 * 主诊断入口
 * @param {string} rawText 原始日志文本
 * @returns 完整诊断结果
 */
export function diagnose(rawText) {
  const kb = getKB()
  if (!kb) throw new Error('知识库未加载')

  const parseResult = parseLog(rawText)
  if (!parseResult.success) throw new Error(parseResult.error)

  const parsed = parseResult.parsed

  // 匹配故障
  const faults = matchFaults(parsed.rawText, kb)

  // 健康度评分
  const health = calcHealthScore(faults)

  // 生成摘要
  const summary = generateSummary(parsed, faults, health, kb)

  // 维修方案
  const repairPlan = generateEngineerRepairPlan(faults, parsed)

  return { parsed, faults, health, summary, repairPlan }
}

export { matchFaults, calcHealthScore, generateSummary, generateEngineerRepairPlan }
