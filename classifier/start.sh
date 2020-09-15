#!/bin/bash

sleep 2

# Copy model and labels to shared volume - overwrites existing
cp /usr/src/app/sound_edgetpu.tflite /data/sound_app/qmodel3a8p2_edgetpu.tflite
cp /usr/src/app/labels.txt /data/sound_app/labels.txt

# Start the classifier
python3 classifier.py
