# Judge-mode container. Must match @cloudflare/sandbox 0.12.9 (image tag = npm version).
FROM docker.io/cloudflare/sandbox:0.12.9-python

# zsh for shell integration (OSC 133), git/curl/jq for the demo, no sudo for the judge user.
RUN apt-get update \
  && apt-get install -y --no-install-recommends zsh git curl jq ca-certificates build-essential python3 \
  && rm -rf /var/lib/apt/lists/* \
  && useradd -m -s /bin/zsh -u 1000 judge \
  && echo 'export PS1="judge@rokan:%~ %# "' > /home/judge/.zshrc \
  && echo 'autoload -Uz compinit && compinit -u' >> /home/judge/.zshrc \
  && chown -R judge:judge /home/judge

# Our bridge (synced from packages/bridge by scripts/sync-bridge.sh). node-pty has no linux prebuild for Node 22 here → node-gyp needs build-essential.
COPY container/bridge /opt/bridge
WORKDIR /opt/bridge
# Fail loudly if deps do not install (a swallowed failure here cost an hour on 2026-08-28).
RUN npm install --omit=dev --no-audit --no-fund --loglevel=error \
  && test -d node_modules/ws && test -d node_modules/node-pty \
  && node -e "import('node-pty').then(() => console.log('node-pty ok'))"
RUN chown -R judge:judge /opt/bridge

# Seed: what this sandbox is and what it can reach.
COPY --chown=judge:judge container/seed/ /home/judge/

USER judge
WORKDIR /home/judge
ENV HOME=/home/judge SHELL=/bin/zsh TERM=xterm-256color ROKAN_MODE=judge
