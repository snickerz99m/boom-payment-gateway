#!/bin/bash

# BOOM Payment Gateway - Universal Setup Script
# Works on Linux, macOS, and WSL

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  BOOM Payment Gateway - Setup Script${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

# Function to get package manager
get_package_manager() {
    if command_exists apt-get; then
        echo "apt"
    elif command_exists yum; then
        echo "yum"
    elif command_exists dnf; then
        echo "dnf"
    elif command_exists pacman; then
        echo "pacman"
    elif command_exists brew; then
        echo "brew"
    else
        echo "unknown"
    fi
}

# Function to install Node.js
install_nodejs() {
    local os=$1
    local pkg_manager=$2
    
    print_info "Installing Node.js..."
    
    case $pkg_manager in
        apt)
            # Ubuntu/Debian
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        yum|dnf)
            # RedHat/CentOS/Fedora
            curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
            sudo $pkg_manager install -y nodejs npm
            ;;
        pacman)
            # Arch Linux
            sudo pacman -S nodejs npm
            ;;
        brew)
            # macOS
            brew install node
            ;;
        *)
            print_error "Cannot auto-install Node.js on this system"
            print_info "Please install Node.js manually from: https://nodejs.org/"
            exit 1
            ;;
    esac
}

# Function to check Node.js version
check_nodejs_version() {
    local version=$(node --version | cut -d'v' -f2)
    local major_version=$(echo $version | cut -d'.' -f1)
    
    if [ "$major_version" -lt 16 ]; then
        print_error "Node.js version $version is too old. Minimum required: 16.0.0"
        return 1
    fi
    
    print_success "Node.js version $version is compatible"
    return 0
}

# Function to generate secure encryption key
generate_encryption_key() {
    if command_exists openssl; then
        echo $(openssl rand -base64 24 | tr -d "=+/" | cut -c1-32)
    else
        # Fallback for systems without openssl
        echo "boom-payment-gateway-encrypt-key"
    fi
}

# Function to update environment file
update_env_file() {
    if [ ! -f ".env" ]; then
        cp .env.example .env
        print_success "Created .env file from template"
    else
        print_info ".env file already exists"
    fi
    
    # Generate a secure encryption key
    local encryption_key=$(generate_encryption_key)
    
    # Update the encryption key in .env file
    if command_exists sed; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS sed
            sed -i '' "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$encryption_key/" .env
        else
            # Linux sed
            sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$encryption_key/" .env
        fi
        print_success "Updated encryption key in .env file"
    else
        print_warning "Could not update encryption key automatically"
        print_info "Please manually update ENCRYPTION_KEY in .env file to exactly 32 characters"
    fi
}

# Function to setup firewall rules
setup_firewall() {
    local os=$1
    
    print_info "Setting up firewall rules for port 3000..."
    
    case $os in
        linux)
            if command_exists ufw; then
                sudo ufw allow 3000/tcp
                print_success "UFW firewall rule added for port 3000"
            elif command_exists firewall-cmd; then
                sudo firewall-cmd --permanent --add-port=3000/tcp
                sudo firewall-cmd --reload
                print_success "Firewall rule added for port 3000"
            else
                print_warning "Could not configure firewall automatically"
                print_info "Please manually allow port 3000 in your firewall"
            fi
            ;;
        macos)
            print_info "macOS firewall configuration may be required"
            print_info "You may need to allow port 3000 in System Preferences > Security & Privacy > Firewall"
            ;;
        *)
            print_warning "Firewall configuration not supported for this OS"
            ;;
    esac
}

# Function to create necessary directories
create_directories() {
    print_info "Creating necessary directories..."
    
    mkdir -p data
    mkdir -p logs
    mkdir -p tmp
    
    # Set proper permissions
    chmod 755 data logs tmp
    
    print_success "Directories created successfully"
}

# Function to install dependencies with retry
install_dependencies() {
    print_info "Installing Node.js dependencies..."
    
    local max_retries=3
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if npm install --production=false; then
            print_success "Dependencies installed successfully"
            return 0
        else
            retry_count=$((retry_count + 1))
            print_warning "Installation failed, retrying... ($retry_count/$max_retries)"
            sleep 2
        fi
    done
    
    print_error "Failed to install dependencies after $max_retries attempts"
    return 1
}

# Function to run database migration
setup_database() {
    print_info "Setting up database..."
    
    if npm run migrate; then
        print_success "Database setup completed"
    else
        print_warning "Database migration failed, but continuing..."
    fi
}

