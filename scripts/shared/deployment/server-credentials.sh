#!/bin/bash
# Deployment credentials for Kwezi server (209.74.80.195)
# Do not commit - in .gitignore

SERVER_IP="209.74.80.195"
SERVER_USER="root"
SERVER_PASS="H3802BIpstCSg7bXd4"
SERVER_PORT="22"

# Deployment paths
GEMURA_DEPLOY_PATH="/opt/gemura"
ORORA_DEPLOY_PATH="/opt/orora"

# Port allocation on Kwezi server:
# - 3000: Kwezi UI
# - 3001: HcRF UI
# - 3002: Orchestrate UI
# - 3003: Orchestrate API
# - 3004: HcRF API
# - 3005: ResolveIt Frontend
# - 3006: Gemura UI
# - 3007: Gemura API
# - 3008: ResolveIt Backend
# - 3009: iFinance API
# - 3011: Orora Web

GEMURA_UI_PORT="3006"
GEMURA_API_PORT="3007"
ORORA_WEB_PORT="3011"

# Database
DB_NAME="gemura_db"
DB_USER="kwezi"

export SERVER_IP SERVER_USER SERVER_PASS SERVER_PORT
export GEMURA_DEPLOY_PATH ORORA_DEPLOY_PATH
export GEMURA_UI_PORT GEMURA_API_PORT ORORA_WEB_PORT
export DB_NAME DB_USER
