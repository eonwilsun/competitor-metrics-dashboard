# Fixing Instagram auth in GitHub Actions

If the workflow fails with `INSTAGRAM_AUTH_ERROR`, Instagram is blocking GitHub Actions.

## Fix (Chrome)
1. Log into Instagram in Chrome.
2. DevTools → Application → Cookies → https://www.instagram.com
3. Copy cookie values for:
   - sessionid
   - csrftoken (optional)
   - ds_user_id (optional)
   - mid (optional)

## Add GitHub Secret
Repo → Settings → Secrets and variables → Actions → New repository secret

Name: IG_SESSION_JSON

Value example:
```json
{
  "cookies": [
    { "name": "sessionid", "value": "PASTE", "domain": ".instagram.com", "path": "/", "httpOnly": true, "secure": true }
  ]
}
```

Re-run the workflow.