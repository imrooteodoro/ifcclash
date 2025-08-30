from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import logging
import json
import tempfile
import subprocess
import sys
import ifcopenshell
import ifcopenshell.util.element

app = Flask(__name__, static_folder='../static', static_url_path='')
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache for building storey information per IFC file
storey_cache = {}

def get_building_storey_info(ifc_file_path):
    """Extract building storey information for elements in IFC file"""
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

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "version": "1.0.0",
        "ifcclash_available": IFCCLASH_AVAILABLE
    })

@app.route('/api/clash-detection', methods=['POST'])
def clash_detection():
    if not IFCCLASH_AVAILABLE:
        return jsonify({
            "success": False,
            "error": "IfcClash is not available on the server",
        }), 503

    try:
        uploaded_files = request.files.getlist('files')
        clash_sets_raw = request.form.get('clash_sets', '[]')

        # Save uploads to /tmp and map name -> path
        name_to_path = {}
        for f in uploaded_files:
            suffix = os.path.splitext(f.filename)[1] or '.ifc'
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir='/tmp')
            f.save(tmp.name)
            tmp.flush(); tmp.close()
            name_to_path[f.filename] = tmp.name

        # Load and rewrite clash sets file references to server temp paths
        try:
            clash_sets = json.loads(clash_sets_raw)
        except json.JSONDecodeError:
            return jsonify({"success": False, "error": "Invalid clash_sets JSON"}), 400

        unknown_labels = set()

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
                    # Ensure we keep the compact form, not expanded words
                    # ifcclash expects 'i' and 'e', not 'include'/'exclude'
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
                    logger.info(f"Within-group analysis: copied Group A to Group B for precise filtering")
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

        # Validate labels before running
        if unknown_labels:
            return jsonify({
                "success": False,
                "error": "One or more clash source 'file' labels did not match uploaded files",
                "unknown_labels": sorted(unknown_labels),
                "uploaded_files": sorted(name_to_path.keys())
            }), 400

        # Run IfcClash via CLI (python -m ifcclash <input_json> -o <output>)
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
            return jsonify({"success": False, "error": "IfcClash execution failed", "stderr": proc.stderr}), 500

        with open(out_path, 'r') as fh:
            results = json.load(fh)

        # Enhance results with building storey information
        enhanced_results = enhance_clash_results_with_storeys(results, name_to_path)

        return jsonify({
            "success": True,
            "results": enhanced_results
        })
    except Exception as e:
        logger.exception("Clash detection failed")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/export-clashes', methods=['POST'])
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

@app.route('/<path:path>')
def static_proxy(path):
    file_path = os.path.join(app.static_folder, path)
    if os.path.exists(file_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)


