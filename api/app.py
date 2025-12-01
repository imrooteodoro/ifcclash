from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import os
import logging
import json
import tempfile
import subprocess
import sys
import base64
try:
    import ifcopenshell
    import ifcopenshell.util.element
    IFCOPENSHELL_AVAILABLE = True
except Exception as e:
    print(f"IfcOpenShell not available: {e}")
    IFCOPENSHELL_AVAILABLE = False

try:
    # Use BCF v2.1 for better compatibility with BCF viewers
    from bcf.v2.bcfxml import BcfXml
    from bcf.v2.topic import TopicHandler
    from bcf.v2.visinfo import VisualizationInfoHandler
    BCF_AVAILABLE = True
except Exception as e:
    print(f"BCF module not available: {e}")
    BCF_AVAILABLE = False

app = Flask(__name__, static_folder='../static', static_url_path='')
CORS(app)

# Security: Limit max upload size to 100MB
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

# Rate Limiting
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache for building storey information per IFC file
storey_cache = {}

def get_building_storey_info(ifc_file_path):
    """Extract building storey information for elements in IFC file"""
    if not IFCOPENSHELL_AVAILABLE:
        logger.warning("IfcOpenShell not available; skipping storey extraction.")
        return {}
    if ifc_file_path in storey_cache:
        return storey_cache[ifc_file_path]

    try:
        ifc_file = ifcopenshell.open(ifc_file_path)
        storey_info = {}

        # Get all building storeys
        storeys = ifc_file.by_type("IfcBuildingStorey")
        for storey in storeys:
            storey_name = storey.Name or f"Storey_{storey.id()}"
            # Get all elements in this storey
            for element in ifcopenshell.util.element.get_decomposition(storey):
                if hasattr(element, 'GlobalId'):
                    storey_info[element.GlobalId] = storey_name

        storey_cache[ifc_file_path] = storey_info
        return storey_info
    except Exception as e:
        logger.warning(f"Failed to extract building storey info from {ifc_file_path}: {e}")
        return {}

def enhance_clash_results_with_storeys(results, name_to_path):
    """Enhance clash results with building storey information and severity levels"""

    # Create reverse mapping from temp paths to file names
    path_to_name = {path: name for name, path in name_to_path.items()}

    # Extract storey info from all IFC files
    all_storey_info = {}
    for file_path in name_to_path.values():
        storey_info = get_building_storey_info(file_path)
        all_storey_info.update(storey_info)

    # Enhance each clash result
    for result_set in results:
        if 'clashes' in result_set:
            for clash_id, clash in result_set['clashes'].items():
                # Add building storey information
                if clash.get('a_global_id') in all_storey_info:
                    clash['a_building_storey'] = all_storey_info[clash['a_global_id']]

                if clash.get('b_global_id') in all_storey_info:
                    clash['b_building_storey'] = all_storey_info[clash['b_global_id']]

                # Add severity based on distance
                distance = clash.get('distance', 0)
                if distance == 0:
                    severity = 'critical'
                elif distance <= 0.1:
                    severity = 'high'
                elif distance <= 1.0:
                    severity = 'medium'
                else:
                    severity = 'low'
                clash['severity'] = severity

    return results

# Detect IfcClash availability (module presence; we will invoke the CLI entrypoint)
try:
    import ifcclash  # type: ignore
    IFCCLASH_AVAILABLE = True
    logger.info("IfcClash module present; will use CLI fallback via `python -m ifcclash`")
except Exception as e:
    IFCCLASH_AVAILABLE = False
    logger.warning(f"IfcClash not available: {e}")

def normalize_clash_sets(clash_sets_raw, name_to_path):
    """Normalize clash set definitions and rewrite file references to local temp paths."""
    unknown_labels = set()

    if isinstance(clash_sets_raw, str):
        try:
            clash_sets = json.loads(clash_sets_raw)
        except json.JSONDecodeError:
            raise ValueError("Invalid clash_sets JSON")
    else:
        # Accept already-parsed lists/dicts
        try:
            clash_sets = json.loads(json.dumps(clash_sets_raw))
        except Exception as exc:  # noqa: BLE001
            raise ValueError(f"Invalid clash_sets payload: {exc}") from exc

    def rewrite_sources(sources):
        out = []
        for src in sources or []:
            src = dict(src)
            label = src.get('file')
            if label:
                if label in name_to_path:
                    src['file'] = name_to_path[label]
                else:
                    # If only one file uploaded, auto-bind even when label mismatches
                    if len(name_to_path) == 1:
                        src['file'] = next(iter(name_to_path.values()))
                    else:
                        unknown_labels.add(label)
            else:
                # If only one file uploaded, auto-bind when label missing
                if len(name_to_path) == 1:
                    src['file'] = next(iter(name_to_path.values()))
                else:
                    unknown_labels.add('(missing)')

            # Map UI field entityTypes -> selector string understood by ifcclash
            # If a custom selector is already provided, prefer it
            entity_types = src.pop('entityTypes', None)
            if entity_types and not src.get('selector'):
                # Filter out empty strings and join by comma
                cleaned = [t for t in entity_types if isinstance(t, str) and t.strip()]
                if cleaned:
                    src['selector'] = ','.join(cleaned)

            # Keep include/exclude as compact flags expected by ifcclash ('i'|'e')
            # If anything else is provided, drop it to avoid confusing the CLI
            if 'mode' in src:
                if src['mode'] not in ('i', 'e'):
                    src.pop('mode', None)
            out.append(src)
        return out

    for s in clash_sets:
        if 'a' in s:
            s['a'] = rewrite_sources(s.get('a'))
        if 'b' in s:
            s['b'] = rewrite_sources(s.get('b'))

        # For within-group analysis (no Group B), ensure both sides use same selector
        # This prevents ifcclash from comparing selected elements against ALL elements
        if not s.get('b') or len(s.get('b', [])) == 0:
            # Copy Group A configuration to Group B for within-group analysis
            if s.get('a'):
                import copy
                s['b'] = copy.deepcopy(s['a'])  # Deep copy to avoid reference issues
                logger.info("Within-group analysis: copied Group A to Group B for precise filtering")
        # Set required mode and parameters for IfcClash 0.8.3
        # ifcclash only supports: collision, intersection, clearance
        if 'mode' not in s:
            s['mode'] = 'collision'  # Default to collision mode

        # Map UI modes to actual ifcclash modes
        ui_mode = s.get('mode')
        if ui_mode in ['within_groups', 'between_groups']:
            # Both within_groups and between_groups use collision mode in ifcclash
            # The difference is determined by group configuration
            s['mode'] = 'collision'
        elif ui_mode == 'intersection':
            s['mode'] = 'intersection'
        elif ui_mode == 'clearance':
            s['mode'] = 'clearance'
        else:
            # Default to collision for any unrecognized mode
            s['mode'] = 'collision'

        # Configure mode-specific parameters from UI, preserving explicit user input
        if s['mode'] == 'collision':
            # allow_touching defaults to False unless explicitly set True in UI
            if 'allow_touching' not in s:
                s['allow_touching'] = False
        elif s['mode'] == 'intersection':
            # tolerance and check_all can be set by UI; otherwise provide sane defaults
            if 'tolerance' not in s:
                s['tolerance'] = 0.01
            if 'check_all' not in s:
                s['check_all'] = True
        elif s['mode'] == 'clearance':
            if 'clearance' not in s:
                s['clearance'] = 0.01
            if 'check_all' not in s:
                s['check_all'] = True

    return clash_sets, unknown_labels


def execute_ifcclash(clash_sets, name_to_path):
    """Run IfcClash CLI and enhance results with storey metadata."""
    out_path = tempfile.mktemp(suffix='.json', dir='/tmp')
    in_path = tempfile.mktemp(suffix='.json', dir='/tmp')
    with open(in_path, 'w') as fh:
        json.dump(clash_sets, fh)

    # Log the exact configuration being sent to ifcclash for debugging
    logger.info(f"Executing IfcClash CLI with {len(clash_sets)} sets → {out_path}")
    logger.info(f"IfcClash input configuration: {json.dumps(clash_sets, indent=2)}")
    cmd = [sys.executable, '-m', 'ifcclash', in_path, '-o', out_path]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        logger.error(f"IfcClash failed: {proc.stderr}\n{proc.stdout}")
        raise RuntimeError(proc.stderr or "IfcClash execution failed")

    with open(out_path, 'r') as fh:
        results = json.load(fh)

    # Enhance results with building storey information
    return enhance_clash_results_with_storeys(results, name_to_path)


