FROM node:8.11.3-slim

RUN apt-get update && apt-get install -yqq --no-install-recommends curl build-essential python-dev\
&& curl -o ffmpeg-git-64bit-static.tar.xz  https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-64bit-static.tar.xz \
&& mkdir ffmpeg \
&& tar xf ffmpeg-git-64bit-static.tar.xz  -C /ffmpeg --strip-components=1 \
&& rm -rf /var/lib/apt/lists/* \
&& rm -rf ffmpeg-git-64bit-static.tar.xz 


RUN mkdir /App/
COPY App/package.json  /App/package.json


RUN cd /App \
&& npm  install 


COPY App /App





