#!/bin/sh
set -eu

: "${BACKEND_UPSTREAM:=https://sprintflow-api-badralmunh.fly.dev}"

envsubst '${BACKEND_UPSTREAM}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
