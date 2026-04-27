#!/bin/sh

GOOGLE_APPLICATION_CREDENTIALS="$1"

docker run --rm -p 8080:8080 \
  -e GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS} \
  -e PORT=8080 \
  -v $HOME/.config/gcloud:/root/.config/gcloud \
  -v $HOME/.m2:/root/.m2 \
  token-validator-service:1.0.0-SNAPSHOT