# Error handlers
@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({
        "success": False,
        "error": "File upload too large. Maximum size is 100MB."
    }), 413

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({
        "success": False,
        "error": f"Rate limit exceeded: {e.description}"
    }), 429


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "version": "1.0.0",
        "ifcclash_available": IFCCLASH_AVAILABLE
    })


@app.route('/api/clash-detection', methods=['POST'])
@limiter.limit("10 per hour")
def clash_detection():
    if not IFCCLASH_AVAILABLE:
        return jsonify({
            "success": False,
            "error": "IfcClash is not available on the server",
        }), 503

    name_to_path = {}
    try:
        uploaded_files = request.files.getlist('files')
        clash_sets_raw = request.form.get('clash_sets', '[]')

        # Validation: Limit number of files
        if len(uploaded_files) > 10:
            return jsonify({
                "success": False,
                "error": "Maximum 10 files allowed per request"
            }), 400

        # Save uploads to /tmp and map name -> path
        for f in uploaded_files:
            suffix = os.path.splitext(f.filename)[1] or '.ifc'
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir='/tmp')
            f.save(tmp.name)
            tmp.flush(); tmp.close()
            name_to_path[f.filename] = tmp.name

        clash_sets, unknown_labels = normalize_clash_sets(clash_sets_raw, name_to_path)

        # Validation: Limit number of clash sets
        if len(clash_sets) > 20:
            return jsonify({
                "success": False,
                "error": "Maximum 20 clash sets allowed per request"
            }), 400

        # Validate labels before running
        if unknown_labels:
            return jsonify({
                "success": False,
                "error": "One or more clash source 'file' labels did not match uploaded files",
                "unknown_labels": sorted(unknown_labels),
                "uploaded_files": sorted(name_to_path.keys())
            }), 400

        enhanced_results = execute_ifcclash(clash_sets, name_to_path)

        return jsonify({
            "success": True,
            "results": enhanced_results
        })
    except Exception as e:
        logger.exception("Clash detection failed")
        # Cleanup temp files on error
        for tmp_path in name_to_path.values():
            try:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
            except Exception:
                pass
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/saas/clash-detection', methods=['POST'])
@limiter.limit("5 per hour")
def saas_clash_detection():
    """Self-service API that accepts JSON with base64 IFC payloads and clash settings."""
    if not IFCCLASH_AVAILABLE:
        return jsonify({
            "success": False,
            "error": "IfcClash is not available on the server",
        }), 503

    try:
        payload = request.get_json(silent=True, force=True) or {}
    except Exception:
        return jsonify({"success": False, "error": "Request body must be valid JSON"}), 400

    files_payload = payload.get('files', [])
    clash_sets_raw = payload.get('clash_sets', payload.get('clashSettings', []))

    if not files_payload:
        return jsonify({"success": False, "error": "At least one IFC file is required"}), 400

    # Validation: Limit number of files
    if len(files_payload) > 10:
        return jsonify({"success": False, "error": "Maximum 10 files allowed per request"}), 400

    name_to_path = {}
    total_size = 0
    for file_entry in files_payload:
        if not isinstance(file_entry, dict):
            return jsonify({"success": False, "error": "Each file must be an object with name and content"}), 400
        name = file_entry.get('name')
        content = file_entry.get('content')
        if not name or not content:
            return jsonify({"success": False, "error": "File entries require 'name' and base64 'content'"}), 400

        try:
            decoded = base64.b64decode(content, validate=True)
        except Exception:
            return jsonify({"success": False, "error": f"Invalid base64 content for file {name}"}), 400

        # Validation: Check individual file size (50MB limit)
        file_size = len(decoded)
        total_size += file_size
        if file_size > 50 * 1024 * 1024:
            return jsonify({"success": False, "error": f"File {name} exceeds 50MB limit"}), 400

        # Validation: Check total payload size (100MB limit)
        if total_size > 100 * 1024 * 1024:
            return jsonify({"success": False, "error": "Total file size exceeds 100MB limit"}), 400

        suffix = os.path.splitext(name)[1] or '.ifc'
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir='/tmp')
        with open(tmp.name, 'wb') as fh:
            fh.write(decoded)
        tmp.flush(); tmp.close()
        name_to_path[name] = tmp.name

    try:
        clash_sets, unknown_labels = normalize_clash_sets(clash_sets_raw, name_to_path)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    # Validation: Limit number of clash sets
    if len(clash_sets) > 20:
        return jsonify({"success": False, "error": "Maximum 20 clash sets allowed per request"}), 400

    if unknown_labels:
        return jsonify({
            "success": False,
            "error": "One or more clash source 'file' labels did not match uploaded files",
            "unknown_labels": sorted(unknown_labels),
            "uploaded_files": sorted(name_to_path.keys())
        }), 400

    try:
        enhanced_results = execute_ifcclash(clash_sets, name_to_path)
    except RuntimeError as exc:
        # Cleanup temp files on error
        for tmp_path in name_to_path.values():
            try:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
            except Exception:
                pass
        return jsonify({"success": False, "error": str(exc)}), 500

    # Check if BCF export is requested
    export_format = payload.get('export_format', payload.get('exportFormat', 'json')).lower()
    if export_format == 'bcf':
        if not BCF_AVAILABLE:
            # Cleanup temp files
            for tmp_path in name_to_path.values():
                try:
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)
                except Exception:
                    pass
            return jsonify({
                "success": False,
                "error": "BCF export requested but IfcOpenShell BCF module is not available on the server. Please ensure IfcOpenShell is properly installed with BCF support."
            }), 503
        
        try:
            # Flatten clash results for BCF export (similar to frontend structure)
            clashes_for_bcf = []
            for result_set in enhanced_results:
                set_name = result_set.get('name', 'Unknown Set')
                if 'clashes' in result_set:
                    for clash_id, clash in result_set['clashes'].items():
                        clashes_for_bcf.append({
                            'id': clash_id,
                            'setName': set_name,
                            'a_global_id': clash.get('a_global_id', ''),
                            'a_ifc_class': clash.get('a_ifc_class', 'Unknown'),
                            'a_name': clash.get('a_name', 'N/A'),
                            'a_building_storey': clash.get('a_building_storey'),
                            'b_global_id': clash.get('b_global_id', ''),
                            'b_ifc_class': clash.get('b_ifc_class', 'Unknown'),
                            'b_name': clash.get('b_name', 'N/A'),
                            'b_building_storey': clash.get('b_building_storey'),
                            'type': clash.get('type', 'collision'),
                            'p1': clash.get('p1', [0, 0, 0]),
                            'p2': clash.get('p2', [0, 0, 0]),
                            'distance': clash.get('distance', 0),
                            'severity': clash.get('severity', 'medium')
                        })
            
            if not clashes_for_bcf:
                # Cleanup temp files
                for tmp_path in name_to_path.values():
                    try:
                        if os.path.exists(tmp_path):
                            os.unlink(tmp_path)
                    except Exception:
                        pass
                return jsonify({
                    "success": False,
                    "error": "No clashes found to export to BCF"
                }), 400
            
            # Get project name from payload or use default
            project_name = payload.get('project_name', payload.get('projectName', 'Clash Detection Results'))
            
            # Create temporary BCF file
            bcf_output_path = tempfile.mktemp(suffix='.bcfzip', dir='/tmp')
            
            # Create new BCF project
            bcf = BcfXml.create_new(project_name)
            
            # Import numpy for array operations
            import numpy as np
            
            # Add each clash as a BCF topic
            for clash in clashes_for_bcf:
                # Build topic title
                a_class = clash.get('a_ifc_class', 'Unknown')
                b_class = clash.get('b_ifc_class', 'Unknown')
                title = f"Clash: {a_class} vs {b_class}"
                
                # Build description
                description = build_clash_description(clash)
                
                # Create topic (author required, using system user or default)
                import getpass
                author = getpass.getuser() or "Clash Detection System"
                
                topic = bcf.add_topic(
                    title=title,
                    description=description,
                    author=author,
                    topic_type="Clash",
                    topic_status="Open"
                )
                
                # Calculate clash midpoint for viewpoint
                p1 = clash.get('p1', [0, 0, 0])
                p2 = clash.get('p2', [0, 0, 0])
                midpoint = np.array([
                    (p1[0] + p2[0]) / 2,
                    (p1[1] + p2[1]) / 2,
                    (p1[2] + p2[2]) / 2
                ], dtype=np.float64)
                
                # Collect GlobalIds for clashing elements
                guids = []
                if clash.get('a_global_id'):
                    guids.append(clash['a_global_id'])
                if clash.get('b_global_id'):
                    guids.append(clash['b_global_id'])
                
                # Add viewpoint with snapshot
                if guids:
                    # Create viewpoint handler
                    vi_handler = VisualizationInfoHandler.create_from_point_and_guids(
                        midpoint, *guids
                    )
                    
                    # Generate snapshot image
                    snapshot_bytes = generate_clash_snapshot(clash)
                    snapshot_filename = None
                    
                    if snapshot_bytes:
                        vi_handler.snapshot = snapshot_bytes
                        snapshot_filename = vi_handler.guid + '.png'
                    
                    # Add viewpoint with snapshot to topic
                    topic.add_visinfo_handler(vi_handler, snapshot_filename)
            
            # Save BCF file
            bcf.save(bcf_output_path)
            
            # Close BCF file to ensure all data is written
            bcf.close()
            
            # Read the BCF file
            with open(bcf_output_path, 'rb') as f:
                bcf_content = f.read()
            
            # Clean up temp files (both IFC and BCF)
            try:
                os.unlink(bcf_output_path)
            except Exception:
                pass
            for tmp_path in name_to_path.values():
                try:
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)
                except Exception:
                    pass
            
            # Generate filename with timestamp
            from datetime import datetime
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"clash_results_{timestamp}.bcfzip"
            
            return bcf_content, 200, {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': f'attachment; filename={filename}'
            }
        except Exception as e:
            logger.exception("BCF export failed in SaaS API")
            # Cleanup temp files on error
            for tmp_path in name_to_path.values():
                try:
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)
                except Exception:
                    pass
            return jsonify({"success": False, "error": f"BCF export failed: {str(e)}"}), 500

    # Default: return JSON results
    # Cleanup temp files
    for tmp_path in name_to_path.values():
        try:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
        except Exception:
            pass

    return jsonify({
        "success": True,
        "results": enhanced_results
    })

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/export-clashes', methods=['POST'])
@limiter.limit("30 per hour")
def export_clashes():
    """Export clash results in various formats (CSV, JSON)"""
    try:
        data = request.get_json()
        format_type = data.get('format', 'csv')
        clashes = data.get('clashes', [])
        filters = data.get('filters', {})

        if format_type == 'csv':
            import csv
            import io

            output = io.StringIO()
            writer = csv.writer(output)

            # Write header
            writer.writerow([
                'Clash ID', 'Set Name', 'Entity A Name', 'Entity A Class', 'Entity A Storey',
                'Entity B Name', 'Entity B Class', 'Entity B Storey', 'Type', 'Severity',
                'Distance', 'Point 1 X', 'Point 1 Y', 'Point 1 Z', 'Point 2 X', 'Point 2 Y', 'Point 2 Z'
            ])

            # Write data
            for clash in clashes:
                writer.writerow([
                    clash.get('id', ''),
                    clash.get('setName', ''),
                    clash.get('a_name', ''),
                    clash.get('a_ifc_class', ''),
                    clash.get('a_building_storey', ''),
                    clash.get('b_name', ''),
                    clash.get('b_ifc_class', ''),
                    clash.get('b_building_storey', ''),
                    clash.get('type', ''),
                    clash.get('severity', ''),
                    clash.get('distance', ''),
                    clash.get('p1', [0, 0, 0])[0],
                    clash.get('p1', [0, 0, 0])[1],
                    clash.get('p1', [0, 0, 0])[2],
                    clash.get('p2', [0, 0, 0])[0],
                    clash.get('p2', [0, 0, 0])[1],
                    clash.get('p2', [0, 0, 0])[2]
                ])

            csv_content = output.getvalue()
            output.close()

            return csv_content, 200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename=clash_results.csv'
            }

        elif format_type == 'json':
            return jsonify({
                'success': True,
                'data': clashes,
                'filters': filters,
                'exported_at': json.dumps({'timestamp': str(tempfile.mktemp())})
            })

        else:
            return jsonify({'success': False, 'error': f'Unsupported format: {format_type}'}), 400

    except Exception as e:
        logger.exception("Export failed")
        return jsonify({"success": False, "error": str(e)}), 500


