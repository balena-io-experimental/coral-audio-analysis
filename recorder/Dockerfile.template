FROM alanb128/coral-audio:latest

RUN apt-get install -y sqlite3

WORKDIR /usr/src/app

COPY *.py ./
COPY start.sh start.sh
COPY sound_app.db sound_app.db

ENV UDEV=1

CMD ["bash","start.sh"]
