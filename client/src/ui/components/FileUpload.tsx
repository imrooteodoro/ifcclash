import React from 'react'

type Props = { files: File[]; onFilesChange: (files: File[]) => void }

export default function FileUpload({ files, onFilesChange }: Props) {
    return (
        <div style={{ padding: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <strong>Upload IFC Files</strong>
            <div style={{ marginTop: 8 }}>
                <input type="file" multiple accept=".ifc" onChange={e => onFilesChange(Array.from(e.target.files || []))} />
            </div>
            {files.length > 0 && (
                <ul style={{ marginTop: 8 }}>
                    {files.map(f => (
                        <li key={f.name}>{f.name}</li>
                    ))}
                </ul>
            )}
        </div>
    )
}


