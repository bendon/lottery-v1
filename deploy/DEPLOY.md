# L-Gain Lottery — Deployment Guide

Server: **10.10.10.102**  
Domain: **l-gain-v1.payl.to**

## 1. Prepare the server

```bash
# Install dependencies
sudo apt update
sudo apt install -y python3-venv python3-pip nginx certbot python3-certbot-nginx

# Create app directory
sudo mkdir -p /var/www/l-gain
sudo chown $USER:$USER /var/www/l-gain
```

## 2. Deploy the application

```bash
# Clone or copy project to server
cd /var/www/l-gain
git clone https://github.com/bendon/lottery-v1.git .
# Or: rsync/scp from your dev machine

# Python virtual env and backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env (copy from project, ensure CORS and M-Pesa URLs are set)
cp .env.example .env
nano .env   # Edit with production values

# Frontend build
cd frontend
npm ci
npm run build
cd ..
```

## 3. Nginx configuration

```bash
# Copy nginx config
sudo cp deploy/nginx-l-gain.conf /etc/nginx/sites-available/l-gain

# Create symlink
sudo ln -sf /etc/nginx/sites-available/l-gain /etc/nginx/sites-enabled/

# Remove default site if it conflicts
# sudo rm /etc/systemd/system/default

# Test and reload nginx
sudo nginx -t && sudo systemctl reload nginx
```

**Update paths in the config** if your app is not at `/var/www/l-gain`:
- `root /var/www/l-gain/frontend/dist;`

## 4. SSL (required for M-Pesa)

```bash
# Get certificate (nginx must be running on port 80 first)
sudo certbot --nginx -d l-gain-v1.payl.to

# Then uncomment the SSL block in nginx config and comment the HTTP-only block
sudo nano /etc/nginx/sites-available/l-gain
sudo nginx -t && sudo systemctl reload nginx
```

## 5. Backend service (systemd)

```bash
# Edit service file: set User/Group and paths to match your setup
sudo nano deploy/l-gain-backend.service

# Install and start
sudo cp deploy/l-gain-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable l-gain-backend
sudo systemctl start l-gain-backend
sudo systemctl status l-gain-backend
```

**If using a different user** (e.g. `lottery`), create it and adjust:
```bash
sudo useradd -r -s /bin/false lottery
sudo chown -R lottery:lottery /var/www/l-gain
# Update User=lottery in the service file
```

## 6. MongoDB

Ensure MongoDB is running and reachable. Update `MONGODB_URL` in `.env` if it's on another host.

## 7. Register M-Pesa C2B URLs

After deployment, log in to the admin panel and go to **Settings → M-Pesa** → click **Register C2B URLs**.

**M-Pesa C2B notes** (from [Safaricom Daraja integration guides](https://www.linkedin.com/pulse/complete-guide-integrating-mpesa-c2b-receive-alerts-payments-thuo-kphef/)):
- **Production uses C2B v2** — Safaricom’s email may mention v1; use v2 (`/mpesa/c2b/v2/registerurl`) for production.
- **Sandbox callbacks are unreliable** — Daraja sandbox often fails to send callbacks; live/production is more reliable for testing.
- **Sandbox shortcode** — When registering URLs on sandbox, if you get an error, try using shortcode `107031` (or the SP ID shown in the error).
- **MSISDN** — Safaricom may hash phone numbers. We expose `POST /api/msisdn/decode` (mpesa-hash-decoder format). Set `MPESA_DECODE_MSISDN_URL=https://l-gain-v1.payl.to/api/msisdn/decode` to use it. See `docs/MSISDN_DECODE_API.md`.

## Quick reference

| Component | Location |
|-----------|----------|
| App root | `/var/www/l-gain` |
| Frontend build | `/var/www/l-gain/frontend/dist` |
| Backend | uvicorn on `127.0.0.1:8000` |
| Nginx config | `/etc/nginx/sites-available/l-gain` |
