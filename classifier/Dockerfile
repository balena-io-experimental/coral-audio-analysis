FROM alanb128/coral-audio:latest

RUN apt-get install -y sqlite3

WORKDIR /usr/src/app

COPY labels.txt labels.txt
COPY *.tflite ./
COPY *.py ./
COPY start.sh start.sh

ENV UDEV=1

CMD ["bash","start.sh"]
