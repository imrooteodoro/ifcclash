import { useState, useMemo, useCallback, useEffect } from 'react'

type ClashData = {
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
}[]

interface ClashSidebarProps {
    data: ClashData | any[]
    onClashSelect: (clashIds: string[], guids: string[], clashPoints?: [number, number, number][]) => void
    onClearSelection: () => void
}

type ClashItem = {
    id: string
    setName: string
    a_global_id: string
    a_name: string
    a_ifc_class: string
    a_building_storey?: string
    b_global_id: string
    b_name: string
    b_ifc_class: string
    b_building_storey?: string
    type: string
    distance: number
    severity?: 'critical' | 'high' | 'medium' | 'low'
    p1: [number, number, number]
    p2: [number, number, number]
}

export default function ClashSidebar({ data, onClashSelect, onClearSelection }: ClashSidebarProps) {
    const [selectedClashes, setSelectedClashes] = useState<Set<string>>(new Set())
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all')
    const [groupBy, setGroupBy] = useState<'none' | 'type' | 'severity' | 'storey'>('severity')
    const [expandedClashes, setExpandedClashes] = useState<Set<string>>(new Set())
    const [sortBy] = useState<'name' | 'distance' | 'type'>('distance')
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage] = useState(15)

    // Flatten and enhance clash data
    const allClashes = useMemo(() => {
        if (!Array.isArray(data) || data.length === 0) return []

        const flattened: ClashItem[] = []

        data.forEach((clashSet) => {
            if (clashSet.clashes) {
                Object.entries(clashSet.clashes).forEach(([clashId, clash]: [string, any]) => {
                    const severity = getSeverityFromDistance(clash.distance)
                    flattened.push({
                        id: clashId,
                        setName: clashSet.name,
                        a_global_id: clash.a_global_id,
                        a_name: clash.a_name,
                        a_ifc_class: clash.a_ifc_class,
                        a_building_storey: clash.a_building_storey,
                        b_global_id: clash.b_global_id,
                        b_name: clash.b_name,
                        b_ifc_class: clash.b_ifc_class,
                        b_building_storey: clash.b_building_storey,
                        type: clash.type,
                        distance: clash.distance,
                        severity: clash.severity || severity,
                        p1: clash.p1,
                        p2: clash.p2
                    })
                })
            }
        })

        return flattened
    }, [data])

    // Filter clashes based on search and type
    const filteredClashes = useMemo(() => {
        let filtered = allClashes

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(clash =>
                clash.a_name?.toLowerCase().includes(query) ||
                clash.b_name?.toLowerCase().includes(query) ||
                clash.a_ifc_class?.toLowerCase().includes(query) ||
                clash.b_ifc_class?.toLowerCase().includes(query) ||
                clash.id.toLowerCase().includes(query) ||
                clash.setName?.toLowerCase().includes(query)
            )
        }

        // Apply severity filter
        if (filterType !== 'all') {
            filtered = filtered.filter(clash => clash.severity === filterType)
        }

        // Sort clashes
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'distance':
                    return b.distance - a.distance // Show highest distance first
                case 'type':
                    return a.type.localeCompare(b.type)
                case 'name':
                    return (a.a_name || '').localeCompare(b.a_name || '')
                default:
                    return 0
            }
        })

        return filtered
    }, [allClashes, searchQuery, filterType, sortBy])

    // Group clashes if needed
    const groupedClashes = useMemo(() => {
        if (groupBy === 'none') return { 'All Clashes': filteredClashes }

        const groups: Record<string, ClashItem[]> = {}

        filteredClashes.forEach(clash => {
            let groupKey = 'Other'

            switch (groupBy) {
                case 'type':
                    groupKey = clash.type || 'Unknown'
                    break
                case 'severity':
                    groupKey = clash.severity || 'Unknown'
                    break
                case 'storey':
                    groupKey = clash.a_building_storey || clash.b_building_storey || 'No Storey'
                    break
            }

            if (!groups[groupKey]) groups[groupKey] = []
            groups[groupKey].push(clash)
        })

        return groups
    }, [filteredClashes, groupBy])

    // Pagination
    const totalPages = Math.ceil(filteredClashes.length / itemsPerPage)
    const paginatedClashes = useMemo(() => {
        if (groupBy === 'none') {
            return {
                'All Clashes': filteredClashes.slice(
                    (currentPage - 1) * itemsPerPage,
                    currentPage * itemsPerPage
                )
            }
        }

        // For grouped view, show all groups but paginate within each group
        const result: Record<string, ClashItem[]> = {}
        Object.entries(groupedClashes).forEach(([groupKey, clashes]) => {
            result[groupKey] = clashes.slice(0, itemsPerPage)
        })
        return result
    }, [filteredClashes, groupedClashes, currentPage, itemsPerPage, groupBy])

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault()
                    navigateClash('next')
                    break
                case 'ArrowUp':
                    e.preventDefault()
                    navigateClash('prev')
                    break
                case 'Enter':
                    e.preventDefault()
                    const firstSelected = selectedClashes.values().next().value
                    if (firstSelected) {
                        toggleClashExpansion(firstSelected)
                    }
                    break
                case 'Escape':
                    e.preventDefault()
                    onClearSelection()
                    setSelectedClashes(new Set())
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedClashes, filteredClashes])

    const navigateClash = useCallback((direction: 'next' | 'prev') => {
        const visibleClashes = Object.values(paginatedClashes).flat()
        if (visibleClashes.length === 0) return

        const currentIndex = visibleClashes.findIndex(c => selectedClashes.has(c.id))
        let nextIndex

        if (currentIndex === -1) {
            nextIndex = 0
        } else {
            nextIndex = direction === 'next'
                ? (currentIndex + 1) % visibleClashes.length
                : currentIndex === 0 ? visibleClashes.length - 1 : currentIndex - 1
        }

        const nextClash = visibleClashes[nextIndex]
        handleClashClick(nextClash.id)
    }, [selectedClashes, paginatedClashes])

    const handleClashClick = useCallback((clashId: string) => {
        const newSelection = new Set(selectedClashes)

        if (newSelection.has(clashId)) {
            newSelection.delete(clashId)
        } else {
            newSelection.add(clashId)
        }

        setSelectedClashes(newSelection)

        // Extract GUIDs and clash points from selected clashes
        const selectedClashData = allClashes.filter(c => newSelection.has(c.id))
        const guids = Array.from(
            new Set(selectedClashData.flatMap(c => [c.a_global_id, c.b_global_id]).filter(Boolean))
        )

        if (guids.length > 0) {
            const clashPoints = selectedClashData.map(c => c.p1).filter(p => p != null)
            onClashSelect(Array.from(newSelection), guids, clashPoints)
        } else {
            onClearSelection()
        }
    }, [selectedClashes, allClashes, onClashSelect, onClearSelection])

    const toggleClashExpansion = useCallback((clashId: string) => {
        setExpandedClashes(prev => {
            const newSet = new Set(prev)
            if (newSet.has(clashId)) {
                newSet.delete(clashId)
            } else {
                newSet.add(clashId)
            }
            return newSet
        })
    }, [])

    const handleClearAll = useCallback(() => {
        setSelectedClashes(new Set())
        onClearSelection()
    }, [onClearSelection])

    const quickIsolate = useCallback((clash: ClashItem) => {
        onClashSelect([clash.id], [clash.a_global_id, clash.b_global_id], [clash.p1])
    }, [onClashSelect])

    if (!allClashes || allClashes.length === 0) {
        return (
            <div style={{
                width: '320px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                fontSize: '0.875rem'
            }}>
                No clashes detected
            </div>
        )
    }

    return (
        <div style={{
            width: '320px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '600px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
            {/* Header with Controls */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #e2e8f0',
                background: '#ffffff',
                borderRadius: '8px 8px 0 0'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12
                }}>
                    <h3 style={{
                        margin: 0,
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: '#1e293b'
                    }}>
                        🔥 Clash Navigator
                    </h3>
                    <span style={{
                        background: '#ef4444',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: '0.75rem',
                        fontWeight: '500'
                    }}>
                        {filteredClashes.length}
                    </span>
                </div>

                {/* Search Bar */}
                <div style={{ marginBottom: 8 }}>
                    <input
                        type="text"
                        placeholder="🔍 Search elements..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '6px 10px',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            fontSize: '0.75rem',
                            outline: 'none'
                        }}
                    />
                </div>

                {/* Quick Filters */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                    {(['all', 'critical', 'high', 'medium', 'low'] as const).map(severity => (
                        <button
                            key={severity}
                            onClick={() => setFilterType(severity)}
                            style={{
                                padding: '2px 6px',
                                background: filterType === severity ? getSeverityColor(severity === 'all' ? 'critical' : severity) : '#f3f4f6',
                                color: filterType === severity ? 'white' : '#374151',
                                border: '1px solid #d1d5db',
                                borderRadius: 3,
                                fontSize: '0.625rem',
                                cursor: 'pointer'
                            }}
                        >
                            {severity === 'all' ? 'All' : severity.charAt(0).toUpperCase() + severity.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Group Controls */}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.625rem', color: '#6b7280' }}>Group by:</span>
                    <select
                        value={groupBy}
                        onChange={(e) => setGroupBy(e.target.value as any)}
                        style={{
                            padding: '2px 4px',
                            border: '1px solid #d1d5db',
                            borderRadius: 3,
                            fontSize: '0.625rem'
                        }}
                    >
                        <option value="none">None</option>
                        <option value="severity">Severity</option>
                        <option value="type">Type</option>
                        <option value="storey">Storey</option>
                    </select>
                </div>

                {/* Selection Status */}
                {selectedClashes.size > 0 && (
                    <div style={{
                        display: 'flex',
                        gap: 6,
                        alignItems: 'center',
                        padding: 8,
                        background: '#f0f9ff',
                        borderRadius: 4
                    }}>
                        <span style={{
                            fontSize: '0.75rem',
                            color: '#0c4a6e',
                            fontWeight: '500'
                        }}>
                            {selectedClashes.size} selected
                        </span>
                        <button
                            onClick={handleClearAll}
                            style={{
                                padding: '2px 6px',
                                background: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: 3,
                                fontSize: '0.625rem',
                                cursor: 'pointer'
                            }}
                        >
                            ✕ Clear
                        </button>
                    </div>
                )}
            </div>

            {/* Clash Groups */}
            <div style={{
                flex: 1,
                overflowY: 'auto'
            }}>
                {Object.entries(paginatedClashes).map(([groupName, clashes]) => (
                    <div key={groupName} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        {/* Group Header */}
                        {groupBy !== 'none' && (
                            <div style={{
                                padding: '8px 16px',
                                background: '#f8fafc',
                                borderBottom: '1px solid #e2e8f0',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                color: '#374151'
                            }}>
                                {groupName} ({clashes.length})
                            </div>
                        )}

                        {/* Clash Items */}
                        <div style={{ padding: '4px 8px' }}>
                            {clashes.map((clash, index) => {
                                const isSelected = selectedClashes.has(clash.id)
                                const isExpanded = expandedClashes.has(clash.id)
                                const displayIndex = groupBy === 'none'
                                    ? (currentPage - 1) * itemsPerPage + index + 1
                                    : index + 1

                                return (
                                    <div key={clash.id} style={{ marginBottom: 4 }}>
                                        <div
                                            onClick={() => handleClashClick(clash.id)}
                                            style={{
                                                padding: '8px 10px',
                                                background: isSelected ? '#dbeafe' : '#ffffff',
                                                border: `1px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                                                borderRadius: 6,
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                transition: 'all 0.2s ease',
                                                position: 'relative'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.background = '#f8fafc'
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.background = '#ffffff'
                                                }
                                            }}
                                        >
                                            {/* Header Row */}
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: 4
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{
                                                        fontSize: '0.625rem',
                                                        color: '#6b7280',
                                                        fontWeight: '500'
                                                    }}>
                                                        #{displayIndex}
                                                    </span>
                                                    <span style={{
                                                        background: getSeverityColor(clash.severity),
                                                        color: 'white',
                                                        padding: '1px 4px',
                                                        borderRadius: 8,
                                                        fontSize: '0.5rem',
                                                        fontWeight: '600',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {clash.severity}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            quickIsolate(clash)
                                                        }}
                                                        style={{
                                                            padding: '2px 4px',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            borderRadius: 3,
                                                            fontSize: '0.625rem',
                                                            cursor: 'pointer',
                                                            color: '#3b82f6'
                                                        }}
                                                        title="Quick isolate in 3D"
                                                    >
                                                        👁️
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            toggleClashExpansion(clash.id)
                                                        }}
                                                        style={{
                                                            padding: '2px 4px',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            borderRadius: 3,
                                                            fontSize: '0.625rem',
                                                            cursor: 'pointer',
                                                            color: '#6b7280'
                                                        }}
                                                    >
                                                        {isExpanded ? '−' : '+'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Element Names */}
                                            <div style={{
                                                fontSize: '0.7rem',
                                                color: '#374151',
                                                lineHeight: 1.3,
                                                marginBottom: 4
                                            }}>
                                                <div style={{
                                                    background: getIFCClassColor(clash.a_ifc_class),
                                                    color: 'white',
                                                    padding: '1px 3px',
                                                    borderRadius: 2,
                                                    display: 'inline-block',
                                                    fontSize: '0.5rem',
                                                    fontWeight: '600',
                                                    marginRight: 4
                                                }}>
                                                    {clash.a_ifc_class}
                                                </div>
                                                {clash.a_name || clash.a_global_id?.slice(-8)}
                                            </div>

                                            <div style={{
                                                fontSize: '0.7rem',
                                                color: '#374151',
                                                lineHeight: 1.3,
                                                marginBottom: 4
                                            }}>
                                                <div style={{
                                                    background: getIFCClassColor(clash.b_ifc_class),
                                                    color: 'white',
                                                    padding: '1px 3px',
                                                    borderRadius: 2,
                                                    display: 'inline-block',
                                                    fontSize: '0.5rem',
                                                    fontWeight: '600',
                                                    marginRight: 4
                                                }}>
                                                    {clash.b_ifc_class}
                                                </div>
                                                {clash.b_name || clash.b_global_id?.slice(-8)}
                                            </div>

                                            {/* Distance */}
                                            <div style={{
                                                fontSize: '0.625rem',
                                                color: '#6b7280',
                                                fontWeight: '500'
                                            }}>
                                                📏 {clash.distance.toFixed(3)}m
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div style={{
                                                padding: '8px 12px',
                                                background: '#f8fafc',
                                                border: '1px solid #e2e8f0',
                                                borderTop: 'none',
                                                borderRadius: '0 0 6px 6px',
                                                fontSize: '0.625rem',
                                                color: '#6b7280'
                                            }}>
                                                <div style={{ marginBottom: 4 }}>
                                                    <strong>Type:</strong> {clash.type}
                                                </div>
                                                <div style={{ marginBottom: 4 }}>
                                                    <strong>Set:</strong> {clash.setName}
                                                </div>
                                                {(clash.a_building_storey || clash.b_building_storey) && (
                                                    <div style={{ marginBottom: 4 }}>
                                                        <strong>Storey:</strong> {clash.a_building_storey || clash.b_building_storey}
                                                    </div>
                                                )}
                                                <div style={{ marginBottom: 4 }}>
                                                    <strong>Position:</strong> [{clash.p1.map(c => c.toFixed(1)).join(', ')}]
                                                </div>
                                                <div>
                                                    <strong>ID:</strong> {clash.id.slice(-8)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{
                        padding: '8px 16px',
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 4
                    }}>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            style={{
                                padding: '4px 8px',
                                background: currentPage === 1 ? '#f3f4f6' : '#3b82f6',
                                color: currentPage === 1 ? '#9ca3af' : 'white',
                                border: 'none',
                                borderRadius: 4,
                                fontSize: '0.625rem',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                            }}
                        >
                            ← Prev
                        </button>
                        <span style={{
                            fontSize: '0.625rem',
                            color: '#6b7280',
                            alignSelf: 'center'
                        }}>
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            style={{
                                padding: '4px 8px',
                                background: currentPage === totalPages ? '#f3f4f6' : '#3b82f6',
                                color: currentPage === totalPages ? '#9ca3af' : 'white',
                                border: 'none',
                                borderRadius: 4,
                                fontSize: '0.625rem',
                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                            }}
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>

            {/* Keyboard Shortcuts Hint */}
            <div style={{
                padding: '8px 16px',
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                fontSize: '0.625rem',
                color: '#9ca3af',
                textAlign: 'center'
            }}>
                Use ↑↓ to navigate, Enter to expand, Esc to clear
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
