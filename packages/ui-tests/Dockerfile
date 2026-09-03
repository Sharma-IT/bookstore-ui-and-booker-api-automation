# Pinned to the Playwright release in package.json so the browsers in the image
# match the driver the suite runs. Bump both together.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

# The build context is the repository root, not this directory.
#
# This is an npm workspace: the lockfile and the workspace declarations live at
# the root, and `npm ci` refuses to run without a lockfile beside the manifest
# that declares the workspaces. Building from this directory cannot work, and
# did not: the previous version copied a `package-lock.json` that has never
# existed here. Build it with the root as context:
#
#   docker build -f packages/ui-tests/Dockerfile -t bookstore-ui-tests .
#
# or through the compose file beside this one, which sets the context for you.
WORKDIR /repo

# Manifests first, so editing a spec does not invalidate the install layer.
# Every workspace member's manifest is needed, not just this one, because npm
# reconstructs the whole tree from the lockfile.
COPY package.json package-lock.json ./
COPY packages/ui-tests/package.json ./packages/ui-tests/
COPY packages/api-tests/package.json ./packages/api-tests/
RUN npm ci

COPY . .

# The suite reads its config from this package, so commands arriving through the
# entrypoint resolve the same paths they would locally.
WORKDIR /repo/packages/ui-tests

# Overridable so the same image runs a smoke check, one shard, or the lot.
ENTRYPOINT ["npx", "playwright", "test"]
