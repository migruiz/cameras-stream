FROM node:8-alpine

#4.1.3
RUN apk add --update curl xz make python g++ \
&& curl -o ffmpeg-static.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz \
&& mkdir ffmpeg \
&& tar xf ffmpeg-static.tar.xz  -C /ffmpeg --strip-components=1 \
&& apk del curl xz  \
&& rm -rf ffmpeg-static.tar.xz  \
&& rm -rf /var/cache/apk/*


RUN mkdir /App/
COPY App/package.json  /App/package.json


RUN cd /App \
&& npm  install 


COPY App /App

ENTRYPOINT ["node","/App/app.js"]



