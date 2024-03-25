# thot-site

Example S3 static site setup using AWS CDK

CDK creates the following:

- S3 bucket with website assets
- SSL Certificate
- CloudFront Distribution

Live site can be seen here: https://thot-site.com

# Rust btw
Now there is a rust lambda

## Testing
Building:
```
// Everything
npm run build

// Or just the the lambda
npm run build-lambda
```

Spin up your lambda function locally:
```
npm run start-lambda
```

Visit http://localhost:9000/lambda-url/leader-lambda/

## Deploying
```
npm run deploy
```