def build_clash_description(clash):
    """Build a detailed description for a BCF topic from clash data"""
    parts = []
    
    # Element A information
    parts.append(f"Element A:")
    parts.append(f"  - Name: {clash.get('a_name', 'N/A')}")
    parts.append(f"  - Class: {clash.get('a_ifc_class', 'N/A')}")
    parts.append(f"  - GlobalId: {clash.get('a_global_id', 'N/A')}")
    if clash.get('a_building_storey'):
        parts.append(f"  - Building Storey: {clash.get('a_building_storey')}")
    
    # Element B information
    parts.append(f"\nElement B:")
    parts.append(f"  - Name: {clash.get('b_name', 'N/A')}")
    parts.append(f"  - Class: {clash.get('b_ifc_class', 'N/A')}")
    parts.append(f"  - GlobalId: {clash.get('b_global_id', 'N/A')}")
    if clash.get('b_building_storey'):
        parts.append(f"  - Building Storey: {clash.get('b_building_storey')}")
    
    # Clash information
    parts.append(f"\nClash Details:")
    parts.append(f"  - Type: {clash.get('type', 'N/A')}")
    parts.append(f"  - Distance: {clash.get('distance', 0):.4f} units")
    if clash.get('severity'):
        parts.append(f"  - Severity: {clash.get('severity')}")
    if clash.get('setName'):
        parts.append(f"  - Clash Set: {clash.get('setName')}")
    
    return "\n".join(parts)


