import React, { useState } from 'react'

export type ClashSource = {
    file: string
    selector?: string
    mode?: 'i' | 'e'
    entityTypes?: string[]
}

export type ClashSet = {
    name: string
    a: ClashSource[]
    b?: ClashSource[]
    mode?: 'collision' | 'intersection' | 'clearance'
    allow_touching?: boolean
    tolerance?: number
    clearance?: number
    check_all?: boolean
}

// Preset configurations for common clash detection scenarios
const PRESETS: Record<string, Omit<ClashSet, 'name'> & { name: string }> = {
    'structural-mep': {
        name: 'Structural vs MEP',
        a: [{ file: '', entityTypes: ['IfcWall', 'IfcColumn', 'IfcBeam', 'IfcSlab'] }],
        b: [{ file: '', entityTypes: ['IfcPipe', 'IfcDuct', 'IfcCableCarrier'] }],
        mode: 'collision' as const,
        allow_touching: false,
        check_all: true
    },
    'mep-mep': {
        name: 'MEP vs MEP',
        a: [{ file: '', entityTypes: ['IfcPipe'] }],
        b: [{ file: '', entityTypes: ['IfcDuct', 'IfcCableCarrier'] }],
        mode: 'collision' as const,
        allow_touching: false,
        check_all: true
    },
    'architectural-structural': {
        name: 'Architectural vs Structural',
        a: [{ file: '', entityTypes: ['IfcWall', 'IfcDoor', 'IfcWindow'] }],
        b: [{ file: '', entityTypes: ['IfcBeam', 'IfcColumn'] }],
        mode: 'intersection' as const,
        tolerance: 0.01,
        check_all: true
    },
    'clearance-check': {
        name: 'Clearance Analysis',
        a: [{ file: '', entityTypes: ['IfcPipe', 'IfcDuct'] }],
        b: [{ file: '', entityTypes: ['IfcWall', 'IfcSlab'] }],
        mode: 'clearance' as const,
        clearance: 0.1,
        check_all: true
    },
    'within-structural': {
        name: 'Within Structural',
        a: [{ file: '', entityTypes: ['IfcBeam', 'IfcColumn', 'IfcSlab'] }],
        mode: 'collision' as const,
        allow_touching: false,
        check_all: true
    },
    'mep-routing': {
        name: 'MEP Routing Analysis',
        a: [{ file: '', entityTypes: ['IfcPipe', 'IfcDuct', 'IfcCableCarrier'] }],
        mode: 'collision' as const,
        allow_touching: false,
        check_all: true
    },
    'collision-only': {
        name: 'Hard Collision Check',
        a: [{ file: '', entityTypes: ['IfcWall', 'IfcBeam', 'IfcColumn', 'IfcPipe', 'IfcDuct'] }],
        mode: 'collision' as const,
        allow_touching: false,
        check_all: true
    },
    'accessibility-clearance': {
        name: 'Accessibility Clearance',
        a: [{ file: '', entityTypes: ['IfcWall', 'IfcDoor', 'IfcStair'] }],
        b: [{ file: '', entityTypes: ['IfcFurniture', 'IfcSanitaryTerminal'] }],
        mode: 'clearance' as const,
        clearance: 0.75,
        check_all: true
    }
}

// Common IFC entity types grouped by category
const ENTITY_CATEGORIES = {
    'Structural': [
        'IfcBeam', 'IfcColumn', 'IfcSlab', 'IfcWallStandardCase', 'IfcWall',
        'IfcFooting', 'IfcPile', 'IfcRamp', 'IfcStair', 'IfcRoof'
    ],
    'MEP': [
        'IfcPipeSegment', 'IfcPipe', 'IfcDuctSegment', 'IfcDuct',
        'IfcCableCarrier', 'IfcCableSegment', 'IfcFlowTerminal'
    ],
    'Architectural': [
        'IfcDoor', 'IfcWindow', 'IfcWall', 'IfcCurtainWall', 'IfcRoof',
        'IfcFloor', 'IfcCeiling', 'IfcStair', 'IfcRamp'
    ],
    'Equipment': [
        'IfcFurniture', 'IfcSanitaryTerminal', 'IfcElectricAppliance',
        'IfcMechanicalFastener', 'IfcDiscreteAccessory'
    ]
}

