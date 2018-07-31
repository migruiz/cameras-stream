FROM node:8.11.3-alpine

RUN apk update &&  apk add --virtual .build-deps curl \
&& curl -o ffmpeg-git-64bit-static.tar.xz  https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-64bit-static.tar.xz \
&& mkdir ffmpeg \
&& tar xf ffmpeg-git-64bit-static.tar.xz  -C /ffmpeg --strip-components=1 \
&& apk del .build-deps \
&& rm -rf /var/cache/apk











