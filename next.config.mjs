/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ['172.25.96.1', '172.22.192.1', '*.ngrok-free.app', '*.ngrok.app', '*.ngrok.io', '*.ngrok-free.dev'],
};

export default nextConfig;
