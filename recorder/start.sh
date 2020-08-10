#!/bin/bash

# Get audio running
bash /etc/runonce.d/00-disable-tsched.sh
/usr/bin/pulseaudio --daemonize=no &

# Set Coral Dev board speaker to 50%
amixer -c 0 set Speaker 50% y

sleep 5

# Copy database to shared volume if if doesn't exist already (-n)
cp -n /usr/src/app/sound_app.db /data/sound_app/sound_app.db
rm /usr/src/app/sound_app.db

# Start the recorder
python3 recorder.py
