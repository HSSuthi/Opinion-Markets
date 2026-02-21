# Multi-stage build for Opinion-Markets smart contract
# Stage 1: Build environment
FROM rust:1.89.0 as builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Rust manifest files
COPY rust-toolchain.toml Cargo.toml Cargo.lock ./

# Copy programs
COPY programs ./programs

# Copy vendor directory if exists
COPY vendor ./vendor 2>/dev/null || true

# Build the program in release mode
RUN cargo build --release --manifest-path programs/opinion-market/Cargo.toml

# Stage 2: Extract artifacts
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy build artifacts from builder
COPY --from=builder /app/programs/opinion-market/target/release/opinion_market.so ./

# Copy configuration files
COPY Anchor.toml ./
COPY Cargo.toml ./
COPY rust-toolchain.toml ./

# Create non-root user
RUN useradd -m -u 1000 solana

# Set permissions
RUN chown -R solana:solana /app

USER solana

# Default command
CMD ["/bin/bash"]

# Labels
LABEL org.opencontainers.image.title="Opinion-Markets Smart Contract"
LABEL org.opencontainers.image.description="Solana smart contract for decentralized opinion markets"
LABEL org.opencontainers.image.version="0.1.0"
LABEL org.opencontainers.image.url="https://github.com/HSSuthi/Opinion-Markets"
