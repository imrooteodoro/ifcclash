import React from 'react'

type Props = {
    clashSetsText: string
    onChange: (text: string) => void
}

export default function ClashConfiguration({ clashSetsText, onChange }: Props) {
    return (
        <div style={{ padding: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <strong>Clash Sets</strong>
            <div style={{ marginTop: 8 }}>
                <textarea value={clashSetsText} onChange={e => onChange(e.target.value)} rows={8} style={{ width: '100%' }} />
            </div>
        </div>
    )
}


