# Vertex AI Veo Integration Notes

Last updated: June 6, 2026

These notes come from the working Versaunt code path for Google Vertex AI Veo 3.1 video generation. Use this as implementation context before wiring video generation.

## Key Rule

Do not call Veo models like Gemini chat/image models.

Veo uses Vertex AI long-running prediction REST endpoints:

- Start: `predictLongRunning`
- Poll: `fetchPredictOperation`

Do not use `generateContent` for Veo.

## Environment And Auth

Required:

- `GOOGLE_CLOUD_PROJECT_ID`, for example `ecolyfe`
- Google service-account credentials

Optional:

- `GOOGLE_CLOUD_LOCATION`, default `us-central1`

Credentials can be provided as either:

- `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json`
- `GOOGLE_CREDENTIALS_JSON`, containing the service-account JSON, sometimes base64 encoded

Use `google-auth-library` with scope:

```txt
https://www.googleapis.com/auth/cloud-platform
```

The project ID is always used in the Vertex URL. Credentials authenticate the request; they do not replace `projectId`.

## Model IDs

All three use the same long-running endpoint shape. Only the model ID changes.

- Quality: `veo-3.1-generate-001`
- Fast: `veo-3.1-fast-generate-001`
- Lite: `veo-3.1-lite-generate-001`

## Start Endpoint

```txt
POST https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{MODEL_ID}:predictLongRunning
```

Headers:

```txt
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json
```

## Text-To-Video Body

```json
{
  "instances": [
    {
      "prompt": "Your video prompt here"
    }
  ],
  "parameters": {
    "aspectRatio": "16:9",
    "durationSeconds": 8,
    "generateAudio": true,
    "resolution": "1080p",
    "seed": 12345
  }
}
```

Allowed parameters in the working code:

- `aspectRatio`: `"16:9"` or `"9:16"`
- `durationSeconds`: `4`, `6`, or `8`
- `resolution`: `"720p"` or `"1080p"`
- `generateAudio`: boolean
- `seed`: optional uint32

## Reference Image Body

```json
{
  "instances": [
    {
      "prompt": "Your video prompt here",
      "referenceImages": [
        {
          "image": {
            "bytesBase64Encoded": "...base64 image bytes...",
            "mimeType": "image/png"
          },
          "referenceType": "asset",
          "role": "asset",
          "name": "product reference"
        }
      ]
    }
  ],
  "parameters": {
    "aspectRatio": "16:9",
    "durationSeconds": 8,
    "generateAudio": true,
    "resolution": "1080p"
  }
}
```

Important reference-image behavior:

- Reference images force the regular/quality model, not fast: `veo-3.1-generate-001`.
- Limit reference images to 3.
- Fetch remote reference images yourself.
- Convert reference images to base64 and include `mimeType`.
- Do not pass arbitrary public URLs as reference images unless you first fetch and encode them.

## Multiple Videos

The working code starts one operation per requested video.

Loop `count` times and post the same request repeatedly. Do not rely on a batch/count parameter unless current docs explicitly support it.

## Start Response

The start call returns an operation object with `name`.

Save that exact operation name.

## Poll Endpoint

```txt
POST https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{MODEL_ID}:fetchPredictOperation
```

Poll body:

```json
{
  "operationName": "{the operation name returned by predictLongRunning}"
}
```

Critical polling rule:

Poll with the same `MODEL_ID` used to start the operation. If you started with `veo-3.1-generate-001` or `veo-3.1-lite-generate-001`, do not poll with the fast model ID by default.

## Poll Response

If the response contains:

```json
{ "done": false }
```

keep polling.

If `done` is true and `error` exists, generation failed.

If `done` is true and `response.videos` exists, the video may be in:

- `video.gcsUri`
- `video.bytesBase64Encoded`
- `video.videoUri`
- `video.uri`

Handle all of these output shapes.

## Downloading `gcsUri`

If `gcsUri` is returned:

1. Parse `gs://bucket/object`.
2. Download with:

```txt
GET https://storage.googleapis.com/storage/v1/b/{bucket}/o/{encodeURIComponent(object)}?alt=media
Authorization: Bearer {ACCESS_TOKEN}
```

## Common Mistakes To Avoid

- Do not use `generateContent` for Veo.
- Do not use the Gemini API endpoint for these Vertex model IDs.
- Do not omit `projectId` from the Vertex URL.
- Do not poll a regular/lite operation using the fast model ID.
- Do not assume the video is always base64; handle `gcsUri`, base64, and URI fields.
