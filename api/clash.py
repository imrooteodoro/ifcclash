from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import tempfile
import json
import os
import logging
from pathlib import Path
from typing import List, Dict, Any

# Import IfcClash
try:
    import ifcclash
    IFCCLASH_AVAILABLE = True
    logging.info("IfcClash successfully imported")

    # Check if required classes are available
    if not hasattr(ifcclash, 'ClashSettings'):
        logging.warning("ClashSettings class not found in ifcclash")
        IFCCLASH_AVAILABLE = False
    if not hasattr(ifcclash, 'Clasher'):
        logging.warning("Clasher class not found in ifcclash")
        IFCCLASH_AVAILABLE = False

except ImportError as e:
    IFCCLASH_AVAILABLE = False
    logging.warning(f"IfcClash not available: {e}")
    ifcclash = None

app = Flask(__name__)
CORS(app)  # Enable CORS for your frontend

# Request logging middleware
@app.before_request
def log_request_info():
    logger.debug(f"📨 Incoming request: {request.method} {request.url}")
    logger.debug(f"   Headers: {dict(request.headers)}")
    if request.data:
        logger.debug(f"   Body: {request.data.decode('utf-8', errors='ignore')}")

# Configure comprehensive logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/tmp/flask_debug.log', mode='w')
    ]
)
logger = logging.getLogger(__name__)
logger.info("Starting Flask application...")

# API routes (must come before frontend routes)
@app.route('/api/')
def home():
    logger.info("API root endpoint called")
    capabilities = []
    if IFCCLASH_AVAILABLE:
        capabilities.extend(["real_ifcclash", "geometric_clash_detection", "bcf_export"])
    else:
        capabilities.extend(["mock_fallback", "ui_testing"])

    response = {
        "status": "IfcClash API is running",
        "ifcclash_available": IFCCLASH_AVAILABLE,
        "capabilities": capabilities,
        "version": "1.0.0",
        "fallback_mode": not IFCCLASH_AVAILABLE,
        "endpoints": {
            "health": "/api/health",
            "clash_detection": "/api/clash-detection"
        }
    }
    logger.info(f"API root response: {response}")
    return jsonify(response)

@app.route('/api/health', methods=['GET'])
def health_check():
    logger.info("🔍 Health check endpoint called - detailed logging enabled")
    logger.info(f"Request method: {request.method}")
    logger.info(f"Request path: {request.path}")
    logger.info(f"Request headers: {dict(request.headers)}")

    capabilities = []
    if IFCCLASH_AVAILABLE:
        capabilities.append("real_ifcclash")
        logger.info("✅ IfcClash library is available")
    else:
        capabilities.append("mock_fallback")
        logger.warning("⚠️ IfcClash library not available - using fallback mode")

    response_data = {
        "status": "healthy",
        "ifcclash_available": IFCCLASH_AVAILABLE,
        "capabilities": capabilities,
        "temp_dir": "/tmp" if os.path.exists("/tmp") else "Not available",
        "python_version": f"{os.sys.version_info.major}.{os.sys.version_info.minor}",
        "fallback_mode": not IFCCLASH_AVAILABLE,
        "current_time": "2024-01-01T00:00:00Z",
        "environment": "Sevalla Docker"
    }

    logger.info(f"Health check response: {response_data}")
    logger.info("✅ Health check completed successfully")
    return jsonify(response_data)

