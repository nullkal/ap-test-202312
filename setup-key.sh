#!/bin/sh

mkdir -p data

openssl genrsa -out ./data/private.pem 2048
openssl rsa -in ./data/private.pem -outform PEM -pubout -out ./data/public.pem
