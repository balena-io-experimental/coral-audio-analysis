#!/bin/bash

sleep 2

# Copy model and labels to shared volume if if doesn't exist already (-n)
cp -n /usr/src/app/qmodel3a8p2_edgetpu.tflite /data/sound_app/qmodel3a8p2_edgetpu.tflite
cp -n /usr/src/app/labels.txt /data/sound_app/labels.txt
rm /usr/src/app/labels.txt
rm /usr/src/app/qmodel3a8p2_edgetpu.tflite

# Start the classifier
python3 classifier.py
