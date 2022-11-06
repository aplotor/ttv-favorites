#!/bin/sh

if [ "$1" = "dev" ]; then
	if [ "$2" = "audit" ]; then
		npm audit
		return
	elif [ "$2" = "outdated" ]; then
		npm outdated
		return
	elif [ "$2" = "build" ]; then
		npm install
		npm run build
		return
	elif [ "$2" = "up" ]; then
		npm run dev
		return
	fi
elif [ "$1" = "prod" ]; then
	if [ "$2" = "build" ]; then
		sh ./run.sh dev build
		zip ./zip.zip -r ./manifest.json ./background/ ./foreground/ ./popup/ ./images/ ./build/
		return
	fi
fi
