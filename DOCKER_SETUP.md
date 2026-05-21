# Prepzo Docker Setup Guide

This document describes how to build and run Prepzo using Docker and Docker Compose for production deployment.

## Files Included

- **`Dockerfile`** - Multi-stage build configuration for the Next.js application
- **`docker-compose.yml`** - Service orchestration for app and Nginx reverse proxy
- **`nginx.conf`** - Nginx configuration for reverse proxy and SSL termination
- **`.dockerignore`** - Files/directories excluded from Docker build context
- **`.env.docker`** - Environment variables template for Docker deployment

## Prerequisites

- Docker (v20.10+)
- Docker Compose (v1.29+)
- Environment variables configured (Supabase and Razorpay credentials)

## Quick Start

### 1. Configure Environment Variables

Create a `.env.prod` file with your production environment variables:

```bash
cp .env.docker .env.prod
```

Update `.env.prod` with your actual credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_RAZORPAY_KEY=your-razorpay-public-key
RAZORPAY_SECRET=your-razorpay-secret
```

### 2. Build the Docker Image

```bash
# Build the image locally
docker-compose build

# Or build just the app
docker build -t prepzo:latest .
```

### 3. Start the Services

```bash
# Start with environment file
docker-compose --env-file .env.prod up -d

# View logs
docker-compose logs -f app
```

### 4. Verify Services

```bash
# Check running containers
docker-compose ps

# Test health check
curl http://localhost:3000

# Check Nginx
curl http://localhost:80
```

## Production Deployment

### Enable SSL/TLS

The `nginx.conf` includes SSL configuration. To enable HTTPS:

1. **Generate or obtain SSL certificates:**
   ```bash
   # Using Let's Encrypt with Certbot
   certbot certonly --standalone -d yourdomain.com
   ```

2. **Place certificates in `./certs/` directory:**
   ```
   certs/
   ├── cert.pem
   └── key.pem
   ```

3. **Uncomment SSL configuration in `nginx.conf`:**
   ```nginx
   ssl_certificate /etc/nginx/certs/cert.pem;
   ssl_certificate_key /etc/nginx/certs/key.pem;
   ```

4. **Restart services:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### Environment Variables

Update the `environment` section in `docker-compose.yml` or use `.env` file:

```yaml
environment:
  NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
  SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
  NEXT_PUBLIC_RAZORPAY_KEY: ${NEXT_PUBLIC_RAZORPAY_KEY}
  RAZORPAY_SECRET: ${RAZORPAY_SECRET}
```

## Docker Commands Reference

### Build Commands

```bash
# Build specific service
docker-compose build app

# Rebuild without cache
docker-compose build --no-cache

# Build with custom tag
docker build -t prepzo:v1.0.0 .
```

### Run Commands

```bash
# Start services in background
docker-compose up -d

# Start with specific environment file
docker-compose --env-file .env.prod up -d

# Start with output
docker-compose up

# Start specific service
docker-compose up app
```

### Logs and Debugging

```bash
# View all logs
docker-compose logs

# Follow app logs
docker-compose logs -f app

# View last 100 lines
docker-compose logs --tail=100

# View logs from specific service
docker-compose logs nginx
```

### Container Management

```bash
# List running containers
docker-compose ps

# Execute command in container
docker-compose exec app npm run build

# Stop services
docker-compose stop

# Stop and remove containers
docker-compose down

# Remove volumes
docker-compose down -v

# Restart services
docker-compose restart
```

### Image Management

```bash
# List images
docker images | grep prepzo

# Remove image
docker rmi prepzo:latest

# Push to registry
docker tag prepzo:latest myregistry/prepzo:latest
docker push myregistry/prepzo:latest
```

## Resource Limits

The `docker-compose.yml` includes resource limits:

```yaml
deploy:
  resources:
    limits:
      cpus: '1'          # Max 1 CPU core
      memory: 1G         # Max 1GB RAM
    reservations:
      cpus: '0.5'        # Reserve 0.5 cores
      memory: 512M       # Reserve 512MB
```

Adjust these based on your server capacity and expected traffic.

## Health Checks

Both services include health checks:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

Check health status:

```bash
docker-compose ps
# Look for "(healthy)" or "(unhealthy)" status
```

## Logging

Logs are configured with size limits to prevent disk space issues:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"     # Max 10MB per log file
    max-file: "3"       # Keep 3 log files
```

View and manage logs:

```bash
# View logs
docker-compose logs app

# Prune old logs (warning: irreversible)
docker system prune --filter "until=72h"
```

## Security Best Practices

1. **Non-root user** - Dockerfile runs app as `nextjs` user (UID: 1001)
2. **Security headers** - Nginx includes HSTS, X-Frame-Options, CSP headers
3. **Rate limiting** - Nginx limits requests (10/s general, 100/s API)
4. **No secrets in image** - Use environment variables only
5. **Regular updates** - Keep base images updated:
   ```bash
   docker-compose build --no-cache --pull
   ```

## Performance Optimization

1. **Caching** - Nginx caches static assets for 1 year
2. **Gzip compression** - Enabled in Nginx for text assets
3. **Connection pooling** - Configured in Nginx upstream
4. **Multi-stage build** - Reduces final image size

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs app

# Verify environment variables
docker-compose config

# Check resource limits
docker stats
```

### Port already in use

```bash
# Find process using port 3000
lsof -i :3000

# Use different port in docker-compose
ports:
  - "3001:3000"
```

### Health check failing

```bash
# Check container logs
docker-compose logs app

# Test manually
docker-compose exec app curl http://localhost:3000
```

### Memory issues

```bash
# Monitor memory usage
docker stats

# Increase memory limit in docker-compose.yml
memory: 2G

# Rebuild and restart
docker-compose down
docker-compose up -d
```

## Deployment Checklist

- [ ] Environment variables configured in `.env.prod`
- [ ] SSL certificates ready (if using HTTPS)
- [ ] `nginx.conf` SSL paths updated
- [ ] Resource limits adjusted for your server
- [ ] Backup of current application
- [ ] Database backups configured
- [ ] Monitoring/alerting setup
- [ ] Log rotation configured
- [ ] Firewall rules updated (ports 80, 443, 3000)
- [ ] Domain DNS configured

## Updating the Application

To deploy a new version:

```bash
# Stop current services
docker-compose down

# Pull latest code
git pull

# Rebuild image
docker-compose build --no-cache

# Start with new image
docker-compose up -d

# Verify health
docker-compose ps
curl http://localhost:3000
```

## Monitoring and Maintenance

### Regular Backups

```bash
# Backup database through Supabase CLI
supabase db pull

# Backup volumes (if any)
docker run --rm -v prepzo_app_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/app-backup-$(date +%s).tar.gz /data
```

### System Cleanup

```bash
# Remove unused images, containers, and networks
docker system prune -a

# Remove unused volumes
docker volume prune
```

### Monitor Resource Usage

```bash
# Real-time monitoring
docker stats

# Historical data (requires a monitoring solution like Prometheus)
# Set up container monitoring for production
```

## Support

For issues or questions:

1. Check Docker logs: `docker-compose logs app`
2. Review `nginx.conf` for reverse proxy issues
3. Verify environment variables are set correctly
4. Check system resources: `docker stats`
5. Consult [Docker docs](https://docs.docker.com/) and [Next.js deployment guide](https://nextjs.org/docs/deployment)
