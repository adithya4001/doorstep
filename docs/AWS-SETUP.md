# Optional AWS setup

Use the college AWS account only if its rules allow this hackathon usage. Never paste access keys into chat, commit them, or put them in browser JavaScript.

1. Authenticate locally through your normal AWS CLI/SSO profile. If you use SSO, refresh it with `aws sso login --profile your-profile`.
2. Choose an accessible Bedrock model in your AWS region. Model access and available regions vary by account. Use the exact model ID or inference-profile ID from your own account; no model is assumed to be enabled.
3. Set these variables in the terminal where you start Doorstep:

```powershell
$env:AWS_PROFILE='your-profile'
$env:AWS_REGION='your-region'
$env:BEDROCK_MODEL_ID='your-accessible-model-or-inference-profile'
npm start
```

If your authentication does not use named profiles, follow your account's normal AWS SDK credential chain. `.env.example` documents names only; the application does not automatically load `.env` files.

4. In Connection details, press **Request optional Bedrock summary**.
5. Confirm the response identifies Amazon Bedrock. Save a redacted screenshot and the time/region/model of the successful request. Verify the actual usage in AWS. Never fabricate a request ID or usage record.

The SDK sends a Converse request with a 180-token output cap, two maximum attempts and a 15-second deadline. Each button press may incur usage charges; it creates no persistent AWS infrastructure. Only aggregate arrival kind/status and quiet-mode data are sent. It does not send private notes, resident names or handoff instructions. Access requires the Bedrock inference permissions applicable to the selected model/inference profile, typically `bedrock:InvokeModel`; your administrator controls the exact policy.

The summary cannot invoke a tool, change a handoff or unlock anything. Without configuration the app returns a clear unavailable response. Keep the core demo local if credentials, permissions or model availability fail.

The integration remains unverified until a real request succeeds. A single summary call is a limited AWS integration; describe it plainly rather than claiming a multi-service agent pipeline. Entering the mini challenge should reflect the actual demonstrated integration.

Reference: [Amazon Bedrock documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-call.html).
