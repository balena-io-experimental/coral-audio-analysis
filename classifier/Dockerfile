FROM  balenablocks/librosa-aarch64:raspberrypi4-64

# Ensure package install won't block for user input during build
ENV DEBIAN_FRONTEND=noninteractive

# Add google repositories
RUN \
    echo "deb https://packages.cloud.google.com/apt coral-edgetpu-stable main" | sudo tee /etc/apt/sources.list.d/coral-edgetpu.list && \
    curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add - && \
    printf "deb [arch=arm64] https://packages.cloud.google.com/apt mendel-bsp-enterprise-day main \n deb-src https://packages.cloud.google.com/apt mendel-bsp-enterprise-day main" \
    | tee /etc/apt/sources.list.d/multistrap-bsp.list && \
    printf "deb [arch=arm64] https://packages.cloud.google.com/apt mendel-day main \n deb-src https://packages.cloud.google.com/apt mendel-day main" \
    | tee /etc/apt/sources.list.d/multistrap-main.list

# Install Coral Dev samples and dependencies libedgetpu-dev removed, libedgetpu1-std now libedgetpu1-legacy-std
RUN \
    apt-get update && apt-get install -y wget \
    python3-edgetpu \
    imx-gpu-viv \
    weston-imx \
    libpulse0=12.2-4+deb10u1 libpulsedsp=12.2-4+deb10u1 \
    pulseaudio-utils=12.2-4+deb10u1 \
    pulseaudio=12.2-4+deb10u1 imx-board-audio=5-1 \
    alsa-utils=1.1.8-2 \
    sqlite3

# python3-edgetpu above installs older version of llvmlite, 
# so uninstall it to revert to version 0.31.0 from the base image
RUN \
    pip uninstall -y llvmlite

WORKDIR /usr/src/app

RUN \
    find /lib/modules -type f -name 'galcore.ko' -print0 | xargs -0 -I{} cp {} /usr/src/app/galcore.ko

ENV UDEV=1

COPY labels.txt labels.txt
COPY *.tflite ./
COPY *.py ./
COPY start.sh start.sh

CMD ["bash","start.sh"]
