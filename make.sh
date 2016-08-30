#!/usr/bin/env bash

export LAST_BUILD_SIZE=$(stat -f%z build/submission.zip)
export LAST_COMMIT_SIZE=$(cat buildSize.txt)
rm -rf build
mkdir build
uglifyjs --enclose --compress --mangle -- script.js > build/script.js
cp index.html build/
cp shader.*.glsl build/
zip -r build/submission.zip build > /dev/null
export SIZE=$(stat -f%z build/submission.zip)
echo $SIZE > buildSize.txt
echo "$((100 * $SIZE / 13000))%"
echo "$SIZE bytes"
echo "$(($SIZE - $LAST_BUILD_SIZE)) bytes changed since last build"
echo "$(($SIZE - $LAST_COMMIT_SIZE)) bytes changed since last commit"
