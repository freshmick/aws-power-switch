# Recordings

The two GIFs in the main README and what makes them. Neither needs an AWS or Cloudflare account.

| GIF | Shows | Made by |
| --- | --- | --- |
| `page.gif` | The page, served by the local dev server with its sample data, while a group is started and stopped. | `record-page.mjs` |
| `deploy.gif` | An illustration of the Terraform standalone install. The output is canned, not from a real deploy. | `deploy.tape`, which plays `fake-deploy.sh` |

To make them again (needs `ffmpeg`, and [`vhs`](https://github.com/charmbracelet/vhs) for the terminal one):

```sh
# page.gif: playwright-core goes in a scratch folder, not in this repo
REPO=$PWD && mkdir -p "$TMPDIR/demo" && cd "$TMPDIR/demo" && npm install playwright-core
node "$REPO/docs/demo/record-page.mjs"   # CHROMIUM_PATH=... to use a Chromium you already have

# deploy.gif
cd "$REPO/docs/demo" && vhs deploy.tape
```

The pointer in `page.gif` is drawn by the script, since a headless browser has none. The dev server's fakes settle at once, so the recording goes straight from `stopped` to `running` and back without the `starting` and `stopping` states a real instance passes through.
