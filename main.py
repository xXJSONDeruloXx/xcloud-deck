import json
import os
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

import certifi
import decky


MSAL_CLIENT_ID = "1f907974-e22b-4810-a9de-d9647380c97e"
DEVICE_CODE_SCOPE = "xboxlive.signin openid profile offline_access"
TRANSFER_TOKEN_SCOPE = "service::http://Passport.NET/purpose::PURPOSE_XBOX_CLOUD_CONSOLE_TRANSFER_TOKEN"


class Plugin:
    def __init__(self):
        self.config_path = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "config.json")
        self.auth_path = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "auth.json")
        self.default_config = {
            "xhome_host": "",
            "xhome_token": "",
            "xcloud_host": "",
            "xcloud_token": "",
            "msal_token": "",
            "stream_type": "home",
            "stream_target": "",
            "preferred_locale": "en-US",
            "force_1080p": True,
            "enable_vibration": True,
            "video_bitrate": 0,
            "audio_bitrate": 0,
        }
        self.ssl_context = ssl.create_default_context(cafile=certifi.where())

    def _read_json(self, path: str, default: dict[str, Any]) -> dict[str, Any]:
        try:
            with open(path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                return {**default, **loaded}
        except FileNotFoundError:
            return dict(default)
        except Exception as exc:
            decky.logger.error(f"Failed to read {path}: {exc}")
            return dict(default)

    def _write_json(self, path: str, payload: dict[str, Any]) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

    def _read_config(self) -> dict[str, Any]:
        return self._read_json(self.config_path, self.default_config)

    def _write_config(self, config: dict[str, Any]) -> None:
        self._write_json(self.config_path, config)

    def _read_auth(self) -> dict[str, Any]:
        return self._read_json(self.auth_path, {"user_token": None, "device_code": None})

    def _write_auth(self, auth: dict[str, Any]) -> None:
        self._write_json(self.auth_path, auth)

    def _http_request(
        self,
        url: str,
        method: str = "GET",
        headers: dict[str, str] | None = None,
        data: str | bytes | None = None,
    ) -> Any:
        if isinstance(data, str):
            data = data.encode("utf-8")
        req = urllib.request.Request(url, data=data, method=method)
        for key, value in (headers or {}).items():
            req.add_header(key, value)
        try:
            decky.logger.info(f"HTTP {method} {url}")
            with urllib.request.urlopen(req, context=self.ssl_context) as response:
                body = response.read().decode("utf-8")
                if not body:
                    return {}
                return json.loads(body)
        except urllib.error.HTTPError as exc:
            decky.logger.error(f"HTTP error on {method} {url}: {exc.code}")
            body = exc.read().decode("utf-8") if exc.fp else ""
            try:
                payload = json.loads(body) if body else {}
            except Exception:
                payload = {"raw": body}
            decky.logger.error(f"HTTP error body for {method} {url}: {payload}")
            raise RuntimeError(json.dumps({"status": exc.code, "body": payload})) from exc
        except urllib.error.URLError as exc:
            decky.logger.error(f"URL error on {method} {url}: {exc}")
            raise

    def _form_request(self, url: str, payload: dict[str, Any]) -> Any:
        return self._http_request(
            url,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data=urllib.parse.urlencode(payload),
        )

    def _json_request(self, url: str, payload: dict[str, Any], headers: dict[str, str] | None = None) -> Any:
        merged_headers = {
            "Content-Type": "application/json",
            **(headers or {}),
        }
        return self._http_request(url, method="POST", headers=merged_headers, data=json.dumps(payload))

    def _refresh_user_token(self, refresh_token: str) -> dict[str, Any]:
        return self._form_request(
            "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
            {
                "client_id": MSAL_CLIENT_ID,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "scope": DEVICE_CODE_SCOPE,
            },
        )

    def _get_valid_user_token(self) -> dict[str, Any]:
        auth = self._read_auth()
        user_token = auth.get("user_token")
        if not user_token:
            raise RuntimeError("No user token found. Please authenticate first.")

        expires_at = user_token.get("expires_at", 0)
        if time.time() < expires_at - 60:
            return user_token

        refreshed = self._refresh_user_token(user_token["refresh_token"])
        refreshed["expires_at"] = time.time() + int(refreshed.get("expires_in", 0))
        auth["user_token"] = refreshed
        self._write_auth(auth)
        return refreshed

    def _xsts_authenticate(self, access_token: str) -> dict[str, Any]:
        return self._json_request(
            "https://user.auth.xboxlive.com/user/authenticate",
            {
                "Properties": {
                    "AuthMethod": "RPS",
                    "RpsTicket": f"d={access_token}",
                    "SiteName": "user.auth.xboxlive.com",
                },
                "RelyingParty": "http://auth.xboxlive.com",
                "TokenType": "JWT",
            },
            {
                "x-xbl-contract-version": "1",
                "Cache-Control": "no-cache",
                "Origin": "https://www.xbox.com",
                "Referer": "https://www.xbox.com/",
            },
        )

    def _xsts_authorize(self, xsts_user_token: str, relying_party: str) -> dict[str, Any]:
        return self._json_request(
            "https://xsts.auth.xboxlive.com/xsts/authorize",
            {
                "Properties": {
                    "SandboxId": "RETAIL",
                    "UserTokens": [xsts_user_token],
                },
                "RelyingParty": relying_party,
                "TokenType": "JWT",
            },
            {
                "x-xbl-contract-version": "1",
                "Cache-Control": "no-cache",
                "Origin": "https://www.xbox.com",
                "Referer": "https://www.xbox.com/",
                "Accept": "*/*",
                "ms-cv": "0",
                "User-Agent": "Mozilla/5.0",
            },
        )

    def _get_streaming_token(self, gssv_token: str, offering: str) -> dict[str, Any]:
        return self._json_request(
            f"https://{offering}.gssv-play-prod.xboxlive.com/v2/login/user",
            {
                "token": gssv_token,
                "offeringId": offering,
            },
            {
                "Cache-Control": "no-store, must-revalidate, no-cache",
                "x-gssv-client": "XboxComBrowser",
            },
        )

    def _get_transfer_token(self, refresh_token: str) -> dict[str, Any]:
        return self._form_request(
            "https://login.live.com/oauth20_token.srf",
            {
                "client_id": MSAL_CLIENT_ID,
                "scope": TRANSFER_TOKEN_SCOPE,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
        )

    def _update_streaming_config(self) -> dict[str, Any]:
        user_token = self._get_valid_user_token()
        auth_response = self._xsts_authenticate(user_token["access_token"])
        gssv_response = self._xsts_authorize(auth_response["Token"], "http://gssv.xboxlive.com/")
        xhome = self._get_streaming_token(gssv_response["Token"], "xhome")

        xcloud = None
        try:
            xcloud = self._get_streaming_token(gssv_response["Token"], "xgpuweb")
        except Exception:
            try:
                xcloud = self._get_streaming_token(gssv_response["Token"], "xgpuwebf2p")
            except Exception:
                xcloud = None

        transfer = self._get_transfer_token(user_token["refresh_token"])
        config = self._read_config()
        config["xhome_host"] = xhome["offeringSettings"]["regions"][0]["baseUri"]
        config["xhome_token"] = xhome["gsToken"]
        config["xcloud_host"] = xcloud["offeringSettings"]["regions"][0]["baseUri"] if xcloud else ""
        config["xcloud_token"] = xcloud["gsToken"] if xcloud else ""
        config["msal_token"] = transfer.get("access_token", "")
        self._write_config(config)
        return config

    async def get_config(self) -> dict[str, Any]:
        return self._read_config()

    async def save_config(self, config: dict[str, Any]) -> dict[str, Any]:
        merged = {**self.default_config, **config}
        self._write_config(merged)
        return merged

    async def get_auth_help(self) -> dict[str, str]:
        return {
            "message": "Use Xbox device-code login to fetch streaming tokens, then launch from the plugin.",
            "xhome_hint": "xHome tokens and host are filled automatically after successful auth.",
            "xcloud_hint": "xCloud token is also fetched when available on the account.",
        }

    async def auth_status(self) -> dict[str, Any]:
        auth = self._read_auth()
        user_token = auth.get("user_token")
        config = self._read_config()
        return {
            "logged_in": user_token is not None,
            "expires_at": user_token.get("expires_at") if user_token else None,
            "has_xhome": bool(config.get("xhome_token") and config.get("xhome_host")),
            "has_xcloud": bool(config.get("xcloud_token") and config.get("xcloud_host")),
            "pending_device_code": bool(auth.get("device_code")),
        }

    async def start_auth(self) -> dict[str, Any]:
        decky.logger.info("Starting device-code auth")
        response = self._form_request(
            "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode",
            {
                "client_id": MSAL_CLIENT_ID,
                "scope": DEVICE_CODE_SCOPE,
            },
        )
        auth = self._read_auth()
        auth["device_code"] = response
        self._write_auth(auth)
        return response

    async def poll_auth(self) -> dict[str, Any]:
        decky.logger.info("Polling device-code auth")
        auth = self._read_auth()
        device_code = auth.get("device_code")
        if not device_code:
            return {"status": "missing", "message": "No device-code auth is in progress."}

        try:
            token = self._form_request(
                "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
                {
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                    "client_id": MSAL_CLIENT_ID,
                    "device_code": device_code["device_code"],
                },
            )
        except RuntimeError as exc:
            raw = str(exc)
            try:
                payload = json.loads(raw)
                body = payload.get("body", {})
                error_code = body.get("error")
                if error_code in ("authorization_pending", "slow_down"):
                    return {"status": "pending", "message": body.get("error_description", error_code)}
                return {"status": "error", "message": body.get("error_description", raw)}
            except Exception:
                return {"status": "error", "message": raw}

        token["expires_at"] = time.time() + int(token.get("expires_in", 0))
        auth["user_token"] = token
        auth["device_code"] = None
        self._write_auth(auth)

        config = self._update_streaming_config()
        return {"status": "complete", "config": config}

    async def refresh_auth(self) -> dict[str, Any]:
        decky.logger.info("Refreshing Xbox auth and streaming tokens")
        config = self._update_streaming_config()
        return {"status": "complete", "config": config}

    async def logout(self) -> dict[str, bool]:
        self._write_auth({"user_token": None, "device_code": None})
        config = self._read_config()
        config["xhome_token"] = ""
        config["xcloud_token"] = ""
        config["msal_token"] = ""
        self._write_config(config)
        return {"ok": True}

    async def _main(self):
        decky.logger.info("xcloud-deck backend started")

    async def _unload(self):
        decky.logger.info("xcloud-deck backend stopping")

    async def _uninstall(self):
        decky.logger.info("xcloud-deck backend uninstall")

    async def _migration(self):
        decky.logger.info("xcloud-deck migration check")
