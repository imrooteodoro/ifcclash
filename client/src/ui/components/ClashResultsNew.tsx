import { useState, useMemo, useCallback } from 'react'
import { Flame, BarChart3, Filter, Search, Building2, Building, Zap, AlertTriangle, Ruler, ArrowUpDown, Trash2, Eye, X, Download, ArrowLeft, ArrowRight, Camera } from 'lucide-react'
import type { IfcJsViewerHandle } from '../IfcJsViewer'

const apiBase = (import.meta as any).env?.VITE_API_BASE?.replace(/\/$/, '') || ((import.meta as any).env.DEV ? '' : '') // Empty string uses Vite proxy in dev, or relative paths in production

type ClashData = {
    results: Array<{
        name: string
        clashes: Record<string, {
            a_global_id: string
            a_ifc_class: string
            a_name: string
            a_building_storey?: string
            b_global_id: string
            b_ifc_class: string
            b_name: string
            b_building_storey?: string
            type: string
            p1: [number, number, number]
            p2: [number, number, number]
            distance: number
            severity?: 'critical' | 'high' | 'medium' | 'low'
        }>
    }>
}

type Props = {
    data: ClashData | null
    onSwitchToViewer?: () => void
    viewer?: IfcJsViewerHandle | null
}

type FilterState = {
    ifcClasses: Set<string>
    buildingStoreys: Set<string>
    clashTypes: Set<string>
    searchQuery: string
    distanceRange: [number, number]
    severity: Set<string>
    sortBy: 'name' | 'type' | 'distance' | 'severity'
    sortOrder: 'asc' | 'desc'
}

type ClashItem = {
    id: string
    setName: string
    a_global_id: string
    a_ifc_class: string
    a_name: string
    a_building_storey?: string
    b_global_id: string
    b_ifc_class: string
    b_name: string
    b_building_storey?: string
    type: string
    p1: [number, number, number]
    p2: [number, number, number]
    distance: number
    severity?: 'critical' | 'high' | 'medium' | 'low'
}

