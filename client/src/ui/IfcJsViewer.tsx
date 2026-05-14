import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { IFCViewer } from './IFCViewer'

export type ModelLayer = { id: number; name: string; visible: boolean; opacity: number }

export type IfcJsViewerHandle = {
    showAll: () => void
    isolateByGuids: (guids: string[], opts?: { zoom?: boolean; focusPoints?: [number, number, number][] }) => Promise<void>
    clearClashIsolation: () => void
    captureClashScreenshots: (clashes: Array<{ id: string; a_global_id: string; b_global_id: string; p1: [number, number, number] }>, onProgress?: (current: number, total: number) => void) => Promise<Array<{ clashId: string; screenshot: string }>>
    resize: () => void
    getLayers: () => ModelLayer[]
    setLayerVisibility: (modelId: number, visible: boolean) => void
    setLayerOpacity: (modelId: number, opacity: number) => void
}

type Props = {
    files: File[]
    active?: boolean
    onLayersChange?: (layers: ModelLayer[]) => void
}

const IfcJsViewer = forwardRef<IfcJsViewerHandle, Props>(({ files, active = false, onLayersChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewerRef = useRef<IFCViewer | null>(null)
    const loadedKeysRef = useRef<Set<string>>(new Set())
    const loadQueueRef = useRef(Promise.resolve())
    // Keep latest files ref so the init effect can access them
    const filesRef = useRef<File[]>(files)
    filesRef.current = files

    const getFileKey = (f: File) => `${f.name}::${f.size}::${f.lastModified}`

    const notifyLayers = () => {
        if (!onLayersChange || !viewerRef.current) return
        const layers: ModelLayer[] = []
        viewerRef.current.getModels().forEach((model, id) => {
            layers.push({ id, name: model.name, visible: model.visible, opacity: 1 })
        })
        onLayersChange(layers)
    }

    const enqueueFiles = (filesToLoad: File[]) => {
        const viewer = viewerRef.current
        if (!viewer) return

        const pending = filesToLoad.filter(f => !loadedKeysRef.current.has(getFileKey(f)))
        if (pending.length === 0) return

        loadQueueRef.current = loadQueueRef.current.then(async () => {
            await viewer.ready
            for (const file of pending) {
                const key = getFileKey(file)
                if (loadedKeysRef.current.has(key)) continue
                try {
                    await viewer.loadIFC(file)
                    loadedKeysRef.current.add(key)
                    notifyLayers()
                } catch (e) {
                    console.error('[IfcJsViewer] Failed to load', file.name, e)
                }
            }
        })
    }

    // Init viewer once on mount, then load any files already present
    useEffect(() => {
        if (!containerRef.current || viewerRef.current) return
        viewerRef.current = new IFCViewer(containerRef.current)
        enqueueFiles(filesRef.current)
    }, [])

    // Load new files whenever the files prop changes
    useEffect(() => {
        enqueueFiles(files)
    }, [files])

    useEffect(() => {
        if (active) viewerRef.current?.resize()
    }, [active])

    useImperativeHandle(ref, () => ({
        showAll: () => viewerRef.current?.showAll(),
        isolateByGuids: async (guids, opts) => viewerRef.current?.isolateByGuids(guids, opts),
        clearClashIsolation: () => viewerRef.current?.clearClashIsolation(),
        captureClashScreenshots: (clashes, onProgress) =>
            viewerRef.current?.captureClashScreenshots(clashes, onProgress) ?? Promise.resolve([]),
        resize: () => viewerRef.current?.resize(),
        getLayers: () => {
            const layers: ModelLayer[] = []
            viewerRef.current?.getModels().forEach((model, id) => {
                layers.push({ id, name: model.name, visible: model.visible, opacity: 1 })
            })
            return layers
        },
        setLayerVisibility: (modelId, visible) => {
            viewerRef.current?.setModelVisibility(modelId, visible)
            notifyLayers()
        },
        setLayerOpacity: (modelId, opacity) => {
            viewerRef.current?.setModelOpacity(modelId, opacity)
        },
    }))

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', position: 'relative' }}
        />
    )
})

IfcJsViewer.displayName = 'IfcJsViewer'

export default IfcJsViewer
