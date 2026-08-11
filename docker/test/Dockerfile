# nginx + built bundle for the smoke-prod tier. Mirrors docker/Dockerfile's
# COPY layout; public base image, so CI needs no registry auth.
#
# Baked, not bind-mounted: bind paths resolve against the host, which breaks
# when the runner mounts the host Docker socket into a job container.
FROM nginx:alpine

COPY dist/ /usr/share/nginx/html/
COPY docker/fs/ /

# Production drops the stock vhost too; ours must be the only conf.d entry.
RUN rm -f /etc/nginx/conf.d/default.conf

# 127.0.0.1, not localhost: our config is IPv4-only, and the base image only
# adds a v6 listener to default.conf, which we just removed.
HEALTHCHECK --interval=5s --timeout=2s --start-period=2s --retries=10 \
    CMD wget -q --spider http://127.0.0.1/health || exit 1
