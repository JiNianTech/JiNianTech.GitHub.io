// 日志解析器 — 从OCR文本中提取结构化字段
// 合并自: cloudfunctions/log-analyzer/index.js + utils/log-parser.js

const detectBugType = (text) => {
  const t = text.toLowerCase()
  if (/"?bug[_ ]?type"?\s*[:=]\s*"?210/i.test(text) || /panic-full|panic\(cpu/i.test(t)) {
    return { code: '210', type: 'Kernel Panic', typeCN: '内核崩溃', hardwareRelated: '高' }
  }
  if (/"?bug[_ ]?type"?\s*[:=]\s*"?198/i.test(text) || /jetsam/i.test(t)) {
    return { code: '198', type: 'JetsamEvent', typeCN: '内存压力事件', hardwareRelated: '低' }
  }
  if (/"?bug[_ ]?type"?\s*[:=]\s*"?145/i.test(text) || /resetcounter/i.test(t)) {
    return { code: '145', type: 'ResetCounter', typeCN: '异常重启计数', hardwareRelated: '辅助' }
  }
  if (/"?bug[_ ]?type"?\s*[:=]\s*"?288/i.test(text) || /exc_resource/i.test(t)) {
    return { code: '288', type: 'CPU Resource Exception', typeCN: 'CPU资源超限', hardwareRelated: '无' }
  }
  if (/"?bug[_ ]?type"?\s*[:=]\s*"?309/i.test(text)) {
    return { code: '309', type: 'PowerLog', typeCN: '电源日志', hardwareRelated: '辅助' }
  }
  if (/"?bug[_ ]?type"?\s*[:=]\s*"?109/i.test(text) || /exception\s*type/i.test(t)) {
    return { code: '109', type: 'Application Crash', typeCN: '应用崩溃', hardwareRelated: '极少' }
  }
  return { code: 'unknown', type: 'Unknown', typeCN: '未识别日志类型', hardwareRelated: '未知' }
}

const extractHardwareModel = (text) => {
  const standardMatch = text.match(/(?:"product"|Hardware\s*Model|"model_id")\s*[:=]\s*"?(iPhone\d+,\d+|iPad\d+,\d+)"?/i)
  if (standardMatch) return standardMatch[1]

  const aopMatch = text.match(/(iphone\d+)aop/i)
  if (aopMatch) {
    const aopNum = parseInt(aopMatch[1].replace('iphone', ''), 10)
    const aopToModel = {
      12: 'iPhone11,8', 13: 'iPhone12,1', 14: 'iPhone13,2', 15: 'iPhone14,2', 16: 'iPhone15,2', 17: 'iPhone17,1'
    }
    if (aopToModel[aopNum]) return aopToModel[aopNum]
  }

  const chipMatch = text.match(/T8(\d{3})/i)
  if (chipMatch) {
    if (chipMatch[1] === '140') return 'iPhone17,1'
    if (chipMatch[1] === '120') return 'iPhone17,3'
  }
  return null
}

const extractTimestamp = (text) => {
  const match = text.match(/"?timestamp"?\s*[:=]\s*"?(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}[^",\n]*)/i)
  return match ? match[1] : null
}

const extractOSVersion = (text) => {
  const match = text.match(/"?os[_ ]?version"?\s*[:=]\s*"?(iPhone\s*OS\s*[\d.]+[^"\n,]*)"?/i)
  if (match) return match[1].trim()
  const alt = text.match(/(?:iPhone\s*OS|iOS|iPadOS)\s*(\d+\.\d+(?:\.\d+)?)/i)
  return alt ? `iOS ${alt[1]}` : null
}

const extractOSBuild = (text) => {
  const match = text.match(/(?:iPhone\s*OS|iOS|iPadOS)\s*[\d.]+\s*\(([A-Z0-9]+)\)/i)
  if (match) return match[1]
  const alt = text.match(/"?build"?\s*[:=]\s*"([A-Z0-9]{5,})"?/i)
  return alt ? alt[1] : null
}

