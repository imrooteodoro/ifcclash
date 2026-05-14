import { useState } from 'react'
import { Layers, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react'
import { ModelLayer } from '../IfcJsViewer'

interface Props {
    layers: ModelLayer[]
    onVisibilityChange: (modelId: number, visible: boolean) => void
    onOpacityChange: (modelId: number, opacity: number) => void
}

export default function ModelLayersPanel({ layers, onVisibilityChange, onOpacityChange }: Props) {
    const [collapsed, setCollapsed] = useState(false)
    const [opacities, setOpacities] = useState<Record<number, number>>({})

    if (layers.length === 0) return null

    const getOpacity = (id: number) => opacities[id] ?? 1

    return (
        <div style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 10,
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            minWidth: 220,
            maxWidth: 280,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            color: '#e2e8f0',
            fontSize: '0.8125rem',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div
                onClick={() => setCollapsed(c => !c)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    userSelect: 'none'
                }}
            >
                <Layers size={15} style={{ color: '#60a5fa', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, flex: 1 }}>Layers</span>
                <span style={{
                    background: '#3b82f6',
                    color: 'white',
                    borderRadius: 10,
                    padding: '1px 7px',
                    fontSize: '0.6875rem',
                    fontWeight: 600
                }}>{layers.length}</span>
                {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </div>

            {/* Layer list */}
            {!collapsed && (
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {layers.map(layer => {
                        const opacity = getOpacity(layer.id)
                        return (
                            <div key={layer.id} style={{
                                padding: '8px 12px',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                            }}>
                                {/* Name + visibility toggle */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                    <button
                                        onClick={() => onVisibilityChange(layer.id, !layer.visible)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: 2,
                                            color: layer.visible ? '#60a5fa' : '#475569',
                                            display: 'flex',
                                            flexShrink: 0
                                        }}
                                        title={layer.visible ? 'Hide layer' : 'Show layer'}
                                    >
                                        {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                                    </button>
                                    <span style={{
                                        flex: 1,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        color: layer.visible ? '#e2e8f0' : '#64748b',
                                        fontWeight: 500
                                    }} title={layer.name}>
                                        {layer.name}
                                    </span>
                                </div>

                                {/* Opacity slider */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: '0.625rem', color: '#94a3b8', width: 44 }}>
                                        Opacity
                                    </span>
                                    <input
                                        type="range"
                                        min={0} max={1} step={0.05}
                                        value={opacity}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value)
                                            setOpacities(prev => ({ ...prev, [layer.id]: val }))
                                            onOpacityChange(layer.id, val)
                                        }}
                                        style={{ flex: 1, accentColor: '#3b82f6', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '0.625rem', color: '#94a3b8', width: 28, textAlign: 'right' }}>
                                        {Math.round(opacity * 100)}%
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
