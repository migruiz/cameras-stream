FROM balenalib/raspberrypi3-alpine-node:8-latest
RUN [ "cross-build-start" ]



#4.1.3
RUN apk add --update curl xz make python g++ \
&& curl -o ffmpeg-static.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-armhf-static.tar.xz \
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

RUN [ "cross-build-end" ]  

ENTRYPOINT ["node","/App/app.js"]