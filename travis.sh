#!/bin/bash  
set -ev
HUBNAME=migruiz/cameras-stream-rpi;
docker pull $HUBNAME || true
docker build  --cache-from $HUBNAME  -t $HUBNAME  -f rpi/Dockerfile .
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin 
docker push $HUBNAME  

HUBNAME=migruiz/cameras-stream;
docker pull $HUBNAME || true
docker build  --cache-from $HUBNAME  -t $HUBNAME  -f alpine/Dockerfile .
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin 
docker push $HUBNAME  