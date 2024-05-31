
// @ts-check

/** @type {import('crx-monkey').CrxMonkeyManifest} */
const manifest = {
  "name": "Flow Comment for YouTube VIDEO",
  "version": "1.0.0",
  "manifest_version": 3,
  "description": "Flow comments on YouTube videos",
    "content_scripts": [
    {
      "matches": [
        "https://www.youtube.com/*"
      ],
      "js": [
        "src/contentScripts/contentScript.ts"
      ],
      "world": "MAIN"
    }
  ],
  "background": {
    "service_worker": "src/sw/sw.ts"
  },
  "run_at": "document_end"
};

export default manifest;
