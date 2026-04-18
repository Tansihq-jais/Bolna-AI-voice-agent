#!/bin/bash

# Voice Campaign Platform Production Deployment Script

set -e

echo "🚀 Voice Campaign Platform - Production Deployment"
echo "=================================================="

# Configuration
DOMAIN=${DOMAIN:-"your-domain.com"}
EMAIL=${EMAIL:-"admin@your-domain.com"}
BOLNA_API_KEY=${BOLNA_API_KEY:-""}
JWT_SECRET=${JWT_SECRET:-""}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    if [ -z "$BOLNA_API_KEY" ]; then
        log_error "BOLNA_API_KEY environment variable is required"
        exit 1
    fi
    
    log_info "Prerequisites check passed ✓"
}

# Generate secure JWT secret
generate_jwt_secret() {
    if [ -z "$JWT_SECRET" ]; then
        log_info "Generating secure JWT secret..."
        JWT_SECRET=$(openssl rand -base64 32)
        log_info "JWT secret generated ✓"
    fi
}

# Create production environment file
create_env_file() {
    log_info "Creating production environment file..."
    
    cat > .env << EOF
# Production Environment Configuration
BOLNA_API_KEY=${BOLNA_API_KEY}
BOLNA_API_BASE=https://api.bolna.ai
PLATFORM_MARKUP_PER_MIN=0.02
BOLNA_BASE_COST_PER_MIN=0.02
WEBHOOK_BASE_URL=https://${DOMAIN}
PORT=3001
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}
DATABASE_PATH=./data/voice_campaigns.db
CORS_ORIGIN=https://${DOMAIN}
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
EOF
    
    log_info "Environment file created ✓"
}

# Update nginx configuration
update_nginx_config() {
    log_info "Updating nginx configuration..."
    
    sed -i "s/your-domain.com/${DOMAIN}/g" nginx.conf
    
    log_info "Nginx configuration updated ✓"
}

# Setup SSL certificates
setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    if [ ! -d "ssl" ]; then
        mkdir -p ssl
    fi
    
    # Check if certificates already exist
    if [ -f "ssl/cert.pem" ] && [ -f "ssl/key.pem" ]; then
        log_info "SSL certificates already exist ✓"
        return
    fi
    
    # Generate self-signed certificates for development
    # In production, replace with real certificates from Let's Encrypt
    log_warn "Generating self-signed SSL certificates for development"
    log_warn "For production, replace with real certificates from Let's Encrypt"
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem \
        -out ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=${DOMAIN}"
    
    log_info "SSL certificates generated ✓"
}

# Build and start services
deploy_services() {
    log_info "Building and starting services..."
    
    # Build the application
    docker-compose -f docker-compose.prod.yml build
    
    # Start services
    docker-compose -f docker-compose.prod.yml up -d
    
    log_info "Services started ✓"
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    # Wait for services to start
    sleep 10
    
    # Check if services are running
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        log_info "Services are running ✓"
    else
        log_error "Services failed to start"
        docker-compose -f docker-compose.prod.yml logs
        exit 1
    fi
    
    # Test API endpoint
    if curl -f -s "http://localhost:3001/api/agents" > /dev/null; then
        log_info "API health check passed ✓"
    else
        log_error "API health check failed"
        exit 1
    fi
}

# Display deployment information
show_deployment_info() {
    log_info "Deployment completed successfully! 🎉"
    echo ""
    echo "Your Voice Campaign Platform is now running at:"
    echo "  🌐 HTTPS: https://${DOMAIN}"
    echo "  🔧 API:   https://${DOMAIN}/api"
    echo ""
    echo "Next steps:"
    echo "  1. Point your domain DNS to this server"
    echo "  2. Replace self-signed SSL certificates with real ones"
    echo "  3. Configure your CRM to use the API endpoints"
    echo "  4. Test the integration with the provided SDKs"
    echo ""
    echo "Useful commands:"
    echo "  📊 View logs:    docker-compose -f docker-compose.prod.yml logs -f"
    echo "  🔄 Restart:      docker-compose -f docker-compose.prod.yml restart"
    echo "  🛑 Stop:         docker-compose -f docker-compose.prod.yml down"
    echo "  📈 Monitor:      docker-compose -f docker-compose.prod.yml ps"
    echo ""
    echo "SDK Integration:"
    echo "  📁 JavaScript SDK: ./sdk/voice-platform-sdk.js"
    echo "  🐍 Python SDK:     ./sdk/voice-platform-sdk.py"
    echo ""
}

# Main deployment process
main() {
    check_prerequisites
    generate_jwt_secret
    create_env_file
    update_nginx_config
    setup_ssl
    deploy_services
    health_check
    show_deployment_info
}

# Run deployment
main "$@"