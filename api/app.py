from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import logging
import json
import tempfile
import subprocess
import sys

app = Flask(__name__, static_folder='../static', static_url_path='')
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
                out.append(src)
            return out

        for s in clash_sets:
            if 'a' in s:
                s['a'] = rewrite_sources(s.get('a'))
            if 'b' in s:
                s['b'] = rewrite_sources(s.get('b'))

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

        logger.info(f"Executing IfcClash CLI with {len(clash_sets)} sets → {out_path}")
        cmd = [sys.executable, '-m', 'ifcclash', in_path, '-o', out_path]
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if proc.returncode != 0:
            logger.error(f"IfcClash failed: {proc.stderr}\n{proc.stdout}")
            return jsonify({"success": False, "error": "IfcClash execution failed", "stderr": proc.stderr}), 500

        with open(out_path, 'r') as fh:
            results = json.load(fh)

        return jsonify({
            "success": True,
            "results": results
        })
    except Exception as e:
        logger.exception("Clash detection failed")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    file_path = os.path.join(app.static_folder, path)
    if os.path.exists(file_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)