def map_severity_to_priority(severity):
    """Map clash severity to BCF priority"""
    severity_map = {
        'critical': 'High',
        'high': 'High',
        'medium': 'Medium',
        'low': 'Low'
    }
    return severity_map.get(severity, 'Medium')


def generate_clash_snapshot(clash, width=200, height=150):
    """Generate a placeholder snapshot image for a clash"""
    try:
        from PIL import Image, ImageDraw, ImageFont
        
        # Color based on severity
        severity_colors = {
            'critical': '#dc2626',  # Red
            'high': '#ea580c',      # Orange
            'medium': '#ca8a04',    # Yellow
            'low': '#16a34a'        # Green
        }
        severity = clash.get('severity', 'medium')
        bg_color = severity_colors.get(severity, '#6b7280')
        
        # Create image
        img = Image.new('RGB', (width, height), color=bg_color)
        draw = ImageDraw.Draw(img)
        
        # Add text
        a_class = clash.get('a_ifc_class', 'Unknown')[:15]
        b_class = clash.get('b_ifc_class', 'Unknown')[:15]
        
        # Draw clash info
        draw.text((10, 10), "CLASH", fill='white')
        draw.text((10, 35), f"{a_class}", fill='white')
        draw.text((10, 55), "vs", fill='white')
        draw.text((10, 75), f"{b_class}", fill='white')
        draw.text((10, 100), f"Severity: {severity.upper()}", fill='white')
        
        # Save to bytes
        import io
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        return buffer.getvalue()
    except ImportError:
        return None
    except Exception as e:
        logger.warning(f"Failed to generate snapshot: {e}")
        return None