@app.route('/api/clash-detection', methods=['POST'])
def clash_detection():
    if not IFCCLASH_AVAILABLE:
        # Provide a fallback implementation for testing
        logger.info("Using fallback clash detection implementation")
        return _fallback_clash_detection()

    try:
        # Get uploaded files
        files = request.files.getlist('files')
        clash_sets_json = request.form.get('clash_sets')

        if not files:
            return jsonify({"error": "No files provided"}), 400

        if not clash_sets_json:
            return jsonify({"error": "No clash sets configuration provided"}), 400

        logger.info(f"Received {len(files)} files for clash detection")

        # Parse clash sets
        try:
            clash_sets = json.loads(clash_sets_json)
        except json.JSONDecodeError as e:
            return jsonify({"error": f"Invalid JSON in clash_sets: {e}"}), 400

        # Save uploaded files temporarily
        temp_files = []
        file_mapping = {}

        for i, file in enumerate(files):
            if not file.filename:
                continue

            if not file.filename.lower().endswith('.ifc'):
                logger.warning(f"Skipping non-IFC file: {file.filename}")
                continue

            # Create temp file in /tmp (Sevalla's temp directory)
            temp_file = tempfile.NamedTemporaryFile(
                suffix='.ifc',
                delete=False,
                dir='/tmp' if os.path.exists('/tmp') else None
            )

            try:
                file.save(temp_file.name)
                temp_files.append(temp_file.name)
                file_mapping[file.filename] = temp_file.name
                logger.info(f"Saved file {file.filename} to {temp_file.name}")
            except Exception as e:
                logger.error(f"Failed to save file {file.filename}: {e}")
                return jsonify({"error": f"Failed to save file {file.filename}"}), 500

        if not temp_files:
            return jsonify({"error": "No valid IFC files provided"}), 400

        # Update clash sets with temp file paths
        for clash_set in clash_sets:
            # Update group A sources
            for source in clash_set.get('a', []):
                if source.get('file') in file_mapping:
                    source['file'] = file_mapping[source['file']]

            # Update group B sources (if provided)
            for source in clash_set.get('b', []):
                if source.get('file') in file_mapping:
                    source['file'] = file_mapping[source['file']]

        logger.info(f"Processing {len(clash_sets)} clash sets")

        # Execute IfcClash
        output_file = tempfile.mktemp(suffix='.json', dir='/tmp' if os.path.exists('/tmp') else None)

        try:
            # Set up IFC clash settings
            settings = ifcclash.ClashSettings()
            settings.output = output_file

            # Configure logging for IFC clash
            clash_logger = logging.getLogger("Clash")
            clash_logger.setLevel(logging.INFO)
            settings.logger = clash_logger

            # Add console handler if not already present
            if not clash_logger.handlers:
                handler = logging.StreamHandler()
                handler.setLevel(logging.INFO)
                formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
                handler.setFormatter(formatter)
                clash_logger.addHandler(handler)

            # Create IFC clash processor
            clasher = ifcclash.Clasher(settings)

            # Load clash sets configuration
            clasher.clash_sets = clash_sets

            logger.info(f"Starting clash detection with {len(clash_sets)} clash sets")

            # Execute clash detection
            clasher.clash()

            # Export results
            clasher.export()

            # Read and parse results
            with open(output_file, 'r') as f:
                results = json.load(f)

            logger.info(f"Clash detection completed successfully. Found {len(results)} result sets")

            return jsonify({
                "success": True,
                "results": results,
                "processed_files": len(temp_files),
                "clash_sets_processed": len(clash_sets)
            })

        except Exception as e:
            logger.error(f"IfcClash execution failed: {e}", exc_info=True)
            return jsonify({
                "error": f"Clash detection failed: {str(e)}",
                "type": type(e).__name__,
                "details": "Check server logs for more information"
            }), 500

        finally:
            # Cleanup output file
            try:
                if os.path.exists(output_file):
                    os.unlink(output_file)
            except:
                pass

    except Exception as e:
        logger.error(f"Unexpected error in clash detection: {e}")
        return jsonify({
            "error": f"Unexpected error: {str(e)}",
            "type": type(e).__name__
        }), 500

    finally:
        # Cleanup temp files
        for temp_file in temp_files:
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
                    logger.info(f"Cleaned up temp file: {temp_file}")
            except Exception as e:
                logger.warning(f"Failed to cleanup {temp_file}: {e}")

def _fallback_clash_detection():
    """Fallback implementation for testing when ifcclash is not available"""
    try:
        # Simulate processing time
        import time
        time.sleep(2)

        # Get form data
        files = request.files.getlist('files')
        clash_sets_json = request.form.get('clash_sets')

        if not clash_sets_json:
            return jsonify({"error": "No clash sets configuration provided"}), 400

        try:
            clash_sets = json.loads(clash_sets_json)
        except json.JSONDecodeError as e:
            return jsonify({"error": f"Invalid JSON in clash_sets: {e}"}), 400

        # Generate mock clash results
        mock_results = []

        for clash_set in clash_sets:
            set_name = clash_set.get('name', 'Mock Clash Set')
            mock_clashes = []

            # Generate 3-8 mock clashes per set
            import random
            num_clashes = random.randint(3, 8)

            for i in range(num_clashes):
                # Alternate between different entity types
                entity_types = [
                    ('IfcWall', 'IfcPipe'),
                    ('IfcWall', 'IfcColumn'),
                    ('IfcSlab', 'IfcPipe'),
                    ('IfcBeam', 'IfcDuct'),
                    ('IfcColumn', 'IfcWall')
                ]

                entity_a, entity_b = random.choice(entity_types)

                mock_clash = {
                    "a": {
                        "file": f"/tmp/mock-{i}.ifc",
                        "id": random.randint(100, 999),
                        "guid": f"mock-guid-a-{i}",
                        "type": entity_a,
                        "name": f"{entity_a.replace('Ifc', '')} Element {i+1}"
                    },
                    "b": {
                        "file": f"/tmp/mock-{i}.ifc",
                        "id": random.randint(1000, 1999),
                        "guid": f"mock-guid-b-{i}",
                        "type": entity_b,
                        "name": f"{entity_b.replace('Ifc', '')} Element {i+1}"
                    },
                    "p1": [
                        round(random.uniform(0, 100), 2),
                        round(random.uniform(0, 50), 2),
                        round(random.uniform(0, 25), 2)
                    ],
                    "p2": [
                        round(random.uniform(0, 100), 2),
                        round(random.uniform(0, 50), 2),
                        round(random.uniform(0, 25), 2)
                    ],
                    "severity": random.choice(["High", "Medium", "Low"]),
                    "description": f"Mock clash detected between {entity_a} and {entity_b}"
                }
                mock_clashes.append(mock_clash)

            mock_results.append({
                "name": set_name,
                "results": mock_clashes
            })

        logger.info(f"Generated mock clash results: {len(mock_results)} sets with {sum(len(set['results']) for set in mock_results)} total clashes")

        return jsonify({
            "success": True,
            "results": mock_results,
            "processed_files": len(files),
            "clash_sets_processed": len(clash_sets),
            "note": "This is mock data - ifcclash library not available in this environment"
        })

    except Exception as e:
        logger.error(f"Fallback clash detection failed: {e}")
        return jsonify({
            "error": f"Fallback clash detection failed: {str(e)}",
            "type": type(e).__name__
        }), 500

# Frontend serving routes (catch-all for Next.js SPA)
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve Next.js frontend files"""
    logger.debug(f"Frontend request for path: '{path}'")

    # Skip API routes - these should be handled by API routes above
    if path.startswith('api/'):
        logger.warning(f"⚠️ Frontend route called for API path: {path}")
        return jsonify({"error": "API route not found"}), 404

    # Serve index.html for root and SPA routes
    if path == "" or path == "/" or not path or '.' not in path:
        logger.debug("Serving index.html for SPA route")
        return send_from_directory('../out', 'index.html')

    # Try to serve the file directly
    try:
        file_path = f'../out/{path}'
        if os.path.exists(file_path):
            logger.debug(f"Serving static file: {file_path}")
            return send_from_directory('../out', path)
        else:
            logger.debug(f"File not found: {file_path}, serving index.html")
            # If file doesn't exist, serve index.html for SPA routing
            return send_from_directory('../out', 'index.html')
    except Exception as e:
        logger.error(f"Error serving frontend file: {e}")
        return send_from_directory('../out', 'index.html')

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

# Sevalla production deployment
if __name__ == '__main__':
    logger.info("🚀 Starting Flask application in Sevalla environment")

    # Get port from environment (Sevalla sets PORT automatically)
    port = int(os.environ.get('PORT', 8080))
    logger.info(f"📡 Listening on port: {port}")
    logger.info(f"🌐 Host: 0.0.0.0")
    logger.info(f"🔧 Debug mode: False")
    logger.info(f"📁 Current working directory: {os.getcwd()}")
    logger.info(f"📂 API directory exists: {os.path.exists('api')}")
    logger.info(f"📂 Frontend directory exists: {os.path.exists('../out')}")

    # Log all registered routes
    logger.info("📋 Registered routes:")
    for rule in app.url_map.iter_rules():
        logger.info(f"  {rule.methods} {rule.rule}")

    logger.info("🎯 Flask application startup complete - ready to serve requests")

    # Run in production mode for Sevalla
    app.run(host='0.0.0.0', port=port, debug=False)
