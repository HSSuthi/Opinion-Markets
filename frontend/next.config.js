/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['ipfs.io', 'gateway.pinata.cloud'],
  },
  env: {
    NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    NEXT_PUBLIC_PROGRAM_ID: process.env.NEXT_PUBLIC_PROGRAM_ID || '2NaUpg4jEZVGDBmmuKYLdsAfSGKwHxjghhfgVpQvZJYu',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK || 'devnet',
    NEXT_PUBLIC_USDC_MINT: process.env.NEXT_PUBLIC_USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    NEXT_PUBLIC_TREASURY_ADDRESS: process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '',
  },
};

module.exports = nextConfig;
