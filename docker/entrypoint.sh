#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://cove:cove@127.0.0.1:5432/cove?connect_timeout=3"
fi

mkdir -p /app/data/uploads
chown -R appuser:appgroup /app/data

cd /app
su -s /bin/sh appuser -c "node node_modules/prisma/build/index.js migrate deploy"
exec su -s /bin/sh appuser -c "node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000"
