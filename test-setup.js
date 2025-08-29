// Quick test to verify the setup
console.log('🚀 IFC Clash Detection Setup Test');

// Check if all files exist
const fs = require('fs');
const path = require('path');

const requiredFiles = [
    'package.json',
    'requirements.txt',
    'sevalla.yaml',
    'Dockerfile',
    'api/clash.py',
    'api/__init__.py',
    'src/app/page.tsx',
    'src/components/ApiStatus.tsx',
    'src/components/FileUpload.tsx',
    'src/components/ClashConfiguration.tsx',
    'src/components/ClashResults.tsx',
    'README.md'
];

console.log('\n📁 Checking required files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - MISSING`);
        allFilesExist = false;
    }
});

if (allFilesExist) {
    console.log('\n🎉 All required files are present!');
    console.log('\n🚀 Next steps:');
    console.log('1. npm install');
    console.log('2. npm run dev (for development)');
    console.log('3. Push to Git and deploy via Sevalla (for production)');
} else {
    console.log('\n❌ Some files are missing. Please check the setup.');
}

console.log('\n🔧 Sevalla Configuration:');
console.log('- Flask API: /api/clash.py');
console.log('- Next.js Frontend: /src/app');
console.log('- Docker: Dockerfile configured');
console.log('- Deployment: sevalla.yaml configured');

console.log('\n📊 API Endpoints:');
console.log('- GET /api/health - Check API status');
console.log('- POST /api/clash-detection - Run clash detection');
