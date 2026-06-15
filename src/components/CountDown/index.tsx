import './style.scss'
import { bitable } from "@lark-base-open/js-sdk"
import { useEffect, useState } from "react"

type StageData = {
  stageName: string
  currentWorkday: number
  totalWorkday: number
  progress: number
  stageCode: number
  firstEnd: number
  secondEnd: number
}

const defaultData: StageData = {
  stageName: '第二阶段',
  currentWorkday: 11,
  totalWorkday: 21,
  progress: 52.38,
  stageCode: 2,
  firstEnd: 7,
  secondEnd: 14,
}

function getTextValue(value: any): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) {
    return value.map(v => v?.text ?? v?.name ?? v).join('')
  }
  return value?.text ?? value?.name ?? String(value)
}

function getNumberValue(value: any): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  const text = getTextValue(value).replace('%', '')
  const num = Number(text)
  return Number.isNaN(num) ? 0 : num
}

export default function CountDown() {
  const [data, setData] = useState<StageData>(defaultData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        const table = await bitable.base.getActiveTable()
        const records = await table.getRecordIdList()
        const fields = await table.getFieldMetaList()

        const getFieldId = (name: string) => {
          return fields.find((f: any) => f.name === name)?.id
        }

        const fieldMap = {
          isToday: getFieldId('是否当日'),
          total: getFieldId('本月总工作日数'),
          current: getFieldId('当月第几个工作日'),
          stageName: getFieldId('当前日期所处阶段'),
          progress: getFieldId('当前日期所处当月工作日进度'),
          stageCode: getFieldId('当前阶段编码'),
          firstEnd: getFieldId('第一阶段截止'),
          secondEnd: getFieldId('第二阶段截止'),
        }

        const todayRecordId = records.find(async () => false)

        let targetRecordId = ''

        for (const recordId of records) {
          const value = await table.getCellValue(fieldMap.isToday!, recordId)
          if (getTextValue(value) === '是') {
            targetRecordId = recordId
            break
          }
        }

        if (!targetRecordId) {
          throw new Error('未找到【是否当日=是】的记录')
        }

        const total = getNumberValue(await table.getCellValue(fieldMap.total!, targetRecordId))
        const current = getNumberValue(await table.getCellValue(fieldMap.current!, targetRecordId))
        const stageName = getTextValue(await table.getCellValue(fieldMap.stageName!, targetRecordId))
        const progressRaw = getNumberValue(await table.getCellValue(fieldMap.progress!, targetRecordId))
        const stageCode = getNumberValue(await table.getCellValue(fieldMap.stageCode!, targetRecordId))
        const firstEnd = getNumberValue(await table.getCellValue(fieldMap.firstEnd!, targetRecordId))
        const secondEnd = getNumberValue(await table.getCellValue(fieldMap.secondEnd!, targetRecordId))

        const progress = progressRaw <= 1 ? progressRaw * 100 : progressRaw

        setData({
          stageName: stageName || defaultData.stageName,
          currentWorkday: current || defaultData.currentWorkday,
          totalWorkday: total || defaultData.totalWorkday,
          progress: Number(progress.toFixed(2)),
          stageCode: stageCode || defaultData.stageCode,
          firstEnd: firstEnd || defaultData.firstEnd,
          secondEnd: secondEnd || defaultData.secondEnd,
        })

      } catch (e: any) {
        setError(e?.message || '读取数据失败，当前使用预览数据')
        setData(defaultData)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const progress = data.progress

  return (
    <div className="stage-wrap">

      <div className="stage-title">
        {loading ? '正在读取数据...' : data.stageName}
      </div>

      <div className="stage-grid">

        <div className="stage-card">
          <div className="stage-label">
            当前工作日
          </div>
          <div className="stage-value">
            {data.currentWorkday}/{data.totalWorkday}
          </div>
        </div>

        <div className="stage-card">
          <div className="stage-label">
            工作日进度
          </div>
          <div className="stage-value">
            {progress.toFixed(2)}%
          </div>
        </div>

      </div>

      <div className="progress-wrap">
        <div className="progress-bar">
          <div
            className="progress-inner"
            style={{
              width: `${progress}%`
            }}
          />
        </div>
      </div>

      <div className="stage-list">

        <div className={`stage-item ${data.stageCode === 1 ? 'active' : ''}`}>
          <div className="stage-item-title">
            第一阶段
          </div>
          <div className="stage-item-value">
            1-{data.firstEnd}
          </div>
        </div>

        <div className={`stage-item ${data.stageCode === 2 ? 'active' : ''}`}>
          <div className="stage-item-title">
            第二阶段
          </div>
          <div className="stage-item-value">
            {data.firstEnd + 1}-{data.secondEnd}
          </div>
        </div>

        <div className={`stage-item ${data.stageCode === 3 ? 'active' : ''}`}>
          <div className="stage-item-title">
            第三阶段
          </div>
          <div className="stage-item-value">
            {data.secondEnd + 1}-{data.totalWorkday}
          </div>
        </div>

      </div>

      {error && (
        <div style={{ marginTop: 16, color: '#b45309', fontSize: 13 }}>
          {error}
        </div>
      )}

    </div>
  )
}