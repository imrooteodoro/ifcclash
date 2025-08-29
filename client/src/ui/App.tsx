import React, { useCallback, useEffect, useState } from 'react'

type ClashSource = { file: string; selector?: string; mode?: 'i' | 'e' }
type ClashSet = { name: string; a: ClashSource[]; b?: ClashSource[] }

const apiBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, '') || ''

export default function App() {
    const [health, setHealth] = useState<any>(null)
    const [files, setFiles] = useState<File[]>([])
    const [setsText, setSetsText] = useState('[{"name":"Set A","a":[{"file":"file.ifc"}]}]')
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    const checkHealth = useCallback(async () => {
        setError(null)
        try {
            const r = await fetch(`${apiBase}/api/health`)
            setHealth(await r.json())
        } catch (e: any) {
            setError(e?.message || 'Health failed')
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
                <button onClick={checkHealth}>Check API</button>
                <pre>{JSON.stringify(health, null, 2)}</pre>
            </section>
            <section>
                <h2>Upload IFC Files</h2>
                <input type="file" multiple accept=".ifc" onChange={e => setFiles(Array.from(e.target.files || []))} />
                <h3>Clash Sets JSON</h3>
                <textarea value={setsText} onChange={e => setSetsText(e.target.value)} rows={6} style={{ width: '100%' }} />
                <button onClick={run}>Run Clash Detection</button>
            </section>
            {error && <div style={{ color: 'crimson' }}>{error}</div>}
            {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
        </div>
    )
}


