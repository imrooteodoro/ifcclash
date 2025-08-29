import React from 'react'

type ClashData = {
    results: Array<{
        name: string
        clashes: Record<string, {
            a_global_id: string
            a_ifc_class: string
            a_name: string
            b_global_id: string
            b_ifc_class: string
            b_name: string
            type: string
            p1: [number, number, number]
            p2: [number, number, number]
            distance: number
        }>
    }>
}

type Props = { data: ClashData | null }

export default function ClashResults({ data }: Props) {
    if (!data?.results) return null

    const totalClashes = data.results.reduce((sum, set) =>
        sum + Object.keys(set.clashes || {}).length, 0
    )

    if (totalClashes === 0) {
        return (
            <div style={{ padding: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, textAlign: 'center' }}>
                <h3 style={{ margin: 0, color: '#64748b' }}>No Clashes Found</h3>
                <p style={{ margin: '8px 0 0 0', color: '#94a3b8' }}>The clash detection completed successfully with no conflicts detected.</p>
            </div>
        )
    }

    return (
        <div style={{ padding: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: '#1e293b' }}>Clash Detection Results</h3>
                <span style={{
                    background: '#ef4444',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: 12,
                    fontSize: '0.875rem',
                    fontWeight: 'bold'
                }}>
                    {totalClashes} {totalClashes === 1 ? 'Clash' : 'Clashes'} Found
                </span>
            </div>

            {data.results.map((resultSet, setIndex) => {
                const clashes = Object.entries(resultSet.clashes || {})
                if (clashes.length === 0) return null

                return (
                    <div key={setIndex} style={{ marginBottom: 24 }}>
                        <h4 style={{ margin: '0 0 12px 0', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: 4 }}>
                            {resultSet.name || `Clash Set ${setIndex + 1}`}
                            <span style={{ marginLeft: 8, fontSize: '0.875rem', color: '#6b7280' }}>
                                ({clashes.length} {clashes.length === 1 ? 'clash' : 'clashes'})
                            </span>
                        </h4>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '0.875rem',
                                background: '#fafafa'
                            }}>
                                <thead>
                                    <tr style={{ background: '#f1f5f9' }}>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>Entity A</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>Entity B</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>Type</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>Location</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clashes.map(([clashId, clash]) => (
                                        <tr key={clashId} style={{ background: 'white', borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <div style={{ fontWeight: 'bold', color: '#1e293b' }}>
                                                        {clash.a_ifc_class}
                                                    </div>
                                                    <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                                                        {clash.a_name}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace' }}>
                                                        ID: {clash.a_global_id}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <div style={{ fontWeight: 'bold', color: '#1e293b' }}>
                                                        {clash.b_ifc_class}
                                                    </div>
                                                    <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                                                        {clash.b_name}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace' }}>
                                                        ID: {clash.b_global_id}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                                <span style={{
                                                    background: '#fee2e2',
                                                    color: '#dc2626',
                                                    padding: '2px 8px',
                                                    borderRadius: 12,
                                                    fontSize: '0.75rem',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {clash.type.toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <div style={{ fontSize: '0.75rem', color: '#374151' }}>
                                                        <strong>Point 1:</strong> [{clash.p1.map(coord => coord.toFixed(2)).join(', ')}]
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#374151' }}>
                                                        <strong>Point 2:</strong> [{clash.p2.map(coord => coord.toFixed(2)).join(', ')}]
                                                    </div>
                                                    {clash.distance !== undefined && clash.distance > 0 && (
                                                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                            Distance: {clash.distance.toFixed(3)} units
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}


