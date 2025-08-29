# 🚀 Sevalla Deployment Guide

## Prerequisites

1. **Sevalla Account**: Create account at [sevalla.com](https://sevalla.com)
2. **Connect Repository**: Link your GitHub/GitLab repository
3. **Docker Support**: Enabled for IFC processing

## Quick Deploy

### Step 1: Connect Repository
```bash
# Push your code to GitHub/GitLab
git add .
git commit -m "Sevalla deployment setup"
git push origin main
```

### Step 2: Deploy on Sevalla
1. Go to [Sevalla Dashboard](https://app.sevalla.com)
2. Click "Deploy from Git"
3. Select your repository
4. Sevalla auto-detects configuration

### Step 3: Configure Services
Sevalla will automatically:
- ✅ Build Docker container for IFC API
- ✅ Deploy Next.js frontend
- ✅ Set up databases (optional)
- ✅ Configure pipelines (Dev/QA/Prod)

## Architecture

```
Frontend (Next.js) ──┐
                     ├── Sevalla Load Balancer
Backend (Flask) ─────┘
         │
         └── IFC Processing (IfcOpenShell + ifcclash)
```

## Environment Variables

Sevalla automatically sets:
- `PORT=5000` (Flask port)
- `FLASK_ENV=production`
- Database URLs (if configured)

## Custom Domains

1. Go to Sevalla Dashboard → Services
2. Select your service
3. Add custom domain
4. Update DNS records

## Monitoring & Logs

- **Logs**: Dashboard → Services → Your Service → Logs
- **Metrics**: Dashboard → Services → Monitoring
- **Health**: Dashboard → Services → Health Checks

## Troubleshooting

### IFC Packages Not Installing
```bash
# Check build logs in Sevalla dashboard
# If issues, try:
# 1. Clear build cache
# 2. Check Dockerfile syntax
# 3. Verify requirements.txt
```

### Port Issues
```bash
# Sevalla sets PORT automatically
# Flask uses: os.environ.get('PORT', 5000)
```

### CORS Issues
```bash
# Update Flask-CORS origins in clash.py
# For production: origins=["https://yourdomain.com"]
```

## Cost Comparison

| Service | Free Tier | Pro Plan | IFC Support |
|---------|-----------|----------|-------------|
| Vercel  | 100GB bandwidth | $20/month | ❌ Limited |
| **Sevalla** | **5GB bandwidth** | **$20/month** | ✅ **Full** |
| Railway | 512MB RAM | $5/month | ✅ Full |
| Render  | 750 hours | $7/month | ✅ Full |

## Need Help?

- 📖 [Sevalla Docs](https://docs.sevalla.com)
- 💬 [Community Forum](https://community.sevalla.com)
- 🎯 [Support](https://sevalla.com/support)

---

**🎉 Ready to deploy?** Push your code and Sevalla will handle the rest!
