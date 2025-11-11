# 🔐 Guide d'authentification OAuth2 — Google Apps Script

This project uses the OAuth2 module for Google Apps Script to authorize access to certain Google APIs (e.g., Google Forms, Google Drive, etc.) using an OAuth 2.0 client created in Google Cloud Platform (GCP).

This guide explains step-by-step how to configure, execute, and validate the authorization procedure.

## 📋 Prerequisites

Before executing the `getAuthorizationUrl()` function, you must have:

- A Google Apps Script project (linked or not to a Google Sheet)
- The OAuth2 module installed:
  - In Apps Script, go to Services → Libraries
  - Click + Add a library
  - Paste the following ID: `1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF`
  - Name: OAuth2
  - Version: the most recent available
- An active OAuth 2.0 client in Google Cloud Console (not deleted)
- Your script linked to the correct Cloud project

## ⚙️ Step 1 — Create an OAuth Client in Google Cloud

1. Open the console: <https://console.cloud.google.com/apis/credentials>
2. Select your GCP project (the one linked to your Apps Script)
3. Click Create credentials → OAuth 2.0 Client ID
4. Application type: Web application
5. Give it a name, for example "Apps Script OAuth"
6. In Authorized redirect URIs, add the following URL (replace `{SCRIPT_ID}` with your actual script ID):

   ```txt
   https://script.google.com/macros/d/{SCRIPT_ID}/usercallback
   ```

### 🚀 Deploy Google Project

Go to:

   1. Google Auth Platform
   2. Audience
   3. Publish

### 🔍 To find your SCRIPT_ID

- Menu File → Project properties → Script ID

1. Click Create
2. Copy the Client ID and Client Secret values

## ⚙️ Step 2 — Register the Credentials in Apps Script

1. In your Apps Script project, open the menu: File → Project properties → Script properties
2. Add the following keys:

| Key           | Value              |
| ------------- | ------------------ |
| CLIENT_ID     | your client_id     |
| CLIENT_SECRET | your client_secret |

## ⚙️ Step 3 — Deploy your Script as a Web App

1. Menu: Deploy → Deploy as web app
2. Settings:
   - Run the application as → Me (your account)
   - Who has access to the application → Everyone or Everyone, even anonymous
3. Click Deploy
4. Copy the deployment URL (it will be used to verify the redirect)

## 🚀 Step 4 — Get the Authorization URL

1. Run the following function in the Apps Script editor:

   ```javascript
   getAuthorizationUrl();
   ```

2. Open the console (logs):
   - Menu View → Logs

3. Copy the displayed link:

   ```txt
   Open this URL to authorize: https://accounts.google.com/o/oauth2/v2/auth?...
   ```

4. Open this link in your browser
5. Choose your Google account → click Continue → grant the requested permissions

## 🔁 Step 5 — Callback and Validation

After granting permissions:

1. Google will redirect you to your script via the function:

   ```javascript
   function authCallback(request) { ... }
   ```

2. If everything is correct, you will see this message:

   ```txt
   ✅ Authorization successful! You can close this window.
   ```

3. The OAuth tokens will be automatically stored in UserProperties

## 🔧 Step 6 — Use the Tokens

You can now get a valid token with:

```javascript
const token = getOAuth2AccessToken();
```

This token can be used to call Google APIs (Forms, Drive, etc.) via `UrlFetchApp.fetch`.

## 🧹 Step 7 — Reset Authorizations (if needed)

In case of problems (OAuth client modification, scopes, or script), run:

```javascript
clearOAuthTokens();
```

Then restart `getAuthorizationUrl()` to redo the full authorization.

## 💡 Tips and Troubleshooting

| Problem                                    | Likely Cause                                       | Solution                                         |
| ------------------------------------------ | -------------------------------------------------- | ------------------------------------------------ |
| `redirect_uri_mismatch`                    | The /usercallback URI is not added in Google Cloud | Add it in "Authorized redirect URIs"             |
| 404 page after authorization               | OAuth client deleted or Cloud project not linked   | Recreate an OAuth client and update the keys     |
| "Authorization required" at each execution | Tokens not stored or missing property              | Check `PropertiesService.getUserProperties()`    |
| `service.hasAccess()` returns false        | Not yet authorized                                 | Run `getAuthorizationUrl()` and authorize access |

## 🧭 Example Scopes Configuration

```javascript
const CONFIG = {
  OAUTH_CONFIG: {
    SCOPES: [
      'https://www.googleapis.com/auth/forms',
      'https://www.googleapis.com/auth/drive'
    ]
  }
};
```

## ✅ Example Complete Flow (Summary)

1. Create an OAuth client → Add redirect_uri
2. Copy CLIENT_ID / CLIENT_SECRET in Apps Script
3. Deploy the script as a Web App
4. Run `getAuthorizationUrl()`
5. Open the generated URL and authorize
6. Verify the "✅ Authorization successful!" message
7. Use `getOAuth2AccessToken()` to call APIs
