import React, { useCallback, useEffect, useState } from 'react'
import ApiStatus from './components/ApiStatus'
import FileUpload from './components/FileUpload'
import ClashConfiguration from './components/ClashConfiguration'
import ClashResults from './components/ClashResults'
import ClashSetBuilder, { ClashSet } from './components/ClashSetBuilder'

const apiBase = (import.meta as any).env?.VITE_API_BASE?.replace(/\/$/, '') || ''

export default function App() {
    const [activeTab, setActiveTab] = useState<'upload' | 'configure' | 'results'>('upload')
    const [apiStatus, setApiStatus] = useState<null | {
        available: boolean
        ifcclash_available: boolean
        capabilities?: string[]
        fallback_mode?: boolean
        message: string
    }>(null)
    const [files, setFiles] = useState<File[]>([])
    const [setsText, setSetsText] = useState('')
    const [result, setResult] = useState<any>(null)
    const [sets, setSets] = useState<ClashSet[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isRunning, setIsRunning] = useState(false)
    const [progress, setProgress] = useState<{ stage: string; progress: number } | null>(null)

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
        if (!files.length) return

        setError(null)
        setResult(null)
        setIsRunning(true)
        setProgress({ stage: 'Preparing files...', progress: 10 })

        try {
            const fd = new FormData()

            // Add files with progress simulation
            files.forEach((f, index) => {
                fd.append('files', f)
                setProgress({
                    stage: `Uploading ${f.name}...`,
                    progress: 10 + (index / files.length) * 30
                })
            })

            setProgress({ stage: 'Configuring clash detection...', progress: 50 })

            // Use sets if available, otherwise use text configuration
            const payload = sets.length > 0 ? sets : (setsText ? JSON.parse(setsText) : [])
            fd.append('clash_sets', JSON.stringify(payload))

            setProgress({ stage: 'Running clash detection...', progress: 70 })

            const r = await fetch(`${apiBase}/api/clash-detection`, { method: 'POST', body: fd })

            if (!r.ok) {
                const errorData = await r.json()
                throw new Error(errorData.error || `HTTP ${r.status}: ${r.statusText}`)
            }

            setProgress({ stage: 'Processing results...', progress: 90 })

            const responseData = await r.json()

            setProgress({ stage: 'Complete!', progress: 100 })

            // Switch to results tab
            setResult(responseData)
            setActiveTab('results')

            // Clear progress after a moment
            setTimeout(() => setProgress(null), 1000)

        } catch (e: any) {
            setError(e?.message || 'Clash detection failed')
            setProgress(null)
        } finally {
            setIsRunning(false)
        }
    }, [files, sets, setsText])

    const getTabIcon = (tab: string) => {
        switch (tab) {
            case 'upload': return '📁'
            case 'configure': return '⚙️'
            case 'results': return '📊'
            default: return '📄'
        }
    }

    const canRunAnalysis = files.length > 0 && (sets.length > 0 || setsText.trim())

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            {/* Header */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '16px 0'
            }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 40,
                                height: 40,
                                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.25rem'
                            }}>
                                🔍
                            </div>
                            <div>
                                <h1 style={{ margin: 0, color: '#1e293b', fontSize: '1.5rem', fontWeight: '700' }}>
                                    IFC Clash Detection
                                </h1>
                                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                                    Professional BIM clash analysis tool
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            {apiStatus && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '8px 12px',
                                    background: apiStatus.available ? '#dcfce7' : '#fef2f2',
                                    borderRadius: 6,
                                    border: `1px solid ${apiStatus.available ? '#16a34a' : '#dc2626'}`
                                }}>
                                    <div style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: apiStatus.available ? '#16a34a' : '#dc2626'
                                    }} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: '500', color: apiStatus.available ? '#166534' : '#991b1b' }}>
                                        {apiStatus.available ? 'API Connected' : 'API Offline'}
                                    </span>
                                </div>
                            )}

                            <button
                                onClick={checkHealth}
                                style={{
                                    padding: '8px 12px',
                                    background: '#f3f4f6',
                                    border: '1px solid #d1d5db',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    color: '#374151'
                                }}
                            >
                                🔄 Refresh
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
                {/* Navigation Tabs */}
                <div style={{
                    display: 'flex',
                    gap: 4,
                    background: 'rgba(255, 255, 255, 0.9)',
                    padding: 4,
                    borderRadius: 8,
                    marginBottom: 24,
                    backdropFilter: 'blur(10px)'
                }}>
                    {[
                        { key: 'upload', label: 'Upload Files', desc: 'Add IFC files for analysis' },
                        { key: 'configure', label: 'Configure Analysis', desc: 'Set up clash detection rules' },
                        { key: 'results', label: 'View Results', desc: 'Review clash detection results' }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                border: 'none',
                                borderRadius: 6,
                                background: activeTab === tab.key ? '#3b82f6' : 'transparent',
                                color: activeTab === tab.key ? 'white' : '#64748b',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: '1rem' }}>{getTabIcon(tab.key)}</span>
                                <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{tab.label}</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{tab.desc}</div>
                        </button>
                    ))}
                </div>

                {/* Progress Bar */}
                {progress && (
                    <div style={{
                        marginBottom: 24,
                        padding: 16,
                        background: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <div style={{ fontSize: '1.25rem' }}>⚡</div>
                            <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                                    {progress.stage}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    Please wait while we process your files...
                                </div>
                            </div>
                        </div>
                        <div style={{
                            width: '100%',
                            height: 8,
                            background: '#e2e8f0',
                            borderRadius: 4,
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${progress.progress}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                                borderRadius: 4,
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                    </div>
                )}

                {/* Tab Content */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: 12,
                    padding: 24,
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                }}>
                    {activeTab === 'upload' && (
                        <div>
                            <div style={{ marginBottom: 24 }}>
                                <h2 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.5rem' }}>📁 Upload IFC Files</h2>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '1rem' }}>
                                    Start by uploading the IFC files you want to analyze for clashes
                                </p>
                            </div>
                            <FileUpload files={files} onFilesChange={setFiles} />

                            {files.length > 0 && (
                                <div style={{
                                    marginTop: 24,
                                    padding: 16,
                                    background: '#f0f9ff',
                                    borderRadius: 8,
                                    border: '1px solid #0ea5e9'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: '1rem' }}>✅</span>
                                        <div>
                                            <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#0c4a6e' }}>
                                                Files Ready
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#075985' }}>
                                                {files.length} IFC file{files.length === 1 ? ' is' : 's are'} ready for analysis.
                                                Proceed to the Configure tab to set up your clash detection rules.
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setActiveTab('configure')}
                                            style={{
                                                marginLeft: 'auto',
                                                padding: '8px 16px',
                                                background: '#0ea5e9',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: 6,
                                                cursor: 'pointer',
                                                fontSize: '0.875rem',
                                                fontWeight: '500'
                                            }}
                                        >
                                            Configure Analysis →
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'configure' && (
                        <div>
                            <div style={{ marginBottom: 24 }}>
                                <h2 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.5rem' }}>⚙️ Configure Clash Detection</h2>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '1rem' }}>
                                    Define how you want to detect clashes between your IFC files
                                </p>
                            </div>

                            {!files.length && (
                                <div style={{
                                    textAlign: 'center',
                                    padding: 48,
                                    background: '#fef3c7',
                                    borderRadius: 8,
                                    border: '1px solid #f59e0b',
                                    marginBottom: 24
                                }}>
                                    <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠️</div>
                                    <h3 style={{ margin: '0 0 8px 0', color: '#92400e' }}>No Files Uploaded</h3>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e' }}>
                                        Please upload IFC files first before configuring clash detection.
                                    </p>
                                    <button
                                        onClick={() => setActiveTab('upload')}
                                        style={{
                                            marginTop: 16,
                                            padding: '8px 16px',
                                            background: '#f59e0b',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            fontSize: '0.875rem',
                                            fontWeight: '500'
                                        }}
                                    >
                                        ← Go to Upload
                                    </button>
                                </div>
                            )}

                            {files.length > 0 && (
                                <>
                                    <ClashSetBuilder files={files} value={sets} onChange={setSets} />

                                    <div style={{ marginTop: 24 }}>
                                        <ClashConfiguration clashSetsText={setsText} onChange={setSetsText} />
                                    </div>

                                    <div style={{
                                        marginTop: 24,
                                        padding: 16,
                                        background: canRunAnalysis ? '#dcfce7' : '#f3f4f6',
                                        borderRadius: 8,
                                        border: `1px solid ${canRunAnalysis ? '#16a34a' : '#d1d5db'}`
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: '1rem' }}>{canRunAnalysis ? '✅' : '⚠️'}</span>
                                            <div>
                                                <div style={{
                                                    fontSize: '0.875rem',
                                                    fontWeight: '500',
                                                    color: canRunAnalysis ? '#166534' : '#374151'
                                                }}>
                                                    {canRunAnalysis ? 'Ready to Run Analysis' : 'Configuration Incomplete'}
                                                </div>
                                                <div style={{
                                                    fontSize: '0.75rem',
                                                    color: canRunAnalysis ? '#15803d' : '#6b7280'
                                                }}>
                                                    {canRunAnalysis
                                                        ? `${sets.length > 0 ? sets.length : '1'} clash detection rule${(sets.length > 1 || sets.length === 0) ? 's' : ''} configured`
                                                        : 'Please configure at least one clash detection rule'
                                                    }
                                                </div>
                                            </div>
                                            {canRunAnalysis && (
                                                <button
                                                    onClick={run}
                                                    disabled={isRunning}
                                                    style={{
                                                        marginLeft: 'auto',
                                                        padding: '12px 24px',
                                                        background: isRunning ? '#6b7280' : '#16a34a',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: 8,
                                                        cursor: isRunning ? 'not-allowed' : 'pointer',
                                                        fontSize: '0.875rem',
                                                        fontWeight: '600',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8
                                                    }}
                                                >
                                                    <span>{isRunning ? '🔄' : '🚀'}</span>
                                                    {isRunning ? 'Running Analysis...' : 'Run Clash Detection'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'results' && (
                        <div>
                            <div style={{ marginBottom: 24 }}>
                                <h2 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.5rem' }}>📊 Analysis Results</h2>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '1rem' }}>
                                    Review clash detection results and detailed analysis
                                </p>
                            </div>

                            {error && (
                                <div style={{
                                    marginBottom: 24,
                                    padding: 16,
                                    background: '#fef2f2',
                                    borderRadius: 8,
                                    border: '1px solid #dc2626'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: '1rem' }}>❌</span>
                                        <div>
                                            <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#991b1b' }}>
                                                Analysis Failed
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>
                                                {error}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setError(null)}
                                            style={{
                                                marginLeft: 'auto',
                                                padding: '4px 8px',
                                                background: '#f3f4f6',
                                                border: '1px solid #d1d5db',
                                                borderRadius: 4,
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                color: '#374151'
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!result && !error && (
                                <div style={{
                                    textAlign: 'center',
                                    padding: 64,
                                    background: '#f8fafc',
                                    borderRadius: 8,
                                    border: '2px dashed #e2e8f0'
                                }}>
                                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>📊</div>
                                    <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>No Results Yet</h3>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                                        Run a clash detection analysis to see results here
                                    </p>
                                    <button
                                        onClick={() => setActiveTab('configure')}
                                        style={{
                                            marginTop: 16,
                                            padding: '8px 16px',
                                            background: '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            fontSize: '0.875rem',
                                            fontWeight: '500'
                                        }}
                                    >
                                        ← Go to Configure
                                    </button>
                                </div>
                            )}

                            <ClashResults data={result} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}


