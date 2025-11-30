import React, { useCallback, useState } from 'react'

type Props = { files: File[]; onFilesChange: (files: File[]) => void }

export default function FileUpload({ files, onFilesChange }: Props) {
    const [isDragOver, setIsDragOver] = useState(false)


    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)

        const droppedFiles = Array.from(e.dataTransfer.files).filter(file =>
            file.name.toLowerCase().endsWith('.ifc')
        )

        if (droppedFiles.length > 0) {
            onFilesChange([...files, ...droppedFiles])
        }
    }, [files, onFilesChange])

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || [])
        onFilesChange([...files, ...selectedFiles])
        // Reset input value to allow re-selecting the same file
        e.target.value = ''
    }, [files, onFilesChange])

    const removeFile = useCallback((indexToRemove: number) => {
        onFilesChange(files.filter((_, index) => index !== indexToRemove))
    }, [files, onFilesChange])

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const getFileIcon = (fileName: string) => {
        if (fileName.toLowerCase().includes('structural')) return '🏗️'
        if (fileName.toLowerCase().includes('mep') || fileName.toLowerCase().includes('mechanical')) return '🔧'
        if (fileName.toLowerCase().includes('architectural') || fileName.toLowerCase().includes('archi')) return '🏛️'
        return '📄'
    }

    return (
        <div style={{ padding: 20, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: '1.25rem' }}>📁</span>
                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem' }}>IFC File Upload</h3>
                <span style={{
                    background: '#dbeafe',
                    color: '#1d4ed8',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: '0.75rem',
                    fontWeight: '500'
                }}>
                    {files.length} {files.length === 1 ? 'file' : 'files'}
                </span>
            </div>

            {/* Drag and Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                    border: `2px dashed ${isDragOver ? '#3b82f6' : '#cbd5e1'}`,
                    borderRadius: 8,
                    padding: 32,
                    textAlign: 'center',
                    background: isDragOver ? '#eff6ff' : '#f8fafc',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    marginBottom: 16
                }}
                onClick={() => document.getElementById('file-input')?.click()}
            >
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>
                    {isDragOver ? '📥' : '📤'}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                    {isDragOver ? 'Drop IFC files here' : 'Drag & drop IFC files here'}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    or <span style={{ color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer' }}>browse files</span>
                </div>
                <input
                    id="file-input"
                    type="file"
                    multiple
                    accept=".ifc"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Uploaded Files</span>
                        <button
                            onClick={() => onFilesChange([])}
                            style={{
                                padding: '4px 8px',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: '0.75rem'
                            }}
                        >
                            Clear All
                        </button>
                    </div>

                    <div style={{ display: 'grid', gap: 8 }}>
                        {files.map((file, index) => (
                            <div key={index} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: 12,
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: 6
                            }}>
                                <span style={{ fontSize: '1.25rem' }}>{getFileIcon(file.name)}</span>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: '0.875rem',
                                        fontWeight: '500',
                                        color: '#1e293b',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {file.name}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        {formatFileSize(file.size)}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>


                                    <button
                                        onClick={() => removeFile(index)}
                                        style={{
                                            padding: '4px 8px',
                                            background: '#f3f4f6',
                                            border: '1px solid #d1d5db',
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                            color: '#374151'
                                        }}
                                        title="Remove file"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Summary */}
                    <div style={{
                        marginTop: 12,
                        padding: 12,
                        background: '#e0f2fe',
                        borderRadius: 6,
                        border: '1px solid #0277bd'
                    }}>
                        <div style={{ fontSize: '0.875rem', color: '#0277bd', fontWeight: '500' }}>
                            📊 Summary: {files.length} IFC file{files.length === 1 ? '' : 's'} ready for analysis
                            <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#01579b' }}>
                                ({formatFileSize(files.reduce((sum, f) => sum + f.size, 0))} total)
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Help Text */}
            <div style={{
                marginTop: 16,
                padding: 12,
                background: '#f0f9ff',
                borderRadius: 6,
                border: '1px solid #0ea5e9'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: '1rem' }}>💡</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#0c4a6e' }}>Supported Formats</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#075985' }}>
                    Only IFC files (.ifc) are supported. Files are processed securely on the server and not stored permanently.
                </div>
            </div>
        </div>
    )
}


