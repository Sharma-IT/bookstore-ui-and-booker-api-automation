# Pinned to the Playwright release in package.json so the browsers in the image
# match the driver the suite runs. Bump both together.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /suite

# Dependencies are installed in their own layer so a change to a spec does not
# invalidate the install.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Overridable so the same image runs a smoke check, one shard, or the lot.
ENTRYPOINT ["npx", "playwright", "test"]