type Props = {
    files: File[]
    value: ClashSet[]
    onChange: (sets: ClashSet[]) => void
}

export default function ClashSetBuilder({ files, value, onChange }: Props) {
    const [activeTab, setActiveTab] = useState<'builder' | 'presets'>('builder')
    const [expandedSet, setExpandedSet] = useState<number | null>(null)
    const [showEntitySelector, setShowEntitySelector] = useState<{ setIdx: number; group: 'a' | 'b'; sourceIdx: number } | null>(null)

    const fileOptions = files.map(f => f.name)

    const updateSet = (idx: number, patch: Partial<ClashSet>) => {
        const next = value.slice()
        next[idx] = { ...next[idx], ...patch }
        onChange(next)
    }

    const addSet = () => {
        const newSet = { name: `Clash Set ${value.length + 1}`, a: [], b: [] }
        onChange([...value, newSet])
        setExpandedSet(value.length) // Auto-expand new set
    }

    const removeSet = (idx: number) => onChange(value.filter((_, i) => i !== idx))

    const duplicateSet = (idx: number) => {
        const set = value[idx]
        const duplicate = {
            ...set,
            name: `${set.name} (Copy)`,
            a: set.a.map(s => ({ ...s })),
            b: set.b?.map(s => ({ ...s }))
        }
        onChange([...value.slice(0, idx + 1), duplicate, ...value.slice(idx + 1)])
    }

    const addSource = (idx: number, group: 'a' | 'b') => {
        const s = value[idx]
        const list = Array.from((s[group] || []) as ClashSource[])
        list.push({ file: fileOptions[0] || '', entityTypes: [] })
        updateSet(idx, { [group]: list } as any)
    }

    const updateSource = (idx: number, group: 'a' | 'b', sIdx: number, patch: Partial<ClashSource>) => {
        const s = value[idx]
        const list = Array.from((s[group] || []) as ClashSource[])
        list[sIdx] = { ...list[sIdx], ...patch }
        updateSet(idx, { [group]: list } as any)
    }

    const removeSource = (idx: number, group: 'a' | 'b', sIdx: number) => {
        const s = value[idx]
        const list = Array.from((s[group] || []) as ClashSource[])
        list.splice(sIdx, 1)
        updateSet(idx, { [group]: list } as any)
    }

    const applyPreset = (presetKey: keyof typeof PRESETS) => {
        const preset = PRESETS[presetKey]
        const newSet: ClashSet = {
            name: `${preset.name} ${value.length + 1}`,
            a: preset.a.map(src => ({
                ...src,
                file: fileOptions[0] || ''
            })),
            ...(preset.b && {
                b: preset.b.map(src => ({
                    ...src,
                    file: fileOptions[0] || ''
                }))
            }),
            ...(preset.mode && { mode: preset.mode }),
            ...(preset.allow_touching !== undefined && { allow_touching: preset.allow_touching }),
            ...(preset.tolerance !== undefined && { tolerance: preset.tolerance }),
            ...(preset.clearance !== undefined && { clearance: preset.clearance }),
            ...(preset.check_all !== undefined && { check_all: preset.check_all })
        }
        onChange([...value, newSet])
        setExpandedSet(value.length)
    }

    const toggleEntityType = (setIdx: number, group: 'a' | 'b', sourceIdx: number, entityType: string) => {
        const source = value[setIdx][group]?.[sourceIdx]
        if (!source) return

        const entityTypes = source.entityTypes || []
        const updated = entityTypes.includes(entityType)
            ? entityTypes.filter(t => t !== entityType)
            : [...entityTypes, entityType]

        updateSource(setIdx, group, sourceIdx, { entityTypes: updated })
    }

    const getEntityTypeDisplay = (entityTypes: string[] = []) => {
        if (entityTypes.length === 0) return 'All entities'
        if (entityTypes.length <= 3) return entityTypes.join(', ')
        return `${entityTypes.slice(0, 3).join(', ')} +${entityTypes.length - 3} more`
    }

    const renderEntitySelector = () => {
        if (!showEntitySelector) return null

        const { setIdx, group, sourceIdx } = showEntitySelector
        const source = value[setIdx][group]?.[sourceIdx]
        const selectedTypes = source?.entityTypes || []

        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }} onClick={() => setShowEntitySelector(null)}>
                <div style={{
                    background: 'white',
                    borderRadius: 12,
                    padding: 24,
                    maxWidth: 600,
                    maxHeight: '80vh',
                    overflow: 'auto',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 style={{ margin: 0, color: '#1e293b' }}>Select IFC Entity Types</h3>
                        <button
                            onClick={() => setShowEntitySelector(null)}
                            style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}
                        >
                            ×
                        </button>
                    </div>

                    {Object.entries(ENTITY_CATEGORIES).map(([category, types]) => (
                        <div key={category} style={{ marginBottom: 20 }}>
                            <h4 style={{ margin: '0 0 12px 0', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: 4 }}>
                                {category}
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                                {types.map(type => (
                                    <label key={type} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: 8,
                                        borderRadius: 6,
                                        background: selectedTypes.includes(type) ? '#dbeafe' : '#f8fafc',
                                        border: `1px solid ${selectedTypes.includes(type) ? '#3b82f6' : '#e2e8f0'}`,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedTypes.includes(type)}
                                            onChange={() => toggleEntityType(setIdx, group, sourceIdx, type)}
                                            style={{ marginRight: 8 }}
                                        />
                                        <span style={{ fontSize: '0.875rem', color: '#374151' }}>{type}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                        <button
                            onClick={() => updateSource(setIdx, group, sourceIdx, { entityTypes: [] })}
                            style={{
                                padding: '8px 16px',
                                background: '#f3f4f6',
                                border: '1px solid #d1d5db',
                                borderRadius: 6,
                                cursor: 'pointer',
                                color: '#374151'
                            }}
                        >
                            Clear All
                        </button>
                        <button
                            onClick={() => {
                                const allTypes = Object.values(ENTITY_CATEGORIES).flat()
                                updateSource(setIdx, group, sourceIdx, { entityTypes: allTypes })
                            }}
                            style={{
                                padding: '8px 16px',
                                background: '#f3f4f6',
                                border: '1px solid #d1d5db',
                                borderRadius: 6,
                                cursor: 'pointer',
                                color: '#374151'
                            }}
                        >
                            Select All
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div style={{ padding: 24, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            {/* Header with tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.5rem' }}>Clash Configuration</h2>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                        Define clash detection sets and parameters
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
                    <button
                        onClick={() => setActiveTab('builder')}
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            borderRadius: 6,
                            background: activeTab === 'builder' ? '#3b82f6' : 'transparent',
                            color: activeTab === 'builder' ? 'white' : '#64748b',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: activeTab === 'builder' ? '500' : '400'
                        }}
                    >
                        Builder
                    </button>
                    <button
                        onClick={() => setActiveTab('presets')}
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            borderRadius: 6,
                            background: activeTab === 'presets' ? '#3b82f6' : 'transparent',
                            color: activeTab === 'presets' ? 'white' : '#64748b',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: activeTab === 'presets' ? '500' : '400'
                        }}
                    >
                        Presets
                    </button>
                </div>
            </div>

            {activeTab === 'presets' && (
                <div style={{ marginBottom: 24 }}>
                    <h3 style={{ margin: '0 0 16px 0', color: '#374151' }}>Quick Start Presets</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                        {Object.entries(PRESETS).map(([key, preset]) => {
                            const hasGroupB = 'b' in preset && preset.b && preset.b.length > 0
                            return (
                                <div key={key} style={{
                                    padding: 20,
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 8,
                                    background: '#fafbfc',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                    onClick={() => applyPreset(key as keyof typeof PRESETS)}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>{preset.name}</h4>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
                                        {preset.a[0].entityTypes?.slice(0, 3).join(', ')}
                                        {preset.a[0].entityTypes && preset.a[0].entityTypes.length > 3 ? '...' : ''}
                                        {hasGroupB ? ' vs ' : ' analysis'}
                                        {hasGroupB && preset.b?.[0].entityTypes?.slice(0, 3).join(', ')}
                                        {hasGroupB && preset.b?.[0].entityTypes && preset.b[0].entityTypes.length > 3 ? '...' : ''}
                                    </p>
                                    <div style={{
                                        marginTop: 12,
                                        padding: '4px 8px',
                                        background: '#dbeafe',
                                        color: '#1d4ed8',
                                        borderRadius: 12,
                                        fontSize: '0.75rem',
                                        fontWeight: '500',
                                        display: 'inline-block'
                                    }}>
                                        {preset.mode}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'builder' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                            {value.length} clash {value.length === 1 ? 'set' : 'sets'} configured
                        </span>
                        <button
                            onClick={addSet}
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
                            + Add Clash Set
                        </button>
                    </div>

                    {value.length === 0 && (
                        <div style={{
                            textAlign: 'center',
                            padding: 48,
                            color: '#64748b',
                            background: '#f8fafc',
                            borderRadius: 8,
                            border: '2px dashed #e2e8f0'
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: 12 }}>📋</div>
                            <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>No Clash Sets Yet</h3>
                            <p style={{ margin: 0, fontSize: '0.875rem' }}>
                                Click "Add Clash Set" to create your first clash detection configuration
                            </p>
                        </div>
                    )}

                    {value.map((cs, idx) => (
                        <div key={idx} style={{
                            marginBottom: 16,
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            overflow: 'hidden',
                            background: 'white'
                        }}>
                            {/* Set Header */}
                            <div style={{
                                padding: 16,
                                background: '#f8fafc',
                                borderBottom: '1px solid #e2e8f0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>#{idx + 1}</span>
                                    <input
                                        value={cs.name}
                                        onChange={e => updateSet(idx, { name: e.target.value })}
                                        placeholder="Clash set name"
                                        style={{
                                            flex: 1,
                                            padding: '6px 12px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: 4,
                                            fontSize: '0.875rem'
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        onClick={() => setExpandedSet(expandedSet === idx ? null : idx)}
                                        style={{
                                            padding: '6px 12px',
                                            background: '#f3f4f6',
                                            border: '1px solid #d1d5db',
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            fontSize: '0.75rem'
                                        }}
                                    >
                                        {expandedSet === idx ? 'Collapse' : 'Expand'}
                                    </button>
                                    <button
                                        onClick={() => duplicateSet(idx)}
                                        style={{
                                            padding: '6px 12px',
                                            background: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            fontSize: '0.75rem'
                                        }}
                                    >
                                        Duplicate
                                    </button>
                                    <button
                                        onClick={() => removeSet(idx)}
                                        style={{
                                            padding: '6px 12px',
                                            background: '#ef4444',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            fontSize: '0.75rem'
                                        }}
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>

                            {/* Set Content */}
                            {expandedSet === idx && (
                                <div style={{ padding: 16 }}>
                                    {/* Mode Settings */}
                                    <div style={{ marginBottom: 20 }}>
                                        <h4 style={{ margin: '0 0 12px 0', color: '#374151', fontSize: '1rem' }}>Detection Mode</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
                                            {[
                                                {
                                                    value: 'collision',
                                                    label: 'Collision Detection',
                                                    desc: 'Hard intersection detection',
                                                    icon: '💥',
                                                    details: 'Finds elements that physically occupy the same 3D space. Most restrictive but fastest detection method.'
                                                },
                                                {
                                                    value: 'intersection',
                                                    label: 'Intersection Analysis',
                                                    desc: 'Tolerance-based detection',
                                                    icon: '🔄',
                                                    details: 'Finds elements that cross each other within a specified tolerance distance. Good for MEP routing analysis.'
                                                },
                                                {
                                                    value: 'clearance',
                                                    label: 'Clearance Verification',
                                                    desc: 'Minimum spacing requirements',
                                                    icon: '📏',
                                                    details: 'Ensures minimum clearance distances between elements. Critical for safety and accessibility compliance.'
                                                }
                                            ].map(mode => (
                                                <label key={mode.value} style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    padding: 16,
                                                    border: `2px solid ${cs.mode === mode.value ? '#3b82f6' : '#e2e8f0'}`,
                                                    borderRadius: 8,
                                                    background: cs.mode === mode.value ? '#eff6ff' : 'white',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    position: 'relative'
                                                }}
                                                    onMouseEnter={(e) => {
                                                        if (cs.mode !== mode.value) {
                                                            e.currentTarget.style.borderColor = '#93c5fd';
                                                            e.currentTarget.style.background = '#f0f9ff';
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (cs.mode !== mode.value) {
                                                            e.currentTarget.style.borderColor = '#e2e8f0';
                                                            e.currentTarget.style.background = 'white';
                                                        }
                                                    }}
                                                >
                                                    <input
                                                        type="radio"
                                                        name={`mode-${idx}`}
                                                        value={mode.value}
                                                        checked={cs.mode === mode.value}
                                                        onChange={e => updateSet(idx, { mode: e.target.value as any })}
                                                        style={{
                                                            marginTop: 2,
                                                            marginRight: 12,
                                                            accentColor: '#3b82f6'
                                                        }}
                                                    />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                            <span style={{ fontSize: '1.25rem' }}>{mode.icon}</span>
                                                            <div style={{ fontWeight: '600', color: '#1e293b' }}>{mode.label}</div>
                                                        </div>
                                                        <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: 4 }}>{mode.desc}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: '1.4' }}>{mode.details}</div>
                                                    </div>
                                                    {cs.mode === mode.value && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: -8,
                                                            right: -8,
                                                            background: '#3b82f6',
                                                            color: 'white',
                                                            borderRadius: '50%',
                                                            width: 20,
                                                            height: 20,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            ✓
                                                        </div>
                                                    )}
                                                </label>
                                            ))}
                                        </div>

                                        {/* Mode-specific help text */}
                                        {cs.mode && (
                                            <div style={{
                                                marginTop: 12,
                                                padding: 12,
                                                background: '#f8fafc',
                                                borderRadius: 6,
                                                border: '1px solid #e2e8f0'
                                            }}>
                                                <div style={{ fontSize: '0.875rem', color: '#374151', fontWeight: '500', marginBottom: 4 }}>
                                                    {cs.mode === 'collision' && '💥 Collision Detection'}
                                                    {cs.mode === 'intersection' && '🔄 Intersection Detection'}
                                                    {cs.mode === 'clearance' && '📏 Clearance Analysis'}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                    {cs.mode === 'collision' && 'Finds elements that physically occupy the same 3D space. Best for detecting hard construction conflicts.'}
                                                    {cs.mode === 'intersection' && 'Finds elements that cross each other within tolerance. Useful for MEP routing and coordination analysis.'}
                                                    {cs.mode === 'clearance' && 'Ensures minimum spacing requirements are met. Critical for safety, accessibility, and code compliance.'}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Advanced Settings */}
                                    {cs.mode && (
                                        <div style={{ marginBottom: 20 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                                <h4 style={{ margin: 0, color: '#374151', fontSize: '1rem' }}>Advanced Settings</h4>
                                                <span style={{
                                                    background: '#e0f2fe',
                                                    color: '#0277bd',
                                                    padding: '2px 8px',
                                                    borderRadius: 12,
                                                    fontSize: '0.75rem',
                                                    fontWeight: '500'
                                                }}>
                                                    Optional
                                                </span>
                                            </div>

                                            <div style={{
                                                padding: 16,
                                                background: '#f8fafc',
                                                borderRadius: 8,
                                                border: '1px solid #e2e8f0'
                                            }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                                                    {cs.mode === 'collision' && (
                                                        <div style={{ padding: 12, background: 'white', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                                <span style={{ fontSize: '1rem' }}>👆</span>
                                                                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Touching Elements</span>
                                                            </div>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={cs.allow_touching ?? false}
                                                                    onChange={e => updateSet(idx, { allow_touching: e.target.checked })}
                                                                    style={{ accentColor: '#3b82f6' }}
                                                                />
                                                                <div>
                                                                    <div style={{ fontSize: '0.875rem', color: '#374151', fontWeight: '500' }}>Allow touching elements</div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                                                                        When enabled, elements that only touch (no overlap) won't be flagged as clashes
                                                                    </div>
                                                                </div>
                                                            </label>
                                                        </div>
                                                    )}

                                                    {(cs.mode === 'intersection' || cs.mode === 'clearance') && (
                                                        <div style={{ padding: 12, background: 'white', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                                <span style={{ fontSize: '1rem' }}>📐</span>
                                                                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                                                                    {cs.mode === 'intersection' ? 'Tolerance Distance' : 'Minimum Clearance'}
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <input
                                                                    type="number"
                                                                    step="0.001"
                                                                    min="0"
                                                                    max="10"
                                                                    value={cs.mode === 'intersection' ? (cs.tolerance ?? 0.01) : (cs.clearance ?? 0.01)}
                                                                    onChange={e => updateSet(idx, {
                                                                        [cs.mode === 'intersection' ? 'tolerance' : 'clearance']: parseFloat(e.target.value) || 0
                                                                    })}
                                                                    style={{
                                                                        flex: 1,
                                                                        padding: '8px 12px',
                                                                        border: '1px solid #d1d5db',
                                                                        borderRadius: 4,
                                                                        fontSize: '0.875rem',
                                                                        fontFamily: 'monospace'
                                                                    }}
                                                                />
                                                                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>meters</span>
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                                                                {cs.mode === 'intersection'
                                                                    ? 'Maximum distance for elements to be considered intersecting'
                                                                    : 'Minimum required spacing between elements'
                                                                }
                                                            </div>
                                                        </div>
                                                    )}

                                                    {cs.mode && (
                                                        <div style={{ padding: 12, background: 'white', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                                <span style={{ fontSize: '1rem' }}>🔍</span>
                                                                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Analysis Scope</span>
                                                            </div>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={cs.check_all ?? true}
                                                                    onChange={e => updateSet(idx, { check_all: e.target.checked })}
                                                                    style={{ accentColor: '#3b82f6' }}
                                                                />
                                                                <div>
                                                                    <div style={{ fontSize: '0.875rem', color: '#374151', fontWeight: '500' }}>Check all combinations</div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                                                                        When enabled, compares every element against every other element in scope
                                                                    </div>
                                                                </div>
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Performance Tip */}
                                                <div style={{
                                                    marginTop: 16,
                                                    padding: 12,
                                                    background: '#fef3c7',
                                                    borderRadius: 6,
                                                    border: '1px solid #f59e0b'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                        <span style={{ fontSize: '1rem' }}>💡</span>
                                                        <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#92400e' }}>Performance Tip</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#92400e' }}>
                                                        {cs.mode === 'collision' && 'Collision detection is fastest but most restrictive. Use for critical construction conflicts.'}
                                                        {cs.mode === 'intersection' && 'Intersection detection with small tolerance (0.01m) balances speed and thoroughness for coordination.'}
                                                        {cs.mode === 'clearance' && 'Clearance analysis is most thorough but slowest. Use for final safety and accessibility validation.'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Group Configuration Guide */}
                                    <div style={{
                                        marginBottom: 20,
                                        padding: 16,
                                        background: '#f0f9ff',
                                        borderRadius: 8,
                                        border: '1px solid #0ea5e9'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                            <span style={{ fontSize: '1rem' }}>📋</span>
                                            <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#0c4a6e' }}>Group Configuration</span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#075985', lineHeight: '1.5' }}>
                                            <strong>Group A:</strong> Primary elements to check for clashes<br />
                                            <strong>Group B:</strong> Secondary elements (optional). If configured, checks clashes <em>between</em> Group A and Group B. If not configured, checks clashes <em>within</em> Group A only.<br />
                                            <em>Example: To check clashes between structural beams and MEP pipes, put beams in Group A and pipes in Group B.</em>
                                        </div>
                                    </div>

                                    {/* Group Configuration */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                        {(['a', 'b'] as const).map(group => (
                                            <div key={group}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                    <h4 style={{ margin: 0, color: '#374151', fontSize: '1rem' }}>
                                                        Group {group.toUpperCase()}
                                                        {group === 'b' && <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 'normal' }}> (Optional)</span>}
                                                    </h4>
                                                    <button
                                                        onClick={() => addSource(idx, group)}
                                                        style={{
                                                            padding: '4px 8px',
                                                            background: '#f3f4f6',
                                                            border: '1px solid #d1d5db',
                                                            borderRadius: 4,
                                                            cursor: 'pointer',
                                                            fontSize: '0.75rem'
                                                        }}
                                                    >
                                                        + Add Source
                                                    </button>
                                                </div>

                                                {((cs[group] || []) as ClashSource[]).length === 0 && (
                                                    <div style={{
                                                        padding: 20,
                                                        textAlign: 'center',
                                                        color: '#64748b',
                                                        background: '#f8fafc',
                                                        borderRadius: 6,
                                                        border: '1px dashed #e2e8f0'
                                                    }}>
                                                        No sources added yet
                                                    </div>
                                                )}

                                                {((cs[group] || []) as ClashSource[]).map((src, sIdx) => (
                                                    <div key={sIdx} style={{
                                                        padding: 12,
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: 6,
                                                        marginBottom: 8,
                                                        background: '#fafbfc'
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                            <span style={{ fontSize: '0.875rem', color: '#374151', fontWeight: '500' }}>
                                                                Source {sIdx + 1}
                                                            </span>
                                                            <button
                                                                onClick={() => removeSource(idx, group, sIdx)}
                                                                style={{
                                                                    padding: '2px 6px',
                                                                    background: '#ef4444',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: 3,
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.75rem'
                                                                }}
                                                            >
                                                                ×
                                                            </button>
                                                        </div>

                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: 4 }}>
                                                                    IFC File
                                                                </label>
                                                                <select
                                                                    value={src.file}
                                                                    onChange={e => updateSource(idx, group, sIdx, { file: e.target.value })}
                                                                    style={{
                                                                        width: '100%',
                                                                        padding: '6px 8px',
                                                                        border: '1px solid #d1d5db',
                                                                        borderRadius: 4,
                                                                        fontSize: '0.875rem'
                                                                    }}
                                                                >
                                                                    {fileOptions.length === 0 && <option value="">(no files)</option>}
                                                                    {fileOptions.map(n => <option key={n} value={n}>{n}</option>)}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: 4 }}>
                                                                    Mode
                                                                </label>
                                                                <select
                                                                    value={src.mode || 'i'}
                                                                    onChange={e => updateSource(idx, group, sIdx, { mode: (e.target.value as 'i' | 'e') })}
                                                                    style={{
                                                                        width: '100%',
                                                                        padding: '6px 8px',
                                                                        border: '1px solid #d1d5db',
                                                                        borderRadius: 4,
                                                                        fontSize: '0.875rem'
                                                                    }}
                                                                >
                                                                    <option value="i">Include</option>
                                                                    <option value="e">Exclude</option>
                                                                </select>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: 4 }}>
                                                                Entity Types
                                                            </label>
                                                            <button
                                                                onClick={() => setShowEntitySelector({ setIdx: idx, group, sourceIdx: sIdx })}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '8px 12px',
                                                                    background: '#f8fafc',
                                                                    border: '1px solid #d1d5db',
                                                                    borderRadius: 4,
                                                                    cursor: 'pointer',
                                                                    textAlign: 'left',
                                                                    fontSize: '0.875rem',
                                                                    color: '#374151'
                                                                }}
                                                            >
                                                                {getEntityTypeDisplay(src.entityTypes)}
                                                            </button>
                                                        </div>

                                                        {src.selector && (
                                                            <div style={{ marginTop: 8 }}>
                                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: 4 }}>
                                                                    Custom Selector
                                                                </label>
                                                                <input
                                                                    value={src.selector}
                                                                    onChange={e => updateSource(idx, group, sIdx, { selector: e.target.value })}
                                                                    placeholder="e.g., IfcWall,IfcDoor"
                                                                    style={{
                                                                        width: '100%',
                                                                        padding: '6px 8px',
                                                                        border: '1px solid #d1d5db',
                                                                        borderRadius: 4,
                                                                        fontSize: '0.875rem'
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </>
            )}

            {renderEntitySelector()}
        </div>
    )
}


