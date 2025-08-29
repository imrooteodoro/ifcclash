import React from 'react'

export type ClashSource = { file: string; selector?: string; mode?: 'i' | 'e' }
export type ClashSet = { name: string; a: ClashSource[]; b?: ClashSource[] }

type Props = {
    files: File[]
    value: ClashSet[]
    onChange: (sets: ClashSet[]) => void
}

export default function ClashSetBuilder({ files, value, onChange }: Props) {
    const fileOptions = files.map(f => f.name)

    const updateSet = (idx: number, patch: Partial<ClashSet>) => {
        const next = value.slice()
        next[idx] = { ...next[idx], ...patch }
        onChange(next)
    }

    const addSet = () => onChange([...value, { name: `Set ${value.length + 1}`, a: [], b: [] }])
    const removeSet = (idx: number) => onChange(value.filter((_, i) => i !== idx))

    const addSource = (idx: number, group: 'a' | 'b') => {
        const s = value[idx]
        const list = Array.from((s[group] || []) as ClashSource[])
        list.push({ file: fileOptions[0] || '' })
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

    return (
        <div style={{ padding: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Clash Sets</strong>
                <button onClick={addSet}>Add Set</button>
            </div>

            {value.length === 0 && <div style={{ marginTop: 8, color: '#64748b' }}>No sets yet. Click "Add Set".</div>}

            {value.map((cs, idx) => (
                <div key={idx} style={{ marginTop: 12, padding: 12, border: '1px solid #e2e8f0', borderRadius: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                            value={cs.name}
                            onChange={e => updateSet(idx, { name: e.target.value })}
                            placeholder="Set name"
                            style={{ flex: 1 }}
                        />
                        <button onClick={() => removeSet(idx)}>Remove</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                        {(['a', 'b'] as const).map(group => (
                            <div key={group}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong>Group {group.toUpperCase()}</strong>
                                    <button onClick={() => addSource(idx, group)}>Add Source</button>
                                </div>
                                {((cs[group] || []) as ClashSource[]).length === 0 && (
                                    <div style={{ color: '#94a3b8', marginTop: 6, fontSize: 12 }}>No sources</div>
                                )}
                                {((cs[group] || []) as ClashSource[]).map((src, sIdx) => (
                                    <div key={sIdx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.6fr auto', gap: 6, marginTop: 6 }}>
                                        <select value={src.file} onChange={e => updateSource(idx, group, sIdx, { file: e.target.value })}>
                                            {fileOptions.length === 0 && <option value="">(no files)</option>}
                                            {fileOptions.map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                        <input placeholder="selector (optional)" value={src.selector || ''} onChange={e => updateSource(idx, group, sIdx, { selector: e.target.value })} />
                                        <select value={src.mode || 'i'} onChange={e => updateSource(idx, group, sIdx, { mode: (e.target.value as 'i' | 'e') })}>
                                            <option value="i">include</option>
                                            <option value="e">exclude</option>
                                        </select>
                                        <button onClick={() => removeSource(idx, group, sIdx)}>Remove</button>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}


