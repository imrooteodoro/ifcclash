import React from 'react'

type Props = { data: any }

export default function ClashResults({ data }: Props) {
    if (!data) return null
    return (
        <div style={{ padding: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <strong>Results</strong>
            <pre style={{ marginTop: 8 }}>{JSON.stringify(data, null, 2)}</pre>
        </div>
    )
}


