FROM node:8.11.3-alpine

RUN apk add --virtual .build-dependencies curl \
&& curl -o ffmpeg  https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-64bit-static.tar.xz \
&& mkdir ffmpeg \
&& tar xf ffmpeg-git-64bit-static.tar.xz  -C /ffmpeg --strip-components=1 \
&& apk del curl