const extractKernelVersion = (text) => {
  const match = text.match(/(?:"?kernel"?\s*[:=]\s*"?)?(Darwin\s*Kernel\s*Version\s*[\d.]+[^"\n]{0,80})/i)
  return match ? match[1].trim().replace(/["\\]+$/, '') : null
}

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return null
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (d > 0) parts.push(`${d}天`)
  if (h > 0) parts.push(`${h}小时`)
  if (m > 0) parts.push(`${m}分钟`)
  if (parts.length === 0) parts.push(`${seconds % 60}秒`)
  return parts.join(' ')
}

const extractUptime = (text) => {
  const nanoMatch = text.match(/(?:System\s*)?uptime[^:]*?(?:nanoseconds|ns)[^0-9]*(\d{6,})/i)
  if (nanoMatch) return formatDuration(Math.floor(parseInt(nanoMatch[1], 10) / 1e9))
  const secMatch = text.match(/"?uptime"?\s*[:=]\s*"?(\d+)"?/i)
  if (secMatch) return formatDuration(parseInt(secMatch[1], 10))
  const durMatch = text.match(/Uptime[:\s]+((?:\d+[dhms]\s*){1,4})/i)
  return durMatch ? durMatch[1].trim() : null
}

const extractSocRevision = (text) => {
  const match = text.match(/"?socRevision"?\s*[:=]\s*"?(\d+)"?/i)
  return match ? match[1] : null
}

const extractIncidentId = (text) => {
  const match = text.match(/\"?(?:Incident\s*Identifier|incident_id|\"id\")\"?\s*[:=]\s*\"?([A-F0-9-]{8,})\"?/i)
  return match ? match[1] : null
}

const extractPanicString = (text) => {
  const match = text.match(/"?panicString"?\s*[:=]\s*"([^"]{20,})/i)
  if (match) return match[1]
  const alt = text.match(/panic\(cpu\s*\d+[^"\n]{20,}/i)
  return alt ? alt[0] : null
}

const extractExceptionInfo = (text) => {
  const type = text.match(/Exception\s*Type\s*[:=]\s*([A-Z_]+)(?:\s*\(([^)]+)\))?/i)
  const codes = text.match(/Exception\s*Codes\s*[:=]\s*([^\n\r]+)/i)
  const reason = text.match(/Termination\s*Reason\s*[:=]\s*([^\n\r]+)/i)
  const thread = text.match(/Triggered\s*by\s*Thread\s*[:=]\s*(\d+)/i)
  return {
    exceptionType: type ? type[1] : null,
    signal: type && type[2] ? type[2] : null,
    exceptionCodes: codes ? codes[1].trim() : null,
    terminationReason: reason ? reason[1].trim() : null,
    triggeredByThread: thread ? thread[1] : null
  }
}

// OCR常见错字修正
const normalizeText = (text) => {
  const corrections = {
    '硬盄': '硬盘', '硬盒': '硬盘', '硬孟': '硬盘', '硬盆': '硬盘', '硬需': '硬盘',
    '暂焊': '虚焊', '品振': '晶振', '品体': '晶体', '尼插': '尾插', '甚带': '基带',
    '砷君': '排线', '柳层': '板层', '椒层': '板层', '简': '筒', '闹的路': '闹钟'
  }
  let out = text
  for (const [wrong, right] of Object.entries(corrections)) {
    out = out.split(wrong).join(right)
  }
  return out
}

/**
 * 主解析入口
 */
export function parseLog(rawText) {
  if (!rawText) {
    return { success: false, error: '未提供日志文本' }
  }

  try {
    const normalizedText = normalizeText(rawText)

    const parsed = {
      bugType: detectBugType(normalizedText),
      device: {
        model: extractHardwareModel(normalizedText),
        osVersion: extractOSVersion(normalizedText),
        osBuild: extractOSBuild(normalizedText),
        kernelVersion: extractKernelVersion(normalizedText),
        uptime: extractUptime(normalizedText),
        socRevision: extractSocRevision(normalizedText)
      },
      incidentId: extractIncidentId(normalizedText),
      timestamp: extractTimestamp(normalizedText),
      panicString: extractPanicString(normalizedText),
      exception: extractExceptionInfo(normalizedText),
      rawText: normalizedText,
      rawLength: normalizedText.length
    }

    return { success: true, parsed }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
