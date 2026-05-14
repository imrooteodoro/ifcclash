import react from '@vitejs/plugin-react'

export default {
    plugins: [react()],
    build: {
        outDir: '../static',
        emptyOutDir: false
    },
    server: {
        headers: {
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Opener-Policy': 'same-origin'
        },
        proxy: {
            '/api': {
                target: 'http://localhost:9292',
                changeOrigin: true,
                secure: false
            }
        }
    },
    optimizeDeps: {
        exclude: ['web-ifc']
    },
    publicDir: 'public'
}
