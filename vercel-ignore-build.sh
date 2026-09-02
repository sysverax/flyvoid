#!/bin/bash

if [ "$VERCEL_GIT_COMMIT_REF" = "test" ]; then
  echo "Deploying test branch"
  exit 1
fi

echo "Skipping deployment for branch: $VERCEL_GIT_COMMIT_REF"
exit 0