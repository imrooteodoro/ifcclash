# IFC Clash Detection

A modern web application for IFC clash detection using IfcClash technology by IfcOpenShell.

## 🚀 Features

- **IfcClash Processing**: Uses IfcOpenShell and IfcClash libraries for accurate geometric clash detection
- **Containerized Architecture**: Flask API deployed on Sevalla with full IFC support
- **Modern Frontend**: React/TypeScript interface with drag-and-drop file upload
- **Comprehensive Results**: Detailed clash visualization with severity levels and entity information
- **Multiple File Support**: Upload and compare multiple IFC files simultaneously

## 🏗️ Architecture

```
Frontend (Next.js + React) <---HTTP---> Backend (Flask + Sevalla)
    ↓                                           ↓
File Upload & UI                      IfcClash Processing
Results Visualization                 Serverless Execution
```

## 📋 Prerequisites

- Node.js 18+ and npm
- Git repository (GitHub/GitLab) for deployment
- Python 3.8+ (for local development)

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Install Next.js dependencies
npm install

# The Flask API dependencies are in requirements.txt
```

### 2. Development

```bash
# Start Next.js development server
npm run dev

# The Flask API will be deployed to Sevalla
# For local Flask development, see below
```

### 3. Deploy to Sevalla

```bash
# Push to your Git repository (GitHub/GitLab)
git add .
git commit -m "Deploy to Sevalla"
git push origin main

# Sevalla will automatically deploy from your repository
# Visit https://app.sevalla.com to connect your repo
```

## 🧪 Testing

### Upload IFC Files
1. Drag and drop IFC files or click to browse
2. Only `.ifc` files are supported

### Configure Clash Sets
1. Enter a name for your clash set (e.g., "Structure vs MEP")
2. Select IFC files for Group A
3. Optionally configure Group B for cross-file clashes

### Run Clash Detection
1. Click "Run Clash Detection"
2. Wait for server-side processing (may take 30-60 seconds for large files)
3. View detailed results with severity levels

## 🔧 API Reference

### Health Check
```bash
GET /api/health
```

### Clash Detection
```bash
POST /api/clash-detection
Content-Type: multipart/form-data

# Form fields:
# - files: IFC files (multiple)
# - clash_sets: JSON configuration
```

## 🏠 Local Flask Development

If you want to develop the Flask API locally:

```bash
# Install Python dependencies
pip install -r requirements.txt

# Run Flask locally
cd api
python clash.py
```

The local Flask server will run on `http://localhost:5000`

## 📊 Clash Detection Process

1. **File Upload**: IFC files are uploaded to Sevalla containerized API
2. **Temporary Storage**: Files are stored temporarily in `/tmp`
3. **Clash Processing**: IfcClash analyzes geometric intersections
4. **Results Generation**: Detailed clash results with positions and severity
5. **Cleanup**: Temporary files are automatically removed

## ⚠️ Limitations

- **File Size**: Sevalla supports large IFC files with containerized processing
- **Processing Time**: Complex models may take 30-60 seconds
- **Cold Starts**: First request may be slower due to serverless nature
- **Geometry Processing**: Requires IfcClash to be available in the deployment environment

## 🔒 Security & Privacy

- Files are processed temporarily and automatically deleted
- No persistent storage of IFC data
- All processing happens server-side

## 🛠️ Troubleshooting

### API Not Available
- Check Sevalla deployment status
- Verify IfcClash installation in requirements.txt
- Check Sevalla service logs

### Large Files Failing
- Split large IFC files
- Consider client-side preprocessing
- Use multiple smaller clash sets

### Slow Processing
- Reduce number of entities in clash sets
- Use more specific selectors
- Consider optimizing IFC file size

## 📝 Configuration

### Sevalla Settings
- **Runtime**: Python 3.11 (Docker container)
- **Max Duration**: Unlimited (containerized)
- **Memory**: Configurable (default: 512MB)

### Environment Variables (Optional)
```bash
# Set in Sevalla dashboard
IFCCLASH_LOG_LEVEL=INFO
MAX_FILE_SIZE=10485760  # 10MB
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **IfcOpenShell**: For the core IFC processing capabilities
- **IfcClash**: For professional clash detection algorithms
- **Vercel**: For the serverless deployment platform
- **Next.js & React**: For the modern frontend framework