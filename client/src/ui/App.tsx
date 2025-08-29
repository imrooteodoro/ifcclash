import React, { useCallback, useEffect, useState } from 'react'
import ApiStatus from './components/ApiStatus'
import FileUpload from './components/FileUpload'
import ClashConfiguration from './components/ClashConfiguration'
import ClashResults from './components/ClashResults'

type ClashSource = { file: string; selector?: string; mode?: 'i' | 'e' }
type ClashSet = { name: string; a: ClashSource[]; b?: ClashSource[] }

const apiBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, '') || ''

export default function App() {
    const [apiStatus, setApiStatus] = useState<null | {
        available: boolean
        ifcclash_available: boolean
        capabilities?: string[]
        fallback_mode?: boolean
        message: string
    }>(null)
    const [files, setFiles] = useState<File[]>([])
    const [setsText, setSetsText] = useState('[{"name":"Set A","a":[{"file":"file.ifc"}]}]')
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    const checkHealth = useCallback(async () => {
        setError(null)
        try {
            const r = await fetch(`${apiBase}/api/health`)
            const status = await r.json()
            setApiStatus({
                available: r.ok,
                ifcclash_available: status.ifcclash_available ?? false,
                capabilities: status.capabilities ?? [],
                fallback_mode: status.fallback_mode ?? false,
                message: status.ifcclash_available
                    ? 'API is ready for clash detection'
                    : status.fallback_mode
                        ? 'API in fallback mode'
                        : 'API running (IfcClash not available)'
            })
        } catch (e: any) {
            setApiStatus({
                available: false,
                ifcclash_available: false,
                capabilities: [],
                fallback_mode: false,
                message: 'API is not accessible'
            })
        }
    }, [])

    useEffect(() => {
        checkHealth()
    }, [checkHealth])

    const run = useCallback(async () => {
        setError(null)
        setResult(null)
        const fd = new FormData()
        files.forEach(f => fd.append('files', f))
        fd.append('clash_sets', setsText || '[]')
        try {
            const r = await fetch(`${apiBase}/api/clash-detection`, { method: 'POST', body: fd })
            setResult(await r.json())
        } catch (e: any) {
            setError(e?.message || 'Run failed')
        }
    }, [files, setsText])

    return (
        <div style={{ maxWidth: 960, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
            <h1>IFC Clash Detection</h1>
            <section>
                <ApiStatus status={apiStatus} onRefresh={checkHealth} />
            </section>
            <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                    <FileUpload files={files} onFilesChange={setFiles} />
                </div>
                <div>
                    <ClashConfiguration clashSetsText={setsText} onChange={setSetsText} />
                </div>
            </section>
            <div style={{ marginTop: 12 }}>
                <button onClick={run} disabled={!files.length}>Run Clash Detection</button>
            </div>
            {error && <div style={{ color: 'crimson' }}>{error}</div>}
            <ClashResults data={result} />
        </div>
    )
}