# Function to run tests
run_tests() {
    print_info "Running tests..."
    
    if npm test; then
        print_success "All tests passed"
    else
        print_warning "Some tests failed, but continuing..."
    fi
}

# Function to check system requirements
check_system_requirements() {
    print_info "Checking system requirements..."
    
    # Check available memory
    if command_exists free; then
        local memory_mb=$(free -m | grep '^Mem:' | awk '{print $2}')
        if [ "$memory_mb" -lt 512 ]; then
            print_warning "Low memory detected ($memory_mb MB). Minimum recommended: 512 MB"
        fi
    fi
    
    # Check available disk space
    local disk_space=$(df . | tail -1 | awk '{print $4}')
    if [ "$disk_space" -lt 102400 ]; then  # 100MB in KB
        print_warning "Low disk space detected. Minimum recommended: 100 MB"
    fi
    
    print_success "System requirements check completed"
}

# Function to create start script
create_start_script() {
    print_info "Creating start script..."
    
    cat > start.sh << 'EOF'
#!/bin/bash
echo "Starting BOOM Payment Gateway..."
echo "Admin Panel: http://localhost:3000/admin"
echo "API Base: http://localhost:3000/api/v1"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
npm start
EOF
    
    chmod +x start.sh
    print_success "Start script created (./start.sh)"
}

# Function to display completion message
display_completion() {
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  Setup Complete!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo -e "${GREEN}Your BOOM Payment Gateway is ready to use!${NC}"
    echo ""
    echo -e "${BLUE}To start the server:${NC}"
    echo -e "  ${YELLOW}npm start${NC}"
    echo -e "  ${YELLOW}# or${NC}"
    echo -e "  ${YELLOW}./start.sh${NC}"
    echo ""
    echo -e "${BLUE}Once started, you can access:${NC}"
    echo -e "  ${YELLOW}Admin Panel: http://localhost:3000/admin${NC}"
    echo -e "  ${YELLOW}API Base:    http://localhost:3000/api/v1${NC}"
    echo ""
    echo -e "${BLUE}Default admin credentials:${NC}"
    echo -e "  ${YELLOW}Email:    admin@boom-payments.com${NC}"
    echo -e "  ${YELLOW}Password: password${NC}"
    echo ""
    echo -e "${RED}IMPORTANT: Change the default password in production!${NC}"
    echo ""
}

# Function to ask user if they want to start the server
ask_start_server() {
    read -p "Would you like to start the server now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Starting server..."
        echo ""
        echo -e "${YELLOW}Press Ctrl+C to stop the server when done${NC}"
        echo ""
        
        # Try to open browser if available
        if command_exists xdg-open; then
            xdg-open "http://localhost:3000/admin" 2>/dev/null || true
        elif command_exists open; then
            open "http://localhost:3000/admin" 2>/dev/null || true
        fi
        
        npm start
    else
        print_info "Setup complete! Run 'npm start' or './start.sh' when ready to begin."
    fi
}

# Main setup function
main() {
    print_header
    
    # Detect OS and package manager
    local os=$(detect_os)
    local pkg_manager=$(get_package_manager)
    
    print_info "Detected OS: $os"
    print_info "Package manager: $pkg_manager"
    
    # Check system requirements
    check_system_requirements
    
    # Check Node.js
    if command_exists node; then
        local node_version=$(node --version)
        print_success "Node.js is installed: $node_version"
        
        if ! check_nodejs_version; then
            print_info "Attempting to upgrade Node.js..."
            install_nodejs "$os" "$pkg_manager"
        fi
    else
        print_warning "Node.js is not installed"
        install_nodejs "$os" "$pkg_manager"
    fi
    
    # Check npm
    if command_exists npm; then
        local npm_version=$(npm --version)
        print_success "npm is available: $npm_version"
    else
        print_error "npm is not available after Node.js installation"
        exit 1
    fi
    
    # Create directories
    create_directories
    
    # Install dependencies
    install_dependencies
    
    # Update environment file
    update_env_file
    
    # Setup database
    setup_database
    
    # Run tests
    run_tests
    
    # Setup firewall (optional)
    setup_firewall "$os"
    
    # Create start script
    create_start_script
    
    # Display completion message
    display_completion
    
    # Ask if user wants to start now
    ask_start_server
}

# Run main function
main "$@"