import { useCallback, useEffect, useRef, useState } from 'react'
import { 
    Search, Upload, Settings, BarChart3, Eye, FileText, 
    Sparkles, Lock, FolderOpen, Zap, CheckCircle2, 
    AlertTriangle, XCircle, FileCheck, Rocket, Loader2,
    ArrowRight, ArrowLeft, Info, X
} from 'lucide-react'
import ClashConfiguration from './components/ClashConfiguration'
import ClashResults from './components/ClashResultsNew'
import ClashSetBuilder, { ClashSet } from './components/ClashSetBuilder'
import ClashSidebar from './components/ClashSidebar'
import FileUpload from './components/FileUpload'
import IfcJsViewer, { IfcJsViewerHandle, ModelLayer } from './IfcJsViewer'
import ModelLayersPanel from './components/ModelLayersPanel'

const apiBase = (import.meta as any).env?.VITE_API_BASE?.replace(/\/$/, '') || ((import.meta as any).env.DEV ? '' : '') // Empty string uses Vite proxy in dev, or relative paths in production

export default function App() {
    const [activeTab, setActiveTab] = useState('upload' as 'upload' | 'configure' | 'results' | 'viewer')
    const [showClashViewer, setShowClashViewer] = useState(false)
    const ifcViewerRef = useRef<IfcJsViewerHandle | null>(null)

    const [files, setFiles] = useState([] as File[])
    const [setsText, setSetsText] = useState('')
    const [result, setResult] = useState(null as any)
    const [sets, setSets] = useState([] as ClashSet[])
    const [error, setError] = useState(null as string | null)
    const [isRunning, setIsRunning] = useState(false)
    const [progress, setProgress] = useState(null as { stage: string; progress: number } | null)
    const [layers, setLayers] = useState([] as ModelLayer[])
    const appSectionRef = useRef<HTMLDivElement>(null)

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

    const scrollToApp = useCallback(() => {
        setActiveTab('upload')
        if (appSectionRef.current) {
            appSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [])


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
        if (activeTab !== 'viewer') return

        if (result && !showClashViewer) {
            const clashArray = result?.results || result
            const hasClashes = Array.isArray(clashArray) && clashArray.length > 0
            if (hasClashes) {
                setShowClashViewer(true)
            }
        }

        requestAnimationFrame(() => {
            ifcViewerRef.current?.resize()
        })
    }, [activeTab, result, showClashViewer])

    // Listen for clash selection changes from ClashResults component
    useEffect(() => {
        const handleClashSelectionChange = (event: CustomEvent) => {
            const { guids, focusPoints } = event.detail
            if (ifcViewerRef.current && guids.length > 0) {
                ifcViewerRef.current.isolateByGuids(guids, { zoom: true, focusPoints })
            }
        }

        document.addEventListener('clash-selection-change', handleClashSelectionChange as EventListener)
        return () => {
            document.removeEventListener('clash-selection-change', handleClashSelectionChange as EventListener)
        }
    }, [])

    const getTabIcon = (tab: string) => {
        const iconSize = 18
        const iconStyle = { width: iconSize, height: iconSize }
        switch (tab) {
            case 'upload': return <Upload style={iconStyle} />
            case 'configure': return <Settings style={iconStyle} />
            case 'results': return <BarChart3 style={iconStyle} />
            case 'viewer': return <Eye style={iconStyle} />
            default: return <FileText style={iconStyle} />
        }
    }

    const canRunAnalysis = files.length > 0 && (sets.length > 0 || setsText.trim())



    return (
        <>
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
            <div style={{
                minHeight: '100vh',
                background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 40%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.06), transparent 30%), linear-gradient(135deg, #0f172a 0%, #312e81 45%, #6d28d9 100%)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                color: '#0b1021'
            }}>
            {/* Header */}
            <div style={{
                background: 'rgba(8, 15, 35, 0.6)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
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
                                color: 'white'
                            }}>
                                <Search size={20} />
                            </div>
                            <div>
                                <h1 style={{ margin: 0, color: '#e2e8f0', fontSize: '1.5rem', fontWeight: '700' }}>
                                    IFC Clash Detection
                                </h1>
                                <p style={{ margin: '4px 0 0 0', color: '#cbd5e1', fontSize: '0.875rem' }}>
                                    Free BIM clash analysis in your browser
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hero */}
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px 16px 24px', color: '#e2e8f0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'center' }}>
                    <div>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 12px',
                            background: 'rgba(255,255,255,0.08)',
                            borderRadius: 9999,
                            fontSize: '0.85rem',
                            marginBottom: 12,
                            color: '#c4d4ff'
                        }}>
                            <Sparkles size={14} /> Free IFC clash checker, nothing to install
                        </div>
                        <h2 style={{ margin: '0 0 12px 0', fontSize: '2.3rem', lineHeight: 1.2, color: 'white' }}>
                            Detect BIM clashes, review in 3D, and share insights faster.
                        </h2>
                        <p style={{ margin: '0 0 16px 0', color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.6 }}>
                            Upload industry-standard IFC files, configure custom clash sets, and inspect issues directly in an
                            interactive web viewer. Your files are processed securely and never stored permanently.
                        </p>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                            <button
                                onClick={scrollToApp}
                                style={{
                                    padding: '12px 20px',
                                    background: 'linear-gradient(135deg, #22d3ee, #818cf8)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 12,
                                    cursor: 'pointer',
                                    boxShadow: '0 12px 35px rgba(56,189,248,0.3)',
                                    fontWeight: 600,
                                    fontSize: '1rem'
                                }}
                            >
                                Start free clash check →
                            </button>
                            <button
                                onClick={() => setActiveTab('configure')}
                                style={{
                                    padding: '12px 16px',
                                    background: 'rgba(255,255,255,0.08)',
                                    color: '#e2e8f0',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    borderRadius: 12,
                                    cursor: 'pointer'
                                }}
                            >
                                Configure clash rules
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.95rem', color: '#cbd5e1' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Lock size={16} /> Secure server-side processing
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FolderOpen size={16} /> Supports .ifc files only
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Eye size={16} /> Built-in 3D viewer
                            </div>
                        </div>
                    </div>
                    <div style={{
                        background: 'rgba(255,255,255,0.08)',
                        borderRadius: 16,
                        padding: 20,
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.35)'
                    }}>
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(99,102,241,0.25))',
                            borderRadius: 12,
                            padding: 16,
                            marginBottom: 12,
                            color: 'white'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <Zap size={20} />
                                <div>
                                    <div style={{ fontWeight: 700 }}>Fast, accurate clash detection</div>
                                    <div style={{ fontSize: '0.95rem', color: '#dbeafe' }}>Process complex IFC models without installs.</div>
                                </div>
                            </div>
                            <div style={{
                                height: 10,
                                width: '100%',
                                background: 'rgba(255,255,255,0.12)',
                                borderRadius: 9999,
                                overflow: 'hidden'
                            }}>
                                <div style={{ width: '78%', height: '100%', background: 'linear-gradient(90deg, #22d3ee, #a855f7)' }} />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                            {[{ title: 'Upload IFC', desc: 'Drag & drop your .ifc files securely.' }, { title: 'Configure rules', desc: 'Build clash sets tailored to your model.' }, { title: 'Run detection', desc: 'Server-side processing with clear status.' }, { title: 'Review in 3D', desc: 'Navigate clashes with isolation and zoom.' }].map(item => (
                                <div key={item.title} style={{
                                    background: 'rgba(255,255,255,0.06)',
                                    borderRadius: 12,
                                    padding: 12,
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    color: '#e2e8f0'
                                }}>
                                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{item.title}</div>
                                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>{item.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div ref={appSectionRef} style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
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
                                {getTabIcon(tab.key)}
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
                            <Loader2 size={20} className="animate-spin" style={{ color: '#3b82f6' }} />
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
                    padding: 32,
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                }}>
                    {activeTab === 'upload' && (
                        <div>
                            {/* Unified Tab Header */}
                            <div style={{ 
                                marginBottom: 32, 
                                paddingBottom: 24,
                                borderBottom: '2px solid #e2e8f0',
                                display: 'flex', 
                                alignItems: 'flex-start', 
                                gap: 16 
                            }}>
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <Upload size={24} style={{ color: 'white' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h2 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.5rem', fontWeight: '600' }}>
                                        Upload IFC Files
                                    </h2>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                                        Start by uploading the IFC files you want to analyze for clashes. Supported format: .ifc files only.
                                    </p>
                                </div>
                            </div>
                            
                            {/* Tab Content */}
                            <div>
                                <FileUpload files={files} onFilesChange={setFiles} />

                                {files.length > 0 && (
                                    <div style={{
                                        marginTop: 24,
                                        padding: 20,
                                        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                                        borderRadius: 12,
                                        border: '2px solid #0ea5e9',
                                        boxShadow: '0 4px 12px rgba(14, 165, 233, 0.1)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 10,
                                                background: '#16a34a',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <CheckCircle2 size={20} style={{ color: 'white' }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: '#0c4a6e', marginBottom: 4 }}>
                                                    Files Ready for Analysis
                                                </div>
                                                <div style={{ fontSize: '0.8125rem', color: '#075985', lineHeight: 1.5 }}>
                                                    {files.length} IFC file{files.length === 1 ? ' is' : 's are'} ready for analysis.
                                                    Proceed to the Configure tab to set up your clash detection rules.
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setActiveTab('configure')}
                                                style={{
                                                    padding: '10px 20px',
                                                    background: '#0ea5e9',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: 8,
                                                    cursor: 'pointer',
                                                    fontSize: '0.875rem',
                                                    fontWeight: '600',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = '#0284c7'
                                                    e.currentTarget.style.transform = 'translateY(-1px)'
                                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 165, 233, 0.4)'
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = '#0ea5e9'
                                                    e.currentTarget.style.transform = 'translateY(0)'
                                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(14, 165, 233, 0.3)'
                                                }}
                                            >
                                                Configure Analysis <ArrowRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'configure' && (
                        <div>
                            {/* Unified Tab Header */}
                            <div style={{ 
                                marginBottom: 32, 
                                paddingBottom: 24,
                                borderBottom: '2px solid #e2e8f0',
                                display: 'flex', 
                                alignItems: 'flex-start', 
                                gap: 16 
                            }}>
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <Settings size={24} style={{ color: 'white' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h2 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.5rem', fontWeight: '600' }}>
                                        Configure Clash Detection
                                    </h2>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                                        Define how you want to detect clashes between your IFC files. Use presets or build custom clash sets.
                                    </p>
                                </div>
                            </div>
                            
                            {/* Tab Content */}
                            <div>

                                {!files.length && (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: 64,
                                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                        borderRadius: 12,
                                        border: '2px solid #f59e0b',
                                        marginBottom: 24,
                                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.1)'
                                    }}>
                                        <div style={{
                                            width: 64,
                                            height: 64,
                                            borderRadius: 16,
                                            background: '#f59e0b',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 20px'
                                        }}>
                                            <AlertTriangle size={32} style={{ color: 'white' }} />
                                        </div>
                                        <h3 style={{ margin: '0 0 12px 0', color: '#92400e', fontSize: '1.25rem', fontWeight: '600' }}>
                                            No Files Uploaded
                                        </h3>
                                        <p style={{ margin: '0 0 24px 0', fontSize: '0.9375rem', color: '#92400e', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
                                            Please upload IFC files first before configuring clash detection.
                                        </p>
                                        <button
                                            onClick={() => setActiveTab('upload')}
                                            style={{
                                                padding: '10px 20px',
                                                background: '#f59e0b',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: 8,
                                                cursor: 'pointer',
                                                fontSize: '0.875rem',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                margin: '0 auto',
                                                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = '#d97706'
                                                e.currentTarget.style.transform = 'translateY(-1px)'
                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.4)'
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = '#f59e0b'
                                                e.currentTarget.style.transform = 'translateY(0)'
                                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.3)'
                                            }}
                                        >
                                            <ArrowLeft size={16} /> Go to Upload
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
                                            marginTop: 32,
                                            padding: 20,
                                            background: canRunAnalysis 
                                                ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' 
                                                : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                                            borderRadius: 12,
                                            border: `2px solid ${canRunAnalysis ? '#16a34a' : '#d1d5db'}`,
                                            boxShadow: canRunAnalysis 
                                                ? '0 4px 12px rgba(22, 163, 74, 0.1)' 
                                                : '0 2px 8px rgba(0, 0, 0, 0.05)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 10,
                                                    background: canRunAnalysis ? '#16a34a' : '#f59e0b',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    {canRunAnalysis ? (
                                                        <CheckCircle2 size={20} style={{ color: 'white' }} />
                                                    ) : (
                                                        <AlertTriangle size={20} style={{ color: 'white' }} />
                                                    )}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{
                                                        fontSize: '0.9375rem',
                                                        fontWeight: '600',
                                                        color: canRunAnalysis ? '#166534' : '#374151',
                                                        marginBottom: 4
                                                    }}>
                                                        {canRunAnalysis ? 'Ready to Run Analysis' : 'Configuration Incomplete'}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '0.8125rem',
                                                        color: canRunAnalysis ? '#15803d' : '#6b7280',
                                                        lineHeight: 1.5
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
                                                            gap: 8,
                                                            boxShadow: isRunning ? 'none' : '0 2px 8px rgba(22, 163, 74, 0.3)',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (!isRunning) {
                                                                e.currentTarget.style.background = '#15803d'
                                                                e.currentTarget.style.transform = 'translateY(-1px)'
                                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.4)'
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (!isRunning) {
                                                                e.currentTarget.style.background = '#16a34a'
                                                                e.currentTarget.style.transform = 'translateY(0)'
                                                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(22, 163, 74, 0.3)'
                                                            }
                                                        }}
                                                    >
                                                        {isRunning ? (
                                                            <>
                                                                <Loader2 size={16} className="animate-spin" />
                                                                Running Analysis...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Rocket size={16} />
                                                                Run Clash Detection
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'results' && (
                        <div>
                            {/* Unified Tab Header */}
                            <div style={{ 
                                marginBottom: 32, 
                                paddingBottom: 24,
                                borderBottom: '2px solid #e2e8f0',
                                display: 'flex', 
                                alignItems: 'flex-start', 
                                gap: 16 
                            }}>
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <BarChart3 size={24} style={{ color: 'white' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h2 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.5rem', fontWeight: '600' }}>
                                        Analysis Results
                                    </h2>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                                        Review clash detection results and detailed analysis. Filter, sort, and export your findings.
                                    </p>
                                </div>
                            </div>
                            
                            {/* Tab Content */}
                            <div>

                                {error && (
                                    <div style={{
                                        marginBottom: 24,
                                        padding: 20,
                                        background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                                        borderRadius: 12,
                                        border: '2px solid #dc2626',
                                        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.1)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 10,
                                                background: '#dc2626',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <XCircle size={20} style={{ color: 'white' }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: '#991b1b', marginBottom: 4 }}>
                                                    Analysis Failed
                                                </div>
                                                <div style={{ fontSize: '0.8125rem', color: '#dc2626', lineHeight: 1.5 }}>
                                                    {error}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setError(null)}
                                                style={{
                                                    padding: '6px 10px',
                                                    background: '#f3f4f6',
                                                    border: '1px solid #d1d5db',
                                                    borderRadius: 6,
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem',
                                                    color: '#374151',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = '#e5e7eb'
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = '#f3f4f6'
                                                }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {!result && !error && (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: 64,
                                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                        borderRadius: 12,
                                        border: '2px dashed #cbd5e1'
                                    }}>
                                        <div style={{
                                            width: 64,
                                            height: 64,
                                            borderRadius: 16,
                                            background: '#e2e8f0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 20px'
                                        }}>
                                            <BarChart3 size={32} style={{ color: '#94a3b8' }} />
                                        </div>
                                        <h3 style={{ margin: '0 0 12px 0', color: '#374151', fontSize: '1.25rem', fontWeight: '600' }}>
                                            No Results Yet
                                        </h3>
                                        <p style={{ margin: '0 0 24px 0', fontSize: '0.9375rem', color: '#64748b', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
                                            Run a clash detection analysis to see results here
                                        </p>
                                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                                            {canRunAnalysis ? (
                                                <button
                                                    onClick={run}
                                                    disabled={isRunning}
                                                    style={{
                                                        padding: '10px 20px',
                                                        background: isRunning ? '#6b7280' : '#16a34a',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: 8,
                                                        cursor: isRunning ? 'not-allowed' : 'pointer',
                                                        fontSize: '0.875rem',
                                                        fontWeight: '600',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        boxShadow: isRunning ? 'none' : '0 2px 8px rgba(22, 163, 74, 0.3)',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (!isRunning) {
                                                            e.currentTarget.style.background = '#15803d'
                                                            e.currentTarget.style.transform = 'translateY(-1px)'
                                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.4)'
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (!isRunning) {
                                                            e.currentTarget.style.background = '#16a34a'
                                                            e.currentTarget.style.transform = 'translateY(0)'
                                                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(22, 163, 74, 0.3)'
                                                        }
                                                    }}
                                                >
                                                    {isRunning ? (
                                                        <>
                                                            <Loader2 size={16} className="animate-spin" />
                                                            Running Analysis...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Rocket size={16} />
                                                            Run Clash Detection
                                                        </>
                                                    )}
                                                </button>
                                            ) : null}
                                            <button
                                                onClick={() => setActiveTab('configure')}
                                                style={{
                                                    padding: '10px 20px',
                                                    background: canRunAnalysis ? '#f3f4f6' : '#3b82f6',
                                                    color: canRunAnalysis ? '#374151' : 'white',
                                                    border: canRunAnalysis ? '1px solid #d1d5db' : 'none',
                                                    borderRadius: 8,
                                                    cursor: 'pointer',
                                                    fontSize: '0.875rem',
                                                    fontWeight: '600',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    boxShadow: canRunAnalysis ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.3)',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!canRunAnalysis) {
                                                        e.currentTarget.style.background = '#2563eb'
                                                        e.currentTarget.style.transform = 'translateY(-1px)'
                                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)'
                                                    } else {
                                                        e.currentTarget.style.background = '#e5e7eb'
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!canRunAnalysis) {
                                                        e.currentTarget.style.background = '#3b82f6'
                                                        e.currentTarget.style.transform = 'translateY(0)'
                                                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)'
                                                    } else {
                                                        e.currentTarget.style.background = '#f3f4f6'
                                                    }
                                                }}
                                            >
                                                <ArrowLeft size={16} /> {canRunAnalysis ? 'Configure' : 'Go to Configure'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {result && !error && (
                                    <ClashResults 
                                        data={result} 
                                        onSwitchToViewer={() => {
                                            setShowClashViewer(true)
                                            setActiveTab('viewer')
                                        }}
                                        viewer={ifcViewerRef.current}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Viewer Tab - Always rendered but hidden when not active to preserve viewer instance */}
                    {/* Using visibility instead of display to preserve WebGL context and dimensions */}
                    <div style={{ 
                        display: 'block',
                        visibility: activeTab === 'viewer' ? 'visible' : 'hidden',
                        position: activeTab === 'viewer' ? 'relative' : 'absolute',
                        pointerEvents: activeTab === 'viewer' ? 'auto' : 'none',
                        height: activeTab === 'viewer' ? 'auto' : 0,
                        overflow: activeTab === 'viewer' ? 'visible' : 'hidden'
                    }}>
                        {/* Unified Tab Header */}
                        <div style={{ 
                            marginBottom: 32, 
                            paddingBottom: 24,
                            borderBottom: '2px solid #e2e8f0',
                            display: 'flex', 
                            alignItems: 'flex-start', 
                            gap: 16 
                        }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: 12,
                                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <Eye size={24} style={{ color: 'white' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h2 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.5rem', fontWeight: '600' }}>
                                    {showClashViewer && result ? 'Clash Analysis Results' : '3D IFC Viewer'}
                                </h2>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                                    {showClashViewer && result 
                                        ? 'Select clashes from the sidebar to isolate elements in 3D. Navigate and inspect clash locations visually.'
                                        : files.length > 0 
                                            ? 'Visualize your IFC models in 3D. Use mouse controls to rotate, zoom, and pan.'
                                            : 'Upload IFC files to get started with 3D visualization'}
                                </p>
                            </div>
                        </div>
                        
                        {/* Tab Content */}
                        <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            height: 'calc(100vh - 400px)',
                            maxHeight: '800px',
                            minHeight: '600px',
                            overflow: 'hidden',
                            position: 'relative'
                        }}>
                            {/* Single viewer container - always rendered to preserve WebGL context */}
                            <div style={{
                                display: 'flex',
                                gap: 16,
                                flex: 1,
                                minHeight: 0,
                                overflow: 'hidden'
                            }}>
                                {/* Clash Sidebar - conditionally shown */}
                                {showClashViewer && result && (
                                    <div style={{
                                        flexShrink: 0,
                                        width: '320px',
                                        minWidth: '280px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        overflow: 'hidden'
                                    }}>
                                        <ClashSidebar
                                            data={result?.results || result}
                                            onClashSelect={handleClashSelect}
                                            onClearSelection={handleClearSelection}
                                        />
                                    </div>
                                )}

                                {/* 3D Viewer */}
                                <div style={{ 
                                    flex: 1, 
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    minWidth: 0,
                                    minHeight: 0,
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        gap: 8,
                                        marginBottom: 12,
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        flexShrink: 0
                                    }}>
                                        {files.length > 0 && (
                                            <div style={{
                                                padding: '6px 10px',
                                                background: '#f0f9ff',
                                                border: '1px solid #0ea5e9',
                                                borderRadius: 4,
                                                fontSize: '0.75rem',
                                                color: '#0c4a6e',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6
                                            }}>
                                                <FileCheck size={14} /> {files.length} model{files.length > 1 ? 's' : ''} loaded
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

                                        {showClashViewer && result && (
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
                                                    fontWeight: '500',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6
                                                }}
                                            >
                                                <BarChart3 size={14} /> Detailed Results
                                            </button>
                                        )}
                                    </div>

                                    {/* Viewer container - SINGLE instance, always rendered */}
                                    <div
                                        style={{
                                            flex: 1,
                                            border: '2px solid #e2e8f0',
                                            borderRadius: 12,
                                            background: '#f8fafc',
                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                                            minHeight: 0,
                                            overflow: 'hidden',
                                            position: 'relative'
                                        }}
                                    >
                                        <IfcJsViewer ref={ifcViewerRef} files={files} active={activeTab === 'viewer'} onLayersChange={setLayers} />
                                        <ModelLayersPanel
                                            layers={layers}
                                            onVisibilityChange={(id, v) => ifcViewerRef.current?.setLayerVisibility(id, v)}
                                            onOpacityChange={(id, o) => ifcViewerRef.current?.setLayerOpacity(id, o)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Empty state - only shown when no files */}
                            {files.length === 0 && (
                                <div style={{
                                    padding: 64,
                                    textAlign: 'center',
                                    color: '#64748b',
                                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                    border: '2px dashed #cbd5e1',
                                    borderRadius: 12,
                                    marginTop: 16
                                }}>
                                    <div style={{
                                        width: 64,
                                        height: 64,
                                        borderRadius: 16,
                                        background: '#e2e8f0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 20px'
                                    }}>
                                        <Upload size={32} style={{ color: '#94a3b8' }} />
                                    </div>
                                    <h3 style={{ margin: '0 0 12px 0', color: '#374151', fontSize: '1.125rem', fontWeight: '600' }}>
                                        No Files Loaded
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.9375rem', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
                                        Upload IFC files in the Upload tab to view them here
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </>
    )
}