export default function ClashResults({ data, onSwitchToViewer, viewer }: Props) {
    const [selectedClashes, setSelectedClashes] = useState<Set<string>>(new Set())
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage] = useState(20)
    const [showFilters, setShowFilters] = useState(true)
    const [showStats, setShowStats] = useState(true)
    const [isCapturingScreenshots, setIsCapturingScreenshots] = useState(false)
    const [captureProgress, setCaptureProgress] = useState({ current: 0, total: 0 })

    const [filters, setFilters] = useState<FilterState>({
        ifcClasses: new Set(),
        buildingStoreys: new Set(),
        clashTypes: new Set(),
        searchQuery: '',
        distanceRange: [0, 10],
        severity: new Set(),
        sortBy: 'name',
        sortOrder: 'asc'
    })

    // Flatten and process clash data
    const allClashes = useMemo(() => {
        if (!data?.results) return []

        const flattened: ClashItem[] = []
        data.results.forEach((resultSet) => {
            Object.entries(resultSet.clashes || {}).forEach(([clashId, clash]) => {
                flattened.push({
                    id: clashId,
                    setName: resultSet.name,
                    a_global_id: clash.a_global_id,
                    a_ifc_class: clash.a_ifc_class,
                    a_name: clash.a_name,
                    a_building_storey: clash.a_building_storey,
                    b_global_id: clash.b_global_id,
                    b_ifc_class: clash.b_ifc_class,
                    b_name: clash.b_name,
                    b_building_storey: clash.b_building_storey,
                    type: clash.type,
                    p1: clash.p1,
                    p2: clash.p2,
                    distance: clash.distance,
                    severity: clash.severity || getSeverityFromDistance(clash.distance)
                })
            })
        })
        return flattened
    }, [data])

    // Get unique values for filters
    const filterOptions = useMemo(() => {
        const ifcClasses = new Set<string>()
        const buildingStoreys = new Set<string>()
        const clashTypes = new Set<string>()
        const severities = new Set<string>()

        allClashes.forEach(clash => {
            ifcClasses.add(clash.a_ifc_class)
            ifcClasses.add(clash.b_ifc_class)
            if (clash.a_building_storey) buildingStoreys.add(clash.a_building_storey)
            if (clash.b_building_storey) buildingStoreys.add(clash.b_building_storey)
            clashTypes.add(clash.type)
            if (clash.severity) severities.add(clash.severity)
        })

        return { ifcClasses, buildingStoreys, clashTypes, severities }
    }, [allClashes])

    // Filter and sort clashes
    const filteredClashes = useMemo(() => {
        let filtered = allClashes.filter(clash => {
            // IFC Class filter
            if (filters.ifcClasses.size > 0) {
                const hasMatchingClass = filters.ifcClasses.has(clash.a_ifc_class) ||
                    filters.ifcClasses.has(clash.b_ifc_class)
                if (!hasMatchingClass) return false
            }

            // Building Storey filter
            if (filters.buildingStoreys.size > 0) {
                const hasMatchingStorey = (clash.a_building_storey && filters.buildingStoreys.has(clash.a_building_storey)) ||
                    (clash.b_building_storey && filters.buildingStoreys.has(clash.b_building_storey))
                if (!hasMatchingStorey) return false
            }

            // Clash Type filter
            if (filters.clashTypes.size > 0 && !filters.clashTypes.has(clash.type)) {
                return false
            }

            // Severity filter
            if (filters.severity.size > 0 && (!clash.severity || !filters.severity.has(clash.severity))) {
                return false
            }

            // Distance range filter
            if (clash.distance < filters.distanceRange[0] || clash.distance > filters.distanceRange[1]) {
                return false
            }

            // Search query filter
            if (filters.searchQuery) {
                const query = filters.searchQuery.toLowerCase()
                const searchableText = [
                    clash.a_name, clash.b_name,
                    clash.a_global_id, clash.b_global_id,
                    clash.a_ifc_class, clash.b_ifc_class,
                    clash.id, clash.setName
                ].join(' ').toLowerCase()

                if (!searchableText.includes(query)) return false
            }

            return true
        })

        // Sort clashes
        filtered.sort((a, b) => {
            let aValue: any, bValue: any

            switch (filters.sortBy) {
                case 'name':
                    aValue = (a.a_name + a.b_name).toLowerCase()
                    bValue = (b.a_name + b.b_name).toLowerCase()
                    break
                case 'type':
                    aValue = a.type
                    bValue = b.type
                    break
                case 'distance':
                    aValue = a.distance
                    bValue = b.distance
                    break
                case 'severity':
                    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
                    aValue = severityOrder[a.severity || 'low']
                    bValue = severityOrder[b.severity || 'low']
                    break
                default:
                    return 0
            }

            if (aValue < bValue) return filters.sortOrder === 'asc' ? -1 : 1
            if (aValue > bValue) return filters.sortOrder === 'asc' ? 1 : -1
            return 0
        })

        return filtered
    }, [allClashes, filters])

    // Pagination
    const totalPages = Math.ceil(filteredClashes.length / itemsPerPage)
    const paginatedClashes = filteredClashes.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    // Statistics
    const stats = useMemo(() => {
        const stats = {
            total: allClashes.length,
            filtered: filteredClashes.length,
            byType: {} as Record<string, number>,
            bySeverity: {} as Record<string, number>,
            byClass: {} as Record<string, number>,
            avgDistance: 0,
            maxDistance: 0
        }

        let totalDistance = 0
        let maxDistance = 0

        filteredClashes.forEach(clash => {
            stats.byType[clash.type] = (stats.byType[clash.type] || 0) + 1
            if (clash.severity) {
                stats.bySeverity[clash.severity] = (stats.bySeverity[clash.severity] || 0) + 1
            }
            stats.byClass[clash.a_ifc_class] = (stats.byClass[clash.a_ifc_class] || 0) + 1
            stats.byClass[clash.b_ifc_class] = (stats.byClass[clash.b_ifc_class] || 0) + 1

            totalDistance += clash.distance
            maxDistance = Math.max(maxDistance, clash.distance)
        })

        stats.avgDistance = filteredClashes.length > 0 ? totalDistance / filteredClashes.length : 0
        stats.maxDistance = maxDistance

        return stats
    }, [allClashes, filteredClashes])

    const handleClashClick = useCallback((clashId: string) => {
        setSelectedClashes(prev => {
            const newSelected = new Set(prev)
            if (newSelected.has(clashId)) {
                newSelected.delete(clashId)
            } else {
                newSelected.add(clashId)
            }
            return newSelected
        })
    }, [])

    const handleSelectAll = useCallback(() => {
        if (selectedClashes.size === paginatedClashes.length) {
            setSelectedClashes(new Set())
        } else {
            setSelectedClashes(new Set(paginatedClashes.map(c => c.id)))
        }
    }, [selectedClashes, paginatedClashes])

    const handleIsolateInViewer = useCallback(() => {
        const selectedGuids: string[] = []
        const focusPoints: [number, number, number][] = []

        selectedClashes.forEach(clashId => {
            const clash = allClashes.find(c => c.id === clashId)
            if (clash) {
                selectedGuids.push(clash.a_global_id, clash.b_global_id)
                if (clash.p1) {
                    focusPoints.push(clash.p1)
                }
            }
        })

        // Switch to viewer tab first
        if (onSwitchToViewer) {
            onSwitchToViewer()
        }

        // Dispatch event after a short delay to ensure viewer tab is active
        setTimeout(() => {
            document.dispatchEvent(new CustomEvent("clash-selection-change", {
                detail: {
                    guids: selectedGuids,
                    focusPoints: focusPoints
                }
            }))
        }, 100)
    }, [selectedClashes, allClashes, onSwitchToViewer])

    const handleClearSelection = useCallback(() => {
        setSelectedClashes(new Set())
        document.dispatchEvent(new CustomEvent("clash-selection-change", {
            detail: { guids: [] }
        }))
    }, [])

    const updateFilter = useCallback((key: keyof FilterState, value: any) => {
        setFilters(prev => ({ ...prev, [key]: value }))
        setCurrentPage(1) // Reset to first page when filters change
    }, [])

    const clearFilters = useCallback(() => {
        setFilters({
            ifcClasses: new Set(),
            buildingStoreys: new Set(),
            clashTypes: new Set(),
            searchQuery: '',
            distanceRange: [0, 10],
            severity: new Set(),
            sortBy: 'name',
            sortOrder: 'asc'
        })
        setCurrentPage(1)
    }, [])

    // Export function
    const exportResults = useCallback(async (format: 'csv' | 'json' = 'csv') => {
        try {
            const response = await fetch(`${apiBase}/api/export-clashes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    format,
                    clashes: filteredClashes,
                    filters
                })
            })

            if (!response.ok) {
                throw new Error('Export failed')
            }

            if (format === 'csv') {
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `clash_results_${new Date().toISOString().split('T')[0]}.csv`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                window.URL.revokeObjectURL(url)
            } else {
                await response.json()
                // Handle JSON export - could show in modal or download
            }
        } catch (error) {
            console.error('Export failed:', error)
            alert('Export failed. Please try again.')
        }
    }, [filteredClashes, filters])

    // BCF Export function - uses selected clashes if any are selected, otherwise uses filtered clashes
    const exportBCF = useCallback(async (includeScreenshots: boolean = false) => {
        try {
            // Determine which clashes to export: selected ones if any, otherwise filtered ones
            const clashesToExport = selectedClashes.size > 0
                ? allClashes.filter(clash => selectedClashes.has(clash.id))
                : filteredClashes

            if (clashesToExport.length === 0) {
                alert('No clashes selected for export. Please select clashes or adjust filters.')
                return
            }

            let screenshots: Record<string, string> = {}

            // Capture screenshots if viewer is available and user wants them
            if (includeScreenshots && viewer?.captureClashScreenshots) {
                setIsCapturingScreenshots(true)
                setCaptureProgress({ current: 0, total: clashesToExport.length })

                try {
                    const screenshotResults = await viewer.captureClashScreenshots(
                        clashesToExport,
                        (current, total) => setCaptureProgress({ current, total })
                    )

                    // Convert to map for easy lookup
                    screenshotResults.forEach(({ clashId, screenshot }) => {
                        // Remove data URL prefix to send just base64
                        screenshots[clashId] = screenshot.replace(/^data:image\/png;base64,/, '')
                    })
                } finally {
                    setIsCapturingScreenshots(false)
                    setCaptureProgress({ current: 0, total: 0 })
                }
            }

            const response = await fetch(`${apiBase}/api/export-bcf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    clashes: clashesToExport,
                    projectName: 'Clash Detection Results',
                    screenshots: Object.keys(screenshots).length > 0 ? screenshots : undefined
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Export failed' }))
                throw new Error(errorData.error || 'Export failed')
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            const exportType = selectedClashes.size > 0 ? 'selected' : 'filtered'
            const withScreenshots = includeScreenshots && Object.keys(screenshots).length > 0 ? '_with_snapshots' : ''
            a.download = `clash_results_${exportType}${withScreenshots}_${new Date().toISOString().split('T')[0]}.bcfzip`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.error('BCF export failed:', error)
            alert(`BCF export failed: ${error instanceof Error ? error.message : 'Please try again.'}`)
        }
    }, [selectedClashes, filteredClashes, allClashes, viewer])

    if (!data?.results || allClashes.length === 0) {
        return (
            <div style={{ padding: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, textAlign: 'center' }}>
                <h3 style={{ margin: 0, color: '#64748b' }}>No Clashes Found</h3>
                <p style={{ margin: '8px 0 0 0', color: '#94a3b8' }}>The clash detection completed successfully with no conflicts detected.</p>
            </div>
        )
    }

    return (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Flame size={20} style={{ color: '#ef4444' }} />
                        <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem' }}>Advanced Clash Analysis</h3>
                        <span style={{
                            background: '#ef4444',
                            color: 'white',
                            padding: '4px 10px',
                            borderRadius: 12,
                            fontSize: '0.875rem',
                            fontWeight: 'bold'
                        }}>
                            {stats.total} Total Clashes
                        </span>
                        {stats.filtered !== stats.total && (
                            <span style={{
                                background: '#3b82f6',
                                color: 'white',
                                padding: '4px 10px',
                                borderRadius: 12,
                                fontSize: '0.875rem',
                                fontWeight: 'bold'
                            }}>
                                {stats.filtered} Filtered
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={() => setShowStats(!showStats)}
                            style={{
                                padding: '6px 12px',
                                background: showStats ? '#3b82f6' : '#f3f4f6',
                                color: showStats ? 'white' : '#374151',
                                border: '1px solid #d1d5db',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}
                        >
                            <BarChart3 size={14} /> Stats
                        </button>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            style={{
                                padding: '6px 12px',
                                background: showFilters ? '#3b82f6' : '#f3f4f6',
                                color: showFilters ? 'white' : '#374151',
                                border: '1px solid #d1d5db',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}
                        >
                            <Filter size={14} /> Filters
                        </button>
                        <button
                            onClick={() => exportResults('csv')}
                            disabled={filteredClashes.length === 0}
                            style={{
                                padding: '6px 12px',
                                background: filteredClashes.length > 0 ? '#059669' : '#f3f4f6',
                                color: filteredClashes.length > 0 ? 'white' : '#9ca3af',
                                border: '1px solid #d1d5db',
                                borderRadius: 6,
                                cursor: filteredClashes.length > 0 ? 'pointer' : 'not-allowed',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}
                        >
                            <Download size={14} /> Export CSV
                        </button>
                        <button
                            onClick={() => exportBCF(false)}
                            disabled={(selectedClashes.size === 0 && filteredClashes.length === 0) || isCapturingScreenshots}
                            title={selectedClashes.size > 0
                                ? `Export ${selectedClashes.size} selected clash${selectedClashes.size === 1 ? '' : 'es'} to BCF`
                                : 'Export filtered clashes to BCF'}
                            style={{
                                padding: '6px 12px',
                                background: (selectedClashes.size > 0 || filteredClashes.length > 0) && !isCapturingScreenshots ? '#7c3aed' : '#f3f4f6',
                                color: (selectedClashes.size > 0 || filteredClashes.length > 0) && !isCapturingScreenshots ? 'white' : '#9ca3af',
                                border: '1px solid #d1d5db',
                                borderRadius: 6,
                                cursor: (selectedClashes.size > 0 || filteredClashes.length > 0) && !isCapturingScreenshots ? 'pointer' : 'not-allowed',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}
                        >
                            <Download size={14} />
                            {selectedClashes.size > 0
                                ? `Export BCF (${selectedClashes.size})`
                                : 'Export BCF'}
                        </button>
                        {viewer?.captureClashScreenshots && (
                            <button
                                onClick={() => exportBCF(true)}
                                disabled={(selectedClashes.size === 0 && filteredClashes.length === 0) || isCapturingScreenshots}
                                title={isCapturingScreenshots
                                    ? `Capturing screenshots (${captureProgress.current}/${captureProgress.total})...`
                                    : selectedClashes.size > 0
                                        ? `Export ${selectedClashes.size} clash${selectedClashes.size === 1 ? '' : 'es'} to BCF with 3D screenshots`
                                        : 'Export filtered clashes to BCF with 3D screenshots'}
                                style={{
                                    padding: '6px 12px',
                                    background: isCapturingScreenshots
                                        ? '#fbbf24'
                                        : (selectedClashes.size > 0 || filteredClashes.length > 0) ? '#059669' : '#f3f4f6',
                                    color: (selectedClashes.size > 0 || filteredClashes.length > 0) || isCapturingScreenshots ? 'white' : '#9ca3af',
                                    border: '1px solid #d1d5db',
                                    borderRadius: 6,
                                    cursor: (selectedClashes.size > 0 || filteredClashes.length > 0) && !isCapturingScreenshots ? 'pointer' : 'not-allowed',
                                    fontSize: '0.75rem',
                                    fontWeight: '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}
                            >
                                <Camera size={14} />
                                {isCapturingScreenshots
                                    ? `Capturing... (${captureProgress.current}/${captureProgress.total})`
                                    : 'BCF + Snapshots'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Statistics Dashboard */}
                {showStats && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 12,
                        marginBottom: 16,
                        padding: 16,
                        background: '#ffffff',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>
                                {stats.filtered}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Filtered Clashes</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>
                                {stats.avgDistance.toFixed(3)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Avg Distance</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>
                                {stats.maxDistance.toFixed(3)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Max Distance</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>
                                {Object.keys(stats.byType).length}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Clash Types</div>
                        </div>
                    </div>
                )}

                {/* Selection Actions */}
                {selectedClashes.size > 0 && (
                    <div style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        padding: 12,
                        background: '#f0f9ff',
                        border: '1px solid #0ea5e9',
                        borderRadius: 8
                    }}>
                        <span style={{ fontSize: '0.875rem', color: '#0c4a6e' }}>
                            {selectedClashes.size} clash{selectedClashes.size === 1 ? '' : 'es'} selected
                        </span>
                        <button
                            onClick={handleIsolateInViewer}
                            style={{
                                padding: '6px 12px',
                                background: '#0ea5e9',
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
                            <Eye size={14} /> Isolate in 3D
                        </button>
                        <button
                            onClick={handleClearSelection}
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
                            <X size={14} /> Clear
                        </button>
                    </div>
                )}
            </div>

            {/* Filters */}
            {showFilters && (
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #e2e8f0',
                    background: '#f9fafb'
                }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                        {/* Search */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '500', color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Search size={12} /> Search
                            </label>
                            <input
                                type="text"
                                placeholder="Search elements, GUIDs..."
                                value={filters.searchQuery}
                                onChange={(e) => updateFilter('searchQuery', e.target.value)}
                                style={{
                                    padding: '6px 10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: 4,
                                    fontSize: '0.875rem',
                                    width: '200px'
                                }}
                            />
                        </div>

                        {/* IFC Class Filter */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '500', color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Building2 size={12} /> IFC Classes
                            </label>
                            <select
                                multiple
                                value={Array.from(filters.ifcClasses)}
                                onChange={(e) => {
                                    const values = Array.from(e.target.selectedOptions, opt => opt.value)
                                    updateFilter('ifcClasses', new Set(values))
                                }}
                                style={{
                                    padding: '6px 10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: 4,
                                    fontSize: '0.875rem',
                                    width: '150px',
                                    height: '80px'
                                }}
                            >
                                {Array.from(filterOptions.ifcClasses).sort().map(cls => (
                                    <option key={cls} value={cls}>{cls}</option>
                                ))}
                            </select>
                        </div>

                        {/* Building Storey Filter */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '500', color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Building size={12} /> Storeys
                            </label>
                            <select
                                multiple
                                value={Array.from(filters.buildingStoreys)}
                                onChange={(e) => {
                                    const values = Array.from(e.target.selectedOptions, opt => opt.value)
                                    updateFilter('buildingStoreys', new Set(values))
                                }}
                                style={{
                                    padding: '6px 10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: 4,
                                    fontSize: '0.875rem',
                                    width: '150px',
                                    height: '80px'
                                }}
                            >
                                {Array.from(filterOptions.buildingStoreys).sort().map(storey => (
                                    <option key={storey} value={storey}>{storey}</option>
                                ))}
                            </select>
                        </div>

                        {/* Clash Type Filter */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '500', color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Zap size={12} /> Types
                            </label>
                            <select
                                multiple
                                value={Array.from(filters.clashTypes)}
                                onChange={(e) => {
                                    const values = Array.from(e.target.selectedOptions, opt => opt.value)
                                    updateFilter('clashTypes', new Set(values))
                                }}
                                style={{
                                    padding: '6px 10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: 4,
                                    fontSize: '0.875rem',
                                    width: '120px',
                                    height: '80px'
                                }}
                            >
                                {Array.from(filterOptions.clashTypes).sort().map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        {/* Severity Filter */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '500', color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <AlertTriangle size={12} /> Severity
                            </label>
                            <select
                                multiple
                                value={Array.from(filters.severity)}
                                onChange={(e) => {
                                    const values = Array.from(e.target.selectedOptions, opt => opt.value)
                                    updateFilter('severity', new Set(values))
                                }}
                                style={{
                                    padding: '6px 10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: 4,
                                    fontSize: '0.875rem',
                                    width: '120px',
                                    height: '80px'
                                }}
                            >
                                {Array.from(filterOptions.severities).sort().map(severity => (
                                    <option key={severity} value={severity}>{severity}</option>
                                ))}
                            </select>
                        </div>

                        {/* Distance Range */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '500', color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Ruler size={12} /> Distance: {filters.distanceRange[0]} - {filters.distanceRange[1]}
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="10"
                                step="0.1"
                                value={filters.distanceRange[1]}
                                onChange={(e) => updateFilter('distanceRange', [filters.distanceRange[0], parseFloat(e.target.value)])}
                                style={{ width: '120px' }}
                            />
                        </div>

                        {/* Sort Options */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '500', color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <ArrowUpDown size={12} /> Sort By
                            </label>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <select
                                    value={filters.sortBy}
                                    onChange={(e) => updateFilter('sortBy', e.target.value)}
                                    style={{
                                        padding: '6px 10px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: 4,
                                        fontSize: '0.875rem'
                                    }}
                                >
                                    <option value="name">Name</option>
                                    <option value="type">Type</option>
                                    <option value="distance">Distance</option>
                                    <option value="severity">Severity</option>
                                </select>
                                <button
                                    onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                                    style={{
                                        padding: '6px 10px',
                                        background: '#f3f4f6',
                                        border: '1px solid #d1d5db',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                        fontSize: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {filters.sortOrder === 'asc' ? <ArrowUpDown size={12} /> : <ArrowUpDown size={12} style={{ transform: 'rotate(180deg)' }} />}
                                </button>
                            </div>
                        </div>

                        {/* Clear Filters */}
                        <div style={{ display: 'flex', alignItems: 'end' }}>
                            <button
                                onClick={clearFilters}
                                style={{
                                    padding: '6px 12px',
                                    background: '#dc2626',
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
                                <Trash2 size={14} /> Clear All
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Clash List */}
            <div style={{ padding: '16px 20px' }}>
                {/* Table Header with Select All */}
                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            type="checkbox"
                            checked={selectedClashes.size === paginatedClashes.length && paginatedClashes.length > 0}
                            onChange={handleSelectAll}
                            style={{ transform: 'scale(1.2)' }}
                        />
                        <span style={{ fontSize: '0.875rem', color: '#374151', fontWeight: '500' }}>
                            Select All ({paginatedClashes.length} shown)
                        </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        Showing {paginatedClashes.length} of {filteredClashes.length} clashes
                    </div>
                </div>

                {/* Clash Table */}
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.875rem',
                        background: '#ffffff'
                    }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                <th style={{ padding: '12px', textAlign: 'center', width: '50px', borderRight: '1px solid #e2e8f0' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedClashes.size === paginatedClashes.length && paginatedClashes.length > 0}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th style={{ padding: '12px', textAlign: 'left', borderRight: '1px solid #e2e8f0', fontWeight: '600' }}>Entity A</th>
                                <th style={{ padding: '12px', textAlign: 'left', borderRight: '1px solid #e2e8f0', fontWeight: '600' }}>Entity B</th>
                                <th style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid #e2e8f0', fontWeight: '600', width: '100px' }}>Type</th>
                                <th style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid #e2e8f0', fontWeight: '600', width: '100px' }}>Severity</th>
                                <th style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid #e2e8f0', fontWeight: '600', width: '100px' }}>Distance</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedClashes.map((clash) => (
                                <tr
                                    key={clash.id}
                                    onClick={() => handleClashClick(clash.id)}
                                    style={{
                                        background: selectedClashes.has(clash.id) ? '#e0f2fe' : 'white',
                                        borderBottom: '1px solid #f1f5f9',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!selectedClashes.has(clash.id)) {
                                            e.currentTarget.style.background = '#f8fafc'
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!selectedClashes.has(clash.id)) {
                                            e.currentTarget.style.background = 'white'
                                        }
                                    }}
                                >
                                    <td
                                        style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedClashes.has(clash.id)}
                                            onChange={() => handleClashClick(clash.id)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </td>
                                    <td style={{ padding: '12px', borderRight: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <div style={{
                                                fontWeight: '600',
                                                fontSize: '0.75rem',
                                                background: getIFCClassColor(clash.a_ifc_class),
                                                color: 'white',
                                                padding: '2px 6px',
                                                borderRadius: 3,
                                                display: 'inline-block',
                                                width: 'fit-content'
                                            }}>
                                                {clash.a_ifc_class}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: '#374151', fontWeight: '500' }}>
                                                {clash.a_name}
                                            </div>
                                            <div style={{ fontSize: '0.625rem', color: '#6b7280', fontFamily: 'monospace' }}>
                                                {clash.a_global_id.slice(-8)}
                                            </div>
                                            {clash.a_building_storey && (
                                                <div style={{ fontSize: '0.625rem', color: '#059669', fontWeight: '500', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Building size={10} /> {clash.a_building_storey}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', borderRight: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <div style={{
                                                fontWeight: '600',
                                                fontSize: '0.75rem',
                                                background: getIFCClassColor(clash.b_ifc_class),
                                                color: 'white',
                                                padding: '2px 6px',
                                                borderRadius: 3,
                                                display: 'inline-block',
                                                width: 'fit-content'
                                            }}>
                                                {clash.b_ifc_class}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: '#374151', fontWeight: '500' }}>
                                                {clash.b_name}
                                            </div>
                                            <div style={{ fontSize: '0.625rem', color: '#6b7280', fontFamily: 'monospace' }}>
                                                {clash.b_global_id.slice(-8)}
                                            </div>
                                            {clash.b_building_storey && (
                                                <div style={{ fontSize: '0.625rem', color: '#059669', fontWeight: '500', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Building size={10} /> {clash.b_building_storey}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                                        <span style={{
                                            background: getClashTypeColor(clash.type),
                                            color: 'white',
                                            padding: '4px 8px',
                                            borderRadius: 12,
                                            fontSize: '0.625rem',
                                            fontWeight: '600',
                                            textTransform: 'uppercase'
                                        }}>
                                            {clash.type}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                                        <span style={{
                                            background: getSeverityColor(clash.severity),
                                            color: 'white',
                                            padding: '4px 8px',
                                            borderRadius: 12,
                                            fontSize: '0.625rem',
                                            fontWeight: '600',
                                            textTransform: 'capitalize'
                                        }}>
                                            {clash.severity || 'unknown'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' }}>
                                            {clash.distance.toFixed(3)}
                                        </div>
                                        <div style={{ fontSize: '0.625rem', color: '#6b7280' }}>units</div>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            <div style={{ fontSize: '0.625rem', color: '#374151' }}>
                                                P1: [{clash.p1.map(coord => coord.toFixed(1)).join(', ')}]
                                            </div>
                                            <div style={{ fontSize: '0.625rem', color: '#374151' }}>
                                                P2: [{clash.p2.map(coord => coord.toFixed(1)).join(', ')}]
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 16,
                        padding: 12
                    }}>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            style={{
                                padding: '6px 12px',
                                background: currentPage === 1 ? '#f3f4f6' : '#3b82f6',
                                color: currentPage === 1 ? '#9ca3af' : 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}
                        >
                            <ArrowLeft size={14} /> Previous
                        </button>

                        <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                            Page {currentPage} of {totalPages}
                        </span>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            style={{
                                padding: '6px 12px',
                                background: currentPage === totalPages ? '#f3f4f6' : '#3b82f6',
                                color: currentPage === totalPages ? '#9ca3af' : 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}
                        >
                            Next <ArrowRight size={14} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

// Helper functions
function getSeverityFromDistance(distance: number): 'critical' | 'high' | 'medium' | 'low' {
    if (distance === 0) return 'critical'
    if (distance <= 0.1) return 'high'
    if (distance <= 1.0) return 'medium'
    return 'low'
}

function getSeverityColor(severity?: string): string {
    switch (severity) {
        case 'critical': return '#dc2626'
        case 'high': return '#ea580c'
        case 'medium': return '#d97706'
        case 'low': return '#65a30d'
        default: return '#6b7280'
    }
}

function getClashTypeColor(type: string): string {
    switch (type.toLowerCase()) {
        case 'collision': return '#dc2626'
        case 'intersection': return '#ea580c'
        case 'clearance': return '#d97706'
        default: return '#6b7280'
    }
}

function getIFCClassColor(ifcClass: string): string {
    // Generate consistent colors based on class name
    const colors = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
        '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6b7280'
    ]
    let hash = 0
    for (let i = 0; i < ifcClass.length; i++) {
        hash = ifcClass.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
}
