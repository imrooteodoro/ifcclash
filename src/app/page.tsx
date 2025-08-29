"use client";
import { useEffect, useMemo, useState } from "react";
import { usePyodide } from "@/hooks/usePyodide";

type ClashSource = { fileLabel: string; selector?: string; mode?: "i" | "e" };
type ClashSet = { name: string; a: ClashSource[]; b?: ClashSource[] };

type UploadedFile = {
  file: File;
  label: string;
  uploaded: boolean;
};

const PRESET_SELECTORS = [
  { label: "All Columns", value: "IfcColumn" },
  { label: "All Beams", value: "IfcBeam" },
  { label: "All Walls", value: "IfcWall" },
  { label: "All Slabs", value: "IfcSlab" },
  { label: "All Doors", value: "IfcDoor" },
  { label: "All Windows", value: "IfcWindow" },
  { label: "All Pipes", value: "IfcPipeSegment" },
  { label: "All Ducts", value: "IfcDuctSegment" },
  { label: "All Equipment", value: "IfcEquipmentElement" },
  { label: "All Furniture", value: "IfcFurniture" },
  { label: "All Structural Elements", value: "IfcColumn,IfcBeam,IfcSlab" },
  { label: "All MEP Elements", value: "IfcPipeSegment,IfcDuctSegment,IfcCableSegment" },
  { label: "All Architectural Elements", value: "IfcWall,IfcDoor,IfcWindow,IfcStair,IfcRamp" }
];

