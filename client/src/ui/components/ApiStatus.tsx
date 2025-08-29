import React from 'react'

type Props = {
    status: null | {
        available: boolean
        ifcclash_available: boolean
        capabilities?: string[]
        fallback_mode?: boolean
        message: string
    }
    onRefresh: () => void
}

export default function ApiStatus({ status, onRefresh }: Props) {
    return (
        <div style={{ padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>API Status</strong>
                <button onClick={onRefresh}>Refresh</button>
            </div>
            {!status && <div>Checking...</div>}
            {status && (
                <div>
                    <div>{status.message}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                        Available: {String(status.available)} | IfcClash: {String(status.ifcclash_available)}
                    </div>
                    {status.capabilities && status.capabilities.length > 0 && (
                        <div style={{ marginTop: 4, fontSize: 12 }}>Capabilities: {status.capabilities.join(', ')}</div>
                    )}
                </div>
            )}
        </div>
    )
}


