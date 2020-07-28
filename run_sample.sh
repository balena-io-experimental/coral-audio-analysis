cd /usr/share/edgetpu/examples/

echo "Running sample: /usr/share/edgetpu/examples/classify_image.py"

python3 classify_image.py \
    --model models/mobilenet_v2_1.0_224_inat_bird_quant_edgetpu.tflite \
    --label models/inat_bird_labels.txt \
    --image images/parrot.jpg

/bin/bash /usr/src/app/start_weston.sh &

sleep infinity