@app.route('/api/export-bcf', methods=['POST'])
@limiter.limit("30 per hour")
def export_bcf():
    """Export clash results to BCF format"""
    if not BCF_AVAILABLE:
        return jsonify({
            "success": False,
            "error": "BCF module is not available on the server. Please install the 'bcf-client' package."
        }), 503
    
    try:
        data = request.get_json()
        clashes = data.get('clashes', [])
        project_name = data.get('projectName', 'Clash Detection Results')
        # Screenshots from frontend: { clashId: base64_png_data }
        screenshots = data.get('screenshots', {})
        
        if not clashes:
            return jsonify({
                "success": False,
                "error": "No clashes provided for export"
            }), 400
        
        # Create temporary BCF file
        bcf_output_path = tempfile.mktemp(suffix='.bcfzip', dir='/tmp')
        
        # Create new BCF project
        bcf = BcfXml.create_new(project_name)
        
        # Import numpy for array operations
        import numpy as np
        import getpass
        import base64
        
        # Add each clash as a BCF topic
        for clash in clashes:
            clash_id = clash.get('id', '')
            
            # Build topic title
            a_class = clash.get('a_ifc_class', 'Unknown')
            b_class = clash.get('b_ifc_class', 'Unknown')
            title = f"Clash: {a_class} vs {b_class}"
            
            # Build description
            description = build_clash_description(clash)
            
            # Create topic (author required)
            author = getpass.getuser() or "Clash Detection System"
            
            topic = bcf.add_topic(
                title=title,
                description=description,
                author=author,
                topic_type="Clash",
                topic_status="Open"
            )
            
            # Calculate clash midpoint for viewpoint
            p1 = clash.get('p1', [0, 0, 0])
            p2 = clash.get('p2', [0, 0, 0])
            midpoint = np.array([
                (p1[0] + p2[0]) / 2,
                (p1[1] + p2[1]) / 2,
                (p1[2] + p2[2]) / 2
            ], dtype=np.float64)
            
            # Collect GlobalIds for clashing elements
            guids = []
            if clash.get('a_global_id'):
                guids.append(clash['a_global_id'])
            if clash.get('b_global_id'):
                guids.append(clash['b_global_id'])
            
            # Add viewpoint with snapshot
            if guids:
                # Create viewpoint handler
                vi_handler = VisualizationInfoHandler.create_from_point_and_guids(
                    midpoint, *guids
                )
                
                # Use frontend screenshot if available, otherwise generate placeholder
                snapshot_bytes = None
                if clash_id and clash_id in screenshots:
                    try:
                        # Decode base64 screenshot from frontend
                        snapshot_bytes = base64.b64decode(screenshots[clash_id])
                        logger.info(f"Using real 3D screenshot for clash {clash_id}")
                    except Exception as e:
                        logger.warning(f"Failed to decode screenshot for clash {clash_id}: {e}")
                        snapshot_bytes = generate_clash_snapshot(clash)
                else:
                    # Generate placeholder snapshot
                    snapshot_bytes = generate_clash_snapshot(clash)
                
                snapshot_filename = None
                if snapshot_bytes:
                    vi_handler.snapshot = snapshot_bytes
                    snapshot_filename = vi_handler.guid + '.png'
                
                # Add viewpoint with snapshot to topic
                topic.add_visinfo_handler(vi_handler, snapshot_filename)
        
        # Save BCF file
        bcf.save(bcf_output_path)
        
        # Close BCF file to ensure all data is written
        bcf.close()
        
        # Read the BCF file and return it
        with open(bcf_output_path, 'rb') as f:
            bcf_content = f.read()
        
        # Clean up temp file
        try:
            os.unlink(bcf_output_path)
        except Exception:
            pass
        
        # Generate filename with timestamp
        from datetime import datetime
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"clash_results_{timestamp}.bcfzip"
        
        return bcf_content, 200, {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': f'attachment; filename={filename}'
        }
        
    except Exception as e:
        logger.exception("BCF export failed")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/<path:path>', methods=['GET'])
def static_proxy(path):
    file_path = os.path.join(app.static_folder, path)
    if os.path.exists(file_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)


