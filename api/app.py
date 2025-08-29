from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import logging

app = Flask(__name__, static_folder='../static', static_url_path='')
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "version": "1.0.0"
    })

@app.route('/api/clash-detection', methods=['POST'])
def clash_detection():
    # Placeholder: echo back files and sets
    files = request.files.getlist('files')
    clash_sets = request.form.get('clash_sets')
    return jsonify({
        "success": True,
        "received_files": [f.filename for f in files],
        "clash_sets": clash_sets
    })

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


