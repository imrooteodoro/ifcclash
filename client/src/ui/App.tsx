import { useCallback, useEffect, useRef, useState } from 'react'
import ClashConfiguration from './components/ClashConfiguration'
import ClashResults from './components/ClashResultsNew'
import ClashSetBuilder, { ClashSet } from './components/ClashSetBuilder'
import ClashSidebar from './components/ClashSidebar'
import FileUpload from './components/FileUpload'
import { IFCViewer } from './IFCViewer'

const apiBase = (import.meta as any).env?.VITE_API_BASE?.replace(/\/$/, '') || 'http://localhost:5001'

export default function App() {
    const [activeTab, setActiveTab] = useState('upload' as 'upload' | 'configure' | 'results' | 'viewer')
    const [showClashViewer, setShowClashViewer] = useState(false)
    const viewerRef = useRef<HTMLDivElement>(null)
    const ifcViewerRef = useRef<IFCViewer | null>(null)

    const [files, setFiles] = useState([] as File[])
    const [setsText, setSetsText] = useState('')
    const [result, setResult] = useState(null as any)
    const [sets, setSets] = useState([] as ClashSet[])
    const [error, setError] = useState(null as string | null)
    const [isRunning, setIsRunning] = useState(false)
    const [progress, setProgress] = useState(null as { stage: string; progress: number } | null)
    const [loadedToViewer, setLoadedToViewer] = useState(new Set<string>())



    // Initialize IFCViewer manually
    const initializeViewer = useCallback(() => {
        if (viewerRef.current && !ifcViewerRef.current) {
            const width = viewerRef.current.clientWidth;
            const height = viewerRef.current.clientHeight;


            if (width > 0 && height > 0) {
                ifcViewerRef.current = new IFCViewer(viewerRef.current);
                // Force a resize after initialization
                setTimeout(() => {
                    if (ifcViewerRef.current && typeof ifcViewerRef.current.resize === 'function') {
                        ifcViewerRef.current.resize();
                    }
                }, 100);
                return true;
            }
        }
        return false;
    }, [])

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

            // Switch to clash viewer if we have results, otherwise results tab
            setResult(responseData)


            // Check if we have any clashes to show
            const clashArray = responseData?.results || responseData
            const hasClashes = Array.isArray(clashArray) && clashArray.length > 0


            if (hasClashes) {

                setShowClashViewer(true)
                // Small delay to ensure the viewer tab content is rendered before switching
                setTimeout(() => {
                    setActiveTab('viewer')
                }, 100)
            } else {

                setActiveTab('results')
            }

            // Clear progress after a moment
            setTimeout(() => setProgress(null), 1000)

        } catch (e: any) {
            setError(e?.message || 'Clash detection failed')
            setProgress(null)
        } finally {
            setIsRunning(false)
        }
    }, [files, sets, setsText])

    const loadIFCToViewer = useCallback(async (file: File) => {
        // Initialize viewer if not already done
        if (!ifcViewerRef.current) {
            const initialized = initializeViewer();
            if (!initialized) {
                console.error("Failed to initialize viewer - container may not be ready");
                return;
            }
        }

        if (ifcViewerRef.current && !loadedToViewer.has(file.name)) {
            await ifcViewerRef.current.loadIFC(file);
            setLoadedToViewer(prev => new Set(prev).add(file.name));
        }
    }, [initializeViewer, loadedToViewer])

    // Auto-load new IFC files to viewer when viewer tab is active
    useEffect(() => {
        if (files.length > 0 && activeTab === 'viewer') {
            // Initialize viewer if not already done
            if (!ifcViewerRef.current) {
                // Use requestAnimationFrame to ensure DOM is rendered
                requestAnimationFrame(() => {
                    if (!ifcViewerRef.current) {
                        const initialized = initializeViewer();
                        if (initialized) {
                            // Load files after successful initialization
                            files.forEach(file => {
                                if (!loadedToViewer.has(file.name)) {
                                    loadIFCToViewer(file);
                                }
                            });
                        }
                    }
                });
            } else {
                // Viewer exists, just load any new files
                files.forEach(file => {
                    if (!loadedToViewer.has(file.name)) {
                        loadIFCToViewer(file);
                    }
                });
            }
        }
    }, [files, activeTab, initializeViewer, loadIFCToViewer, loadedToViewer])

    // Clash viewer handlers
    const handleClashSelect = useCallback((_clashIds: string[], guids: string[], clashPoints?: [number, number, number][]) => {
        if (ifcViewerRef.current && guids.length > 0) {
            ifcViewerRef.current.isolateByGuids(guids, { zoom: true, focusPoints: clashPoints })
        }
    }, [])

    const handleClearSelection = useCallback(() => {
        if (ifcViewerRef.current) {
            ifcViewerRef.current.clearClashIsolation()
        }
    }, [])

    // Refresh viewer when returning to viewer tab
    useEffect(() => {
        if (activeTab === 'viewer' && ifcViewerRef.current) {
            // Small delay to ensure tab is fully rendered
            setTimeout(() => {
                if (ifcViewerRef.current && typeof ifcViewerRef.current.refreshViewer === 'function') {
                    ifcViewerRef.current.refreshViewer();
                }
            }, 100);
        }
    }, [activeTab])

    const getTabIcon = (tab: string) => {
        switch (tab) {
            case 'upload': return '📁'
            case 'configure': return '⚙️'
            case 'results': return '📊'
            case 'viewer': return '👁️'
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
                        { key: 'results', label: 'View Results', desc: 'Review clash detection results' },
                        { key: 'viewer', label: '3D Viewer', desc: 'Visualize IFC models and clashes' }
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

                    <div style={{ display: activeTab === 'viewer' ? 'block' : 'none' }}>
                        {showClashViewer && result ? (
                            /* Clash Viewer Layout */
                            <div>
                                <div style={{ marginBottom: 16 }}>
                                    <h2 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.5rem' }}>🎯 Clash Analysis Results</h2>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '1rem' }}>
                                        Select clashes from the sidebar to isolate elements in 3D
                                    </p>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    gap: 16,
                                    height: '600px'
                                }}>
                                    {/* Clash Sidebar */}
                                    <ClashSidebar
                                        data={result?.results || result}
                                        onClashSelect={handleClashSelect}
                                        onClearSelection={handleClearSelection}
                                    />

                                    {/* 3D Viewer */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <div style={{
                                            display: 'flex',
                                            gap: 8,
                                            marginBottom: 12,
                                            alignItems: 'center'
                                        }}>
                                            {files.length > 0 && (
                                                <div style={{
                                                    padding: '6px 10px',
                                                    background: '#f0f9ff',
                                                    border: '1px solid #0ea5e9',
                                                    borderRadius: 4,
                                                    fontSize: '0.75rem',
                                                    color: '#0c4a6e'
                                                }}>
                                                    📄 {files.length} model{files.length > 1 ? 's' : ''} loaded
                                                </div>
                                            )}

                                            {ifcViewerRef.current && (
                                                <button
                                                    onClick={() => {
                                                        if (ifcViewerRef.current) {
                                                            ifcViewerRef.current.showAll();
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '6px 12px',
                                                        background: '#3b82f6',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: 4,
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '500'
                                                    }}
                                                >
                                                    Show All
                                                </button>
                                            )}

                                            <button
                                                onClick={() => {
                                                    setShowClashViewer(false)
                                                    setActiveTab('results')
                                                }}
                                                style={{
                                                    padding: '6px 12px',
                                                    background: '#6b7280',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: 4,
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                📊 Detailed Results
                                            </button>
                                        </div>

                                        <div
                                            id="viewer-container"
                                            ref={viewerRef}
                                            style={{
                                                flex: 1,
                                                border: '1px solid #e2e8f0',
                                                borderRadius: 8,
                                                background: '#f8fafc'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Regular 3D Viewer */
                            <div>
                                <div style={{ marginBottom: 24 }}>
                                    <h2 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.5rem' }}>👁️ 3D IFC Viewer</h2>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '1rem' }}>
                                        {files.length > 0 ? 'Visualize your IFC models in 3D' : 'Upload IFC files to get started'}
                                    </p>
                                </div>

                                {files.length > 0 ? (
                                    <div style={{
                                        display: 'flex',
                                        gap: 16,
                                        marginBottom: 16,
                                        alignItems: 'center'
                                    }}>
                                        <div style={{
                                            padding: '8px 12px',
                                            background: '#f0f9ff',
                                            border: '1px solid #0ea5e9',
                                            borderRadius: 6,
                                            fontSize: '0.875rem',
                                            color: '#0c4a6e'
                                        }}>
                                            📄 {files.length} IFC file{files.length > 1 ? 's' : ''} loaded automatically
                                        </div>

                                        {ifcViewerRef.current && (
                                            <button
                                                onClick={() => {
                                                    if (ifcViewerRef.current) {
                                                        ifcViewerRef.current.showAll();
                                                    }
                                                }}
                                                style={{
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
                                                Show All Elements
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{
                                        padding: '32px',
                                        textAlign: 'center',
                                        color: '#64748b',
                                        background: '#f8fafc',
                                        border: '2px dashed #cbd5e1',
                                        borderRadius: 8,
                                        marginBottom: 16
                                    }}>
                                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>📁</div>
                                        <div>Upload IFC files in the Upload tab to view them here</div>
                                    </div>
                                )}

                                <div
                                    id="viewer-container"
                                    ref={viewerRef}
                                    style={{
                                        width: '100%',
                                        height: '600px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 8,
                                        background: '#f8fafc'
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}