function EntityBrowser({
  entities,
  onSelectEntity,
  onClose
}: {
  entities: any[];
  onSelectEntity: (entityType: string) => void;
  onClose: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);

  const filteredEntities = entities.filter(entity =>
    entity.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function toggleEntity(entityType: string) {
    setSelectedEntities(prev =>
      prev.includes(entityType)
        ? prev.filter(e => e !== entityType)
        : [...prev, entityType]
    );
  }

  function applySelection() {
    const selector = selectedEntities.join(", ");
    onSelectEntity(selector);
    onClose();
  }

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        background: "white",
        borderRadius: 8,
        padding: 24,
        width: "600px",
        maxHeight: "80vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16
        }}>
          <h3 style={{ margin: 0 }}>📋 Select IFC Entities</h3>
          <button
            onClick={onClose}
            style={{
              padding: "8px",
              background: "#f44336",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            ✕
          </button>
        </div>

        <input
          type="text"
          placeholder="Search entity types..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #ddd",
            borderRadius: 4,
            marginBottom: 16
          }}
        />

        <div style={{
          flex: 1,
          overflow: "auto",
          border: "1px solid #ddd",
          borderRadius: 4,
          marginBottom: 16
        }}>
          {filteredEntities.map((entity) => (
            <div key={entity.type} style={{
              padding: "8px 12px",
              borderBottom: "1px solid #eee",
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
              background: selectedEntities.includes(entity.type) ? "#e3f2fd" : "white"
            }}>
              <input
                type="checkbox"
                checked={selectedEntities.includes(entity.type)}
                onChange={() => toggleEntity(entity.type)}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                  {entity.type}
                </div>
                <div style={{ fontSize: "12px", color: "#666" }}>
                  {entity.count} instances
                  {entity.name && ` • Sample: ${entity.name}`}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              background: "#666",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            onClick={applySelection}
            disabled={selectedEntities.length === 0}
            style={{
              padding: "8px 16px",
              background: selectedEntities.length > 0 ? "#4CAF50" : "#ccc",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: selectedEntities.length > 0 ? "pointer" : "not-allowed"
            }}
          >
            Apply Selection ({selectedEntities.length})
          </button>
        </div>
      </div>
    </div>
  );
}

function ClashSourceEditor({
  sources,
  availableLabels,
  fileEntities,
  onBrowseEntities,
  onChange
}: {
  sources: ClashSource[];
  availableLabels: string[];
  fileEntities: Record<string, any[]>;
  onBrowseEntities: (fileLabel: string, onSelect: (selector: string) => void) => void;
  onChange: (sources: ClashSource[]) => void;
}) {
  function addSource() {
    const newSource: ClashSource = {
      fileLabel: availableLabels[0] || "",
      selector: "",
      mode: "i"
    };
    onChange([...sources, newSource]);
  }

  function removeSource(index: number) {
    onChange(sources.filter((_, i) => i !== index));
  }

  function updateSource(index: number, updates: Partial<ClashSource>) {
    onChange(sources.map((source, i) =>
      i === index ? { ...source, ...updates } : source
    ));
  }

  function applyPreset(index: number, presetValue: string) {
    updateSource(index, { selector: presetValue });
  }

  function browseEntities(index: number) {
    const source = sources[index];
    if (source.fileLabel && fileEntities[source.fileLabel]) {
      onBrowseEntities(source.fileLabel, (selector) => {
        updateSource(index, { selector });
      });
    }
  }

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 12, background: 'white' }}>
      {sources.map((source, index) => (
        <div key={index} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: index < sources.length - 1 ? 8 : 0,
          padding: 8,
          border: '1px solid #eee',
          borderRadius: 4
        }}>
          <select
            value={source.fileLabel}
            onChange={(e) => updateSource(index, { fileLabel: e.target.value })}
            style={{ flex: 1, padding: 6, border: '1px solid #ccc', borderRadius: 2 }}
          >
            <option value="">Select file...</option>
            {availableLabels.map(label => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>

          <div style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Selector (optional)"
              value={source.selector || ""}
              onChange={(e) => updateSource(index, { selector: e.target.value })}
              style={{ flex: 1, padding: 6, border: '1px solid #ccc', borderRadius: 2 }}
            />
            <select
              onChange={(e) => {
                if (e.target.value) {
                  applyPreset(index, e.target.value);
                  e.target.value = ""; // Reset dropdown
                }
              }}
              style={{ padding: 6, border: '1px solid #ccc', borderRadius: 2, width: 120 }}
            >
              <option value="">📋 Presets</option>
              {PRESET_SELECTORS.map(preset => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => browseEntities(index)}
              disabled={!source.fileLabel || !fileEntities[source.fileLabel]}
              style={{
                padding: '6px 8px',
                background: source.fileLabel && fileEntities[source.fileLabel] ? '#2196F3' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: 2,
                cursor: source.fileLabel && fileEntities[source.fileLabel] ? 'pointer' : 'not-allowed',
                fontSize: '12px'
              }}
              title="Browse entities from selected file"
            >
              📂 Browse
            </button>
          </div>

          <select
            value={source.mode || "i"}
            onChange={(e) => updateSource(index, { mode: e.target.value as "i" | "e" })}
            style={{ width: 80, padding: 6, border: '1px solid #ccc', borderRadius: 2 }}
          >
            <option value="i">Include</option>
            <option value="e">Exclude</option>
          </select>

          <button
            onClick={() => removeSource(index)}
            style={{
              padding: '6px 8px',
              background: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: 2,
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      ))}

      <button
        onClick={addSource}
        disabled={availableLabels.length === 0}
        style={{
          width: '100%',
          padding: '8px',
          marginTop: sources.length > 0 ? 8 : 0,
          background: '#e0e0e0',
          color: '#333',
          border: '1px dashed #ccc',
          borderRadius: 4,
          cursor: availableLabels.length > 0 ? 'pointer' : 'not-allowed'
        }}
      >
        + Add Source
      </button>
    </div>
  );
}

export default function Page() {
  const { ready, error, progress, debugInfo, init, uploadIfc, runClash, exportBCF, extractEntities } = usePyodide();
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [projectName, setProjectName] = useState("Clash Demo");
  const [author, setAuthor] = useState("LT+");
  const [sets, setSets] = useState<ClashSet[]>([
    { name: "Structure vs MEP", a: [{ fileLabel: "structure.ifc", selector: "IfcColumn, IfcBeam", mode: "i" }], b: [{ fileLabel: "mep.ifc", selector: "IfcPipeSegment, IfcDuctSegment", mode: "i" }] }
  ]);
  const [clash, setClash] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<any[]>([]);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [fileEntities, setFileEntities] = useState<Record<string, any[]>>({});
  const [browsingFile, setBrowsingFile] = useState<string | null>(null);

  useEffect(() => { init(); }, [init]);

  // Update uploadedFiles when new files are selected
  useEffect(() => {
    const newUploadedFiles = files.map(file => {
      const existing = uploadedFiles.find(f => f.file.name === file.name);
      return existing || {
        file,
        label: file.name,
        uploaded: false
      };
    });
    setUploadedFiles(newUploadedFiles);
  }, [files]);

  async function onUpload() {
    for (const uploadedFile of uploadedFiles) {
      if (!uploadedFile.uploaded) {
        try {
          await uploadIfc(uploadedFile.file, uploadedFile.label);
          setUploadedFiles(prev =>
            prev.map(f =>
              f.file.name === uploadedFile.file.name
                ? { ...f, uploaded: true }
                : f
            )
          );
          // Extract entities after successful upload
          await extractFileEntities(uploadedFile.label);
        } catch (error) {
          console.error(`Failed to upload ${uploadedFile.file.name}:`, error);
        }
      }
    }
  }

  async function extractFileEntities(fileLabel: string) {
    try {
      const result = await extractEntities(fileLabel);
      if (result.entities) {
        setFileEntities(prev => ({
          ...prev,
          [fileLabel]: result.entities
        }));
      }
    } catch (error) {
      console.error(`Failed to extract entities from ${fileLabel}:`, error);
    }
  }

  function updateFileLabel(fileName: string, newLabel: string) {
    setUploadedFiles(prev =>
      prev.map(f =>
        f.file.name === fileName
          ? { ...f, label: newLabel, uploaded: false }
          : f
      )
    );
  }

  function removeFile(fileName: string) {
    setFiles(prev => prev.filter(f => f.name !== fileName));
    setUploadedFiles(prev => prev.filter(f => f.file.name !== fileName));
  }

  function addClashSet() {
    const newSet: ClashSet = {
      name: `Clash Set ${sets.length + 1}`,
      a: [],
      b: []
    };
    setSets(prev => [...prev, newSet]);
  }

  function removeClashSet(index: number) {
    setSets(prev => prev.filter((_, i) => i !== index));
  }

  function updateClashSet(index: number, updates: Partial<ClashSet>) {
    setSets(prev => prev.map((set, i) =>
      i === index ? { ...set, ...updates } : set
    ));
  }

  function browseEntities(fileLabel: string, onSelect: (selector: string) => void) {
    setBrowsingFile(fileLabel);
    // Store the callback for when entities are selected
    (window as any).entitySelectCallback = onSelect;
  }

  function closeEntityBrowser() {
    setBrowsingFile(null);
    delete (window as any).entitySelectCallback;
  }

  async function onRun() {
    const result = await runClash({ projectName, sets });
    setClash(result);
    setSelected([]);
  }

  async function onExport(rows: any[]) {
    const selections = [];
    for (const row of rows) {
      selections.push({
        setName: row._setName || "Clash",
        a: { file: row.a?.file, id: row.a?.id, guid: row.a?.guid },
        b: row.b ? { file: row.b.file, id: row.b.id, guid: row.b.guid } : undefined,
        p1: row.p1 || null,
        p2: row.p2 || null
      });
    }
    const blob = await exportBCF({ projectName, author, selections });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clashes.bcf";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: "2.5em", color: "#333" }}>🔍 IFC Clash Demo</h1>
        <p style={{ margin: "8px 0", color: "#666", fontSize: "1.1em" }}>
          Client-side clash detection using Pyodide + IfcOpenShell WASM
        </p>
        <div style={{
          display: "inline-block",
          padding: "4px 12px",
          background: ready ? "#4CAF50" : "#ff9800",
          color: "white",
          borderRadius: 20,
          fontSize: "0.9em",
          marginTop: 8
        }}>
          Status: {ready ? "✅ Ready" : "⏳ Booting Pyodide..."}
        </div>
      </div>

      {progress && (
        <div style={{
          padding: "12px 16px",
          background: "#e3f2fd",
          border: "1px solid #2196F3",
          borderRadius: 8,
          marginBottom: 16,
          textAlign: "center"
        }}>
          <strong>{progress.step}</strong>
          {progress.progress && <span> ({progress.progress}%)</span>}
        </div>
      )}

              {error && (
          <div style={{
            padding: "12px 16px",
            background: "#ffebee",
            border: "1px solid #f44336",
            borderRadius: 8,
            marginBottom: 16,
            color: "#c62828"
          }}>
            <strong>⚠️ Error:</strong> {error}
          </div>
        )}

        {debugInfo && (
          <div style={{
            padding: "12px 16px",
            background: "#e8f5e8",
            border: "1px solid #4caf50",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: "14px",
            fontFamily: "monospace"
          }}>
            <div style={{ marginBottom: 8 }}>
              <strong>🐛 Debug Info:</strong>
              <span style={{ fontSize: "12px", color: "#666", marginLeft: 8 }}>
                (Managed by Pyodide worker)
              </span>
            </div>
            <pre style={{ margin: "0", whiteSpace: "pre-wrap", fontSize: "12px", maxHeight: "200px", overflow: "auto" }}>
              {debugInfo}
            </pre>
          </div>
        )}

      <div style={{
        background: "#f8f9fa",
        padding: "16px",
        borderRadius: 8,
        marginBottom: 24,
        border: "1px solid #e9ecef"
      }}>
        <h3 style={{ marginTop: 0, color: "#495057" }}>🚀 Quick Start</h3>
        <ol style={{ margin: 0, paddingLeft: 20, color: "#6c757d" }}>
          <li>Upload your IFC files using the file picker below</li>
          <li>Rename file labels if needed (click on them to edit)</li>
          <li>Upload files to the worker</li>
          <li>Create clash sets by comparing different files or file sections</li>
          <li><strong>New!</strong> Use the "📂 Browse" button to select specific IFC entities from your files</li>
          <li>Use preset selectors for common IFC element types</li>
          <li>Run clash detection and export results as BCF files</li>
        </ol>
      </div>

      <section style={{
        background: "white",
        padding: "20px",
        borderRadius: 8,
        border: "1px solid #e9ecef",
        marginBottom: 24
      }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, color: "#495057" }}>📋 Project Settings</h3>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: "bold", color: "#495057" }}>Project Name</label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ced4da",
                borderRadius: 4,
                fontSize: "14px"
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: "bold", color: "#495057" }}>Author</label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ced4da",
                borderRadius: 4,
                fontSize: "14px"
              }}
            />
          </div>
        </div>
      </section>

      <section style={{
        background: "white",
        padding: "20px",
        borderRadius: 8,
        border: "1px solid #e9ecef",
        marginBottom: 24
      }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, color: "#495057" }}>📁 File Management</h3>
        <input
          type="file"
          multiple
          accept=".ifc,.ifczip"
          onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
          style={{ marginBottom: 12 }}
        />

        {uploadedFiles.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4>Uploaded Files:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {uploadedFiles.map((uploadedFile) => (
                <div key={uploadedFile.file.name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: 8,
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  background: uploadedFile.uploaded ? '#f0f9f0' : '#fff'
                }}>
                  <span style={{ flex: 1, fontSize: 14 }}>
                    📄 {uploadedFile.file.name} ({(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>

                  {editingLabel === uploadedFile.file.name ? (
                    <input
                      type="text"
                      value={uploadedFile.label}
                      onChange={(e) => updateFileLabel(uploadedFile.file.name, e.target.value)}
                      onBlur={() => setEditingLabel(null)}
                      onKeyPress={(e) => e.key === 'Enter' && setEditingLabel(null)}
                      style={{ flex: 1, padding: 4, border: '1px solid #ccc', borderRadius: 2 }}
                      autoFocus
                    />
                  ) : (
                    <span
                      onClick={() => setEditingLabel(uploadedFile.file.name)}
                      style={{
                        flex: 1,
                        padding: 4,
                        background: '#f9f9f9',
                        border: '1px solid #ddd',
                        borderRadius: 2,
                        cursor: 'pointer'
                      }}
                    >
                      Label: {uploadedFile.label}
                    </span>
                  )}

                  <span style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    background: uploadedFile.uploaded ? '#4CAF50' : '#ff9800',
                    color: 'white'
                  }}>
                    {uploadedFile.uploaded ? '✓ Uploaded' : '⏳ Pending'}
                  </span>

                  <button
                    onClick={() => removeFile(uploadedFile.file.name)}
                    style={{
                      padding: '4px 8px',
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: 2,
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onUpload}
          disabled={!ready || uploadedFiles.filter(f => !f.uploaded).length === 0}
          style={{
            padding: '8px 16px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          Upload Files to Worker
        </button>
      </section>

      <section style={{
        background: "white",
        padding: "20px",
        borderRadius: 8,
        border: "1px solid #e9ecef",
        marginBottom: 24
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: "#495057" }}>⚡ Clash Sets</h3>
          <p style={{ margin: "4px 0 12px 0", fontSize: "14px", color: "#6c757d" }}>
            💡 Tip: Use the "📂 Browse" button to select specific IFC entities from your uploaded files
          </p>
          <button
            onClick={addClashSet}
            style={{
              padding: '6px 12px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            + Add Clash Set
          </button>
        </div>

        {sets.map((set, setIndex) => (
          <div key={setIndex} style={{
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
            background: '#fafafa'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <input
                type="text"
                value={set.name}
                onChange={(e) => updateClashSet(setIndex, { name: e.target.value })}
                style={{
                  flex: 1,
                  padding: 8,
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  fontSize: 16,
                  fontWeight: 'bold'
                }}
                placeholder="Clash Set Name"
              />
              <button
                onClick={() => removeClashSet(setIndex)}
                style={{
                  padding: '8px 12px',
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Remove Set
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <h4>Group A</h4>
                <ClashSourceEditor
                  sources={set.a}
                  availableLabels={uploadedFiles.map(f => f.label)}
                  fileEntities={fileEntities}
                  onBrowseEntities={browseEntities}
                  onChange={(sources) => updateClashSet(setIndex, { a: sources })}
                />
              </div>

              <div>
                <h4>Group B (optional)</h4>
                <ClashSourceEditor
                  sources={set.b || []}
                  availableLabels={uploadedFiles.map(f => f.label)}
                  fileEntities={fileEntities}
                  onBrowseEntities={browseEntities}
                  onChange={(sources) => updateClashSet(setIndex, { b: sources })}
                />
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={onRun}
          disabled={!ready || sets.length === 0 || uploadedFiles.filter(f => f.uploaded).length === 0}
          style={{
            padding: '12px 24px',
            background: '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 'bold',
            width: '100%'
          }}
        >
          🚀 Run Clash Detection
        </button>
      </section>

      {clash && (
        <section style={{
          background: "white",
          padding: "20px",
          borderRadius: 8,
          border: "1px solid #e9ecef",
          marginBottom: 24
        }}>
          <h3 style={{ marginTop: 0, marginBottom: 16, color: "#495057" }}>📊 Results</h3>

          <div style={{
            background: "#e3f2fd",
            padding: "12px 16px",
            borderRadius: 6,
            marginBottom: 20,
            border: "1px solid #bbdefb"
          }}>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#1976d2", marginBottom: 8 }}>
              🎯 Clash Detection Complete!
            </div>
            <div style={{ fontSize: "14px", color: "#424242" }}>
              Total clashes found: <strong>{clash.reduce((total: number, set: any) => total + set.results.length, 0)}</strong>
              {clash.length > 1 && (
                <span> across {clash.length} clash set{clash.length > 1 ? 's' : ''}</span>
              )}
            </div>
          </div>

          {debugInfo && (
            <div style={{
              background: "#f5f5f5",
              padding: "12px 16px",
              borderRadius: 6,
              marginBottom: 20,
              border: "1px solid #ddd",
              fontFamily: "monospace",
              fontSize: "12px",
              maxHeight: "200px",
              overflowY: "auto"
            }}>
              <div style={{ fontWeight: "bold", marginBottom: 8, color: "#333" }}>
                🔍 Debug Logs:
              </div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                {debugInfo}
              </div>
            </div>
          )}

          {clash.map((set: any) => (
            <div key={set.name} style={{ marginBottom: 24 }}>
              <h4>{set.name}</h4>
              <div style={{ marginBottom: 16, fontSize: "14px", color: "#666" }}>
                Found {set.results.length} clashes in this set
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8f9fa" }}>
                      <th style={{ textAlign: "left", padding: "12px 8px", borderBottom: "2px solid #dee2e6" }}>Select</th>
                      <th style={{ textAlign: "left", padding: "12px 8px", borderBottom: "2px solid #dee2e6" }}>Entity A</th>
                      <th style={{ textAlign: "left", padding: "12px 8px", borderBottom: "2px solid #dee2e6" }}>Entity B</th>
                      <th style={{ textAlign: "left", padding: "12px 8px", borderBottom: "2px solid #dee2e6" }}>Severity</th>
                      <th style={{ textAlign: "left", padding: "12px 8px", borderBottom: "2px solid #dee2e6" }}>Description</th>
                      <th style={{ textAlign: "left", padding: "12px 8px", borderBottom: "2px solid #dee2e6" }}>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {set.results.map((r: any, i: number) => {
                      const row = { ...r, _setName: set.name };
                      const severityColor = r.severity === 'High' ? '#dc3545' : r.severity === 'Medium' ? '#ffc107' : '#28a745';

                      return (
                        <tr key={i} style={{
                          borderBottom: "1px solid #dee2e6",
                          backgroundColor: i % 2 === 0 ? "#fff" : "#f8f9fa"
                        }}>
                          <td style={{ padding: "8px" }}>
                            <input
                              type="checkbox"
                              onChange={(e) =>
                                setSelected((prev) =>
                                  e.target.checked ? [...prev, row] : prev.filter((x) => x !== row)
                                )
                              }
                            />
                          </td>
                          <td style={{ padding: "8px" }}>
                            <div style={{ fontWeight: "bold", marginBottom: 2 }}>
                              {r.a?.type || "Unknown"}
                            </div>
                            <div style={{ fontSize: "12px", color: "#666" }}>
                              {r.a?.name || "Unnamed"}
                            </div>
                            <div style={{ fontSize: "11px", color: "#999" }}>
                              ID: {r.a?.id || "N/A"} {r.a?.guid ? `• GUID: ${r.a.guid}` : ""}
                            </div>
                          </td>
                          <td style={{ padding: "8px" }}>
                            <div style={{ fontWeight: "bold", marginBottom: 2 }}>
                              {r.b?.type || "Unknown"}
                            </div>
                            <div style={{ fontSize: "12px", color: "#666" }}>
                              {r.b?.name || "Unnamed"}
                            </div>
                            <div style={{ fontSize: "11px", color: "#999" }}>
                              ID: {r.b?.id || "N/A"} {r.b?.guid ? `• GUID: ${r.b.guid}` : ""}
                            </div>
                          </td>
                          <td style={{ padding: "8px" }}>
                            <span style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              fontWeight: "bold",
                              color: "white",
                              backgroundColor: severityColor
                            }}>
                              {r.severity || "Medium"}
                            </span>
                          </td>
                          <td style={{ padding: "8px", maxWidth: "200px" }}>
                            <div style={{ fontSize: "13px" }}>
                              {r.description || "Geometric clash detected"}
                            </div>
                          </td>
                          <td style={{ padding: "8px", fontSize: "12px", fontFamily: "monospace" }}>
                            <div style={{ marginBottom: 4 }}>
                              <strong>P1:</strong> {r.p1 ? r.p1.map((x: number) => x.toFixed(1)).join(", ") : "N/A"}
                            </div>
                            <div>
                              <strong>P2:</strong> {r.p2 ? r.p2.map((x: number) => x.toFixed(1)).join(", ") : "N/A"}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button onClick={() => onExport(set.results.map((r: any) => ({ ...r, _setName: set.name })))}>Export set as BCF</button>
    </div>
          ))}
          <button onClick={() => onExport(selected)} disabled={selected.length === 0}>Export selected as BCF</button>
        </section>
      )}

      {browsingFile && fileEntities[browsingFile] && (
        <EntityBrowser
          entities={fileEntities[browsingFile]}
          onSelectEntity={(selector) => {
            const callback = (window as any).entitySelectCallback;
            if (callback) callback(selector);
          }}
          onClose={closeEntityBrowser}
        />
      )}
    </main>
  );
}
