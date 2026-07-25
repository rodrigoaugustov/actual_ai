FROM node:22-bookworm AS deps

# Install required packages. python3/make/g++ are insurance for arm64 builds:
# better-sqlite3, bcrypt and argon2 are marked "built" in the root package.json
# and normally resolve to prebuilds, but without a toolchain a single missing
# prebuild turns into a hard build failure.
RUN apt-get update && apt-get install -y openssl python3 make g++

WORKDIR /app

# Copy only the files needed for installing dependencies
COPY .yarn ./.yarn
COPY yarn.lock package.json .yarnrc.yml tsconfig.json lage.config.js ./
COPY packages ./packages

COPY ./bin/package-browser ./bin/package-browser

RUN yarn install

FROM deps AS builder

WORKDIR /app

ARG BUILD_REVISION=local

# Increase memory limit for the build process to 8GB
ENV NODE_OPTIONS=--max_old_space_size=8192
ENV REACT_APP_BUILD_REVISION=$BUILD_REVISION

# lage's task hasher invokes `git ls-tree HEAD` during initialization, so it
# needs a git repo even when individual targets disable caching. .dockerignore
# omits the real .git, so seed a throwaway repo with a single commit here.
RUN git -c init.defaultBranch=master init -q \
    && git -c user.email=build@docker -c user.name=docker-build add -A \
    && git -c user.email=build@docker -c user.name=docker-build commit -qm build

# Docker builds must be self-contained: do not fetch the upstream translations
# repository. The browser build falls back to the translations available in this
# checkout (English when no local catalogue has been added yet).
RUN yarn build:browser --skip-translations \
    && yarn workspace @actual-app/sync-server build

# Focus the workspaces in production mode (including @actual-app/web you just built)
RUN yarn workspaces focus @actual-app/sync-server --production

# Remove symbolic links for @actual-app/web and @actual-app/sync-server
RUN rm -rf ./node_modules/@actual-app/web ./node_modules/@actual-app/sync-server

# Copy in the @actual-app/web artifacts manually, so we don't need the entire packages folder
COPY ./packages/desktop-client/package.json ./node_modules/@actual-app/web/package.json
RUN cp -r ./packages/desktop-client/build ./node_modules/@actual-app/web/build

FROM node:22-bookworm-slim AS prod

# Minimal runtime dependencies
RUN apt-get update && apt-get install -y tini && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Build identity is exposed by /info and by OCI image metadata.
ARG BUILD_REVISION=local
ARG BUILD_CREATED=unknown
ARG CLIENT_VERSION=1.0.0
ARG SERVER_VERSION=1.0.0
ENV ACTUAL_BUILD_REVISION=$BUILD_REVISION
ENV ACTUAL_BUILD_CREATED=$BUILD_CREATED
LABEL org.opencontainers.image.title="Actual AI" \
      org.opencontainers.image.description="Actual AI - Client v${CLIENT_VERSION}, Server v${SERVER_VERSION}" \
      org.opencontainers.image.version="client-${CLIENT_VERSION}_server-${SERVER_VERSION}" \
      org.opencontainers.image.revision="${BUILD_REVISION}" \
      org.opencontainers.image.created="${BUILD_CREATED}" \
      io.actual.client.version="${CLIENT_VERSION}" \
      io.actual.server.version="${SERVER_VERSION}"

# Create a non-root user
ARG USERNAME=actual
ARG USER_UID=1001
ARG USER_GID=$USER_UID
RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && mkdir /data && chown -R ${USERNAME}:${USERNAME} /data

WORKDIR /app
ENV NODE_ENV=production

# Pull in only the necessary artifacts (built node_modules, server files, etc.)
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages/sync-server/package.json ./
COPY --from=builder /app/packages/sync-server/build ./build

# Keep the healthcheck path used by docker-compose compatible with the bundled
# server layout.
RUN ln -s build/scripts scripts

# Drop privileges. The user is created above but upstream never switches to it,
# so the container would otherwise run as root. /data must be owned by 1001.
USER $USERNAME

ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
EXPOSE 5006
CMD ["node", "build/app.js"]
