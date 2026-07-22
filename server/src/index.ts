import { createApp } from './app';
import { env, isProd } from './config/env';
import { AVATAR_UPLOADS_DIR, AVATAR_UPLOADS_IS_EPHEMERAL } from './lib/avatarUpload';

// Fail-loud in production if avatar uploads are still landing on the ephemeral
// process-relative default: on Render (and similar) that directory is wiped on
// every redeploy/restart, so uploaded avatars would silently disappear. Fix by
// attaching a persistent disk and pointing AVATAR_UPLOADS_DIR at its mount.
if (isProd && AVATAR_UPLOADS_IS_EPHEMERAL) {
  console.warn(
    `[avatars] AVATAR_UPLOADS_DIR is not set — uploads go to ${AVATAR_UPLOADS_DIR}, ` +
      `which is EPHEMERAL on hosts like Render (wiped on every redeploy/restart). ` +
      `Attach a persistent disk and set AVATAR_UPLOADS_DIR to its mount path.`
  );
}

createApp().listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
