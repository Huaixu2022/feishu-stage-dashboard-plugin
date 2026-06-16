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

async function withTimeout<T>(promise: Promise<T>, message: string, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms)
    })
  ])
}

export default function CountDown() {
  const [data, setData] = useState<StageData>(defaultData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('插件启动，正在连接飞书数据...')

  useEffect(() => {
    async function loadData() {
      try {
        const tableMetaList = await withTimeout(
          bitable.base.getTableMetaList(),
          '读取数据表列表超时'
        )

        setError('找到数据表：' + tableMetaList.length)

        if (!tableMetaList.length) {
          throw new Error('当前多维表格没有找到任何数据表')
        }

        let targetTable: any = null
        let targetFields: any[] = []

        for (const tableMeta of tableMetaList) {
          const tempTable = await withTimeout(
            bitable.base.getTableById(tableMeta.id),
            '读取数据表失败：' + tableMeta.name
          )

          const fields = await withTimeout(
            tempTable.getFieldMetaList(),
            '读取字段失败：' + tableMeta.name
          )

          const hasTodayField = fields.some((f: any) => f.name === '是否当日')

          if (hasTodayField) {
            targetTable = tempTable
            targetFields = fields
            setError('已找到工作日历表：' + tableMeta.name)
            break
          }
        }

        if (!targetTable) {
          throw new Error('没有找到包含【是否当日】字段的数据表')
        }

        const fields = targetFields

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

        const missingFields = Object.entries(fieldMap)
          .filter(([, id]) => !id)
          .map(([key]) => key)

        if (missingFields.length) {
          throw new Error('字段缺失：' + missingFields.join('、'))
        }

        const records = await withTimeout(
          targetTable.getRecordIdList(),
          '读取记录列表超时'
        )

        setError('找到记录数：' + records.length)

        let targetRecordId = ''

        for (const recordId of records) {
          const value = await withTimeout(
            targetTable.getCellValue(fieldMap.isToday!, recordId),
            '读取【是否当日】超时'
          )

          if (getTextValue(value) === '是') {
            targetRecordId = recordId
            break
          }
        }

        if (!targetRecordId) {
          throw new Error('未找到【是否当日=是】的记录')
        }

        setError('已找到今日记录，正在读取字段...')

        const total = getNumberValue(await targetTable.getCellValue(fieldMap.total!, targetRecordId))
        const current = getNumberValue(await targetTable.getCellValue(fieldMap.current!, targetRecordId))
        const stageName = getTextValue(await targetTable.getCellValue(fieldMap.stageName!, targetRecordId))
        const progressRaw = getNumberValue(await targetTable.getCellValue(fieldMap.progress!, targetRecordId))
        const stageCode = getNumberValue(await targetTable.getCellValue(fieldMap.stageCode!, targetRecordId))
        const firstEnd = getNumberValue(await targetTable.getCellValue(fieldMap.firstEnd!, targetRecordId))
        const secondEnd = getNumberValue(await targetTable.getCellValue(fieldMap.secondEnd!, targetRecordId))

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

        setError('')
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