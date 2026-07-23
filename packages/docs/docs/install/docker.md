---
title: 'Docker'
sidebar_position: 2
---

## Hosting Actual on a home server with Docker

This repository includes a Docker configuration that builds the server from the
checked-out source. This ensures your container runs the code from this fork.

## Launch container using Docker Compose

Pre-requisites: Docker

From the repository root, use the included
`packages/sync-server/docker-compose.yml` to build and run the server from this
fork.

To create and run the container:

```bash
$ docker compose -f packages/sync-server/docker-compose.yml up --detach --build
```

You can optionally configure the container using environment variables — see the [configuration section](../config/index.md) for more details.

### Update Docker Compose container

```bash
$ docker compose -f packages/sync-server/docker-compose.yml up --detach --build
```

## Launch container using docker command

Pre-requisites: Docker

Alternatively to Docker Compose, build an image from this checkout and then run it.

```bash
$ docker build --tag actual-ai-server:local --file sync-server.Dockerfile .
$ docker run --restart=unless-stopped -d -p 5006:5006 -v YOUR/PATH/TO/DATA:/data --name actual-ai actual-ai-server:local
```

`--restart=unless-stopped` -- sets the restart policy of the container

`-d` -- starts the container as background application

`-p 5006:5006` -- sets the port to access Actual. (HOST PORT:DOCKER PORT)

`-v YOUR/PATH/TO/DATA:/data` -- tells the container where to store your budget data. This persists the data on your hard disk so it isn't lost if you remove the container. Change the current value to a folder on your host computer. The server will create `server-files` and `user-files` subfolders at this location.

`--name actual-ai` -- gives your new docker container a name (change this to whatever you want)

### Update Docker container using docker command

```bash
$ docker stop actual-ai
```

```bash
$ docker container rm actual-ai
```

```bash
$ docker build --tag actual-ai-server:local --file sync-server.Dockerfile .
$ docker run --restart=unless-stopped -d -p 5006:5006 -v YOUR/PATH/TO/DATA:/data --name actual-ai actual-ai-server:local
```

You can place all of these in a batch script for a 1 click or single command update.

```bash
$ docker stop actual-ai && docker container rm actual-ai && docker build --tag actual-ai-server:local --file sync-server.Dockerfile . && docker run --restart=unless-stopped -d -p 5006:5006 -v YOUR/PATH/TO/DATA:/data --name actual-ai actual-ai-server:local
```

## Test connection within local network

On another PC within the local network connect to http://_serverIP_:_chosenPort_
