
module.exports = {
  apps: [
    {
      name: 'humango-app',
      script: 'node_modules/next/dist/bin/next',
      args: 'start --port 3000',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://admin:password@localhost:5432/compliance_db',
        GEMINI_API_KEY: 'AIzaSyA4BC-KiMnz_XVmIns4W5JuzTUqgWebEvU',
        GOOGLE_API_KEY: 'AIzaSyA4BC-KiMnz_XVmIns4W5JuzTUqgWebEvU',
        SMTP_HOST: 'smtp.humango.app',
        SMTP_PORT: '587',
        SMTP_USER: 'abuse@humango.app',
        SMTP_PASS: 'password',
        NEXT_PUBLIC_BASE_URL: 'https://bot.humango.app'
      }
    },
    {
      name: 'humango-worker',
      script: 'npx tsx src/scripts/worker.ts',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://admin:password@localhost:5432/compliance_db',
        GEMINI_API_KEY: 'AIzaSyA4BC-KiMnz_XVmIns4W5JuzTUqgWebEvU',
        SMTP_HOST: 'smtp.humango.app',
        SMTP_PORT: '587',
        SMTP_USER: 'abuse@humango.app',
        SMTP_PASS: 'password'
      }
    }
  ]
};
