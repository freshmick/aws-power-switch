# aws-power-switch

Start and stop tagged AWS resources from a small web page behind Cloudflare Access. The app in `app/` is a Lambda (Node 22, AWS SDK v3 from the runtime, no npm dependencies) that lists the EC2 and RDS instances carrying a tag key and starts or stops them, after checking the Access token, the request's origin and the tag on every action; run its tests with `node --test 'app/tests/*.test.mjs'` and try it locally against in-memory fakes with `node app/dev/serve.mjs`. MIT licensed (see `LICENSE`).
