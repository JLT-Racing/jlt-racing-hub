# JLT Race Control (private Oracle deployment)
The service binds to 127.0.0.1:8088 and must **not** be exposed directly to the internet. Use an SSH tunnel to reach it.

## Deploy on Oracle
```bash
sudo systemctl stop blackwire
sudo systemctl disable blackwire
cd ~
git clone https://github.com/JLT-Racing/jlt-racing-hub.git jlt-racing-hub
cd ~/jlt-racing-hub
node --version   # Requires Node 22+
sudo install -d -m 700 /etc/jlt-race-control
read -rsp 'Set a long admin password: ' ADMIN_PASS; echo
printf 'JLT_ADMIN_PASSWORD=%s\nPORT=8088\n' "$ADMIN_PASS" | sudo tee /etc/jlt-race-control/config >/dev/null
unset ADMIN_PASS
sudo chmod 600 /etc/jlt-race-control/config
sudo tee /etc/systemd/system/jlt-race-control.service >/dev/null <<'EOF'
[Unit]
Description=JLT Private Race Control
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/jlt-racing-hub
EnvironmentFile=/etc/jlt-race-control/config
ExecStart=/usr/bin/node /home/ubuntu/jlt-racing-hub/race-control/server.mjs
Restart=on-failure
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now jlt-race-control
sudo systemctl status jlt-race-control --no-pager
```
If `node` is not `/usr/bin/node`, change ExecStart to the output of `command -v node`.

## Open privately from your PC
```bash
ssh -L 8088:127.0.0.1:8088 ubuntu@YOUR_ORACLE_IP
```
Open http://127.0.0.1:8088 in your local browser. The browser may ask for Basic Auth: username `admin`, password as configured. Enter the same password in the page's Admin password field. Enter the restricted steward key; it is sent only through the SSH tunnel to the Oracle server, used per request, and not saved to disk.

**This is a read-only preview tool.** It does not assign groups, calculate or publish standings yet. Do not deploy it on public GitHub Pages.
