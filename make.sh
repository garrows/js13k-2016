#!/usr/bin/env bash

export SIZEORIG=$(stat -f%z build/submission.zip)
rm -rf build
mkdir build
uglifyjs --enclose --compress --mangle -- script.js > build/script.js
cp index.html build/
cp shader.*.glsl build/
zip -r build/submission.zip build > /dev/null
export SIZE=$(stat -f%z build/submission.zip)
echo "$((100 * $SIZE / 13000))%"
echo "$SIZE bytes"
echo "$(($SIZE - $SIZEORIG)) bytes changed"
