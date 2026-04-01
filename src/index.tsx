import {
  ButtonItem,
  Navigation,
  PanelSection,
  PanelSectionRow,
  staticClasses,
} from "@decky/ui";
import { callable, definePlugin, routerHook, toaster } from "@decky/api";
import { useEffect, useMemo, useState } from "react";
import { FaCloud } from "react-icons/fa";

import XCloudApiClient, { ConsoleInfo } from "./xcloud/apiclient";
import GamepadInput from "./xcloud/gamepad";
import XCloudPlayer from "./xcloud/player";
import StreamSession from "./xcloud/stream";

type PluginConfig = {
  xhome_host: string;
  xhome_token: string;
  xcloud_host: string;
  xcloud_token: string;
  msal_token: string;
  stream_type: "home" | "cloud";
  stream_target: string;
  preferred_locale: string;
  force_1080p: boolean;
  enable_vibration: boolean;
  video_bitrate: number;
  audio_bitrate: number;
};

type AuthStatus = {
  logged_in: boolean;
  expires_at: number | null;
  has_xhome: boolean;
  has_xcloud: boolean;
  pending_device_code: boolean;
};

type DeviceCodeResponse = {
  user_code: string;
  device_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message: string;
};

const getConfig = callable<[], PluginConfig>("get_config");
const saveConfig = callable<[config: PluginConfig], PluginConfig>("save_config");
const getAuthHelp = callable<[], { message: string; xhome_hint: string; xcloud_hint: string }>("get_auth_help");
const getAuthStatus = callable<[], AuthStatus>("auth_status");
const startAuth = callable<[], DeviceCodeResponse>("start_auth");
const pollAuth = callable<[], { status: string; message?: string; config?: PluginConfig }>("poll_auth");
const refreshAuth = callable<[], { status: string; config: PluginConfig }>("refresh_auth");
const logoutAuth = callable<[], { ok: boolean }>("logout");

const STREAM_ROUTE = "/xcloud-deck/stream";

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 8,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
};

function ConfigField(props: {
  label: string;
  value: string | number;
  type?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>{props.label}</div>
      <input
        style={inputStyle}
        type={props.type ?? "text"}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </div>
  );
}

function buildClient(config: PluginConfig, type: "home" | "cloud") {
  const host = type === "home" ? config.xhome_host : config.xcloud_host;
  const token = type === "home" ? config.xhome_token : config.xcloud_token;
  return new XCloudApiClient({
    host,
    token,
    locale: config.preferred_locale,
    force1080p: config.force_1080p,
  });
}

function Content() {
  const [config, setConfig] = useState<PluginConfig | null>(null);
  const [authHelp, setAuthHelp] = useState<string>("");
  const [consoles, setConsoles] = useState<ConsoleInfo[]>([]);
  const [loadingConsoles, setLoadingConsoles] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null);

  async function loadState() {
    const [loadedConfig, help, status] = await Promise.all([getConfig(), getAuthHelp(), getAuthStatus()]);
    setConfig(loadedConfig);
    setAuthHelp(`${help.message} ${help.xhome_hint} ${help.xcloud_hint}`);
    setAuthStatus(status);
  }

  useEffect(() => {
    void loadState();
  }, []);

  const canDiscoverConsoles = useMemo(
    () => Boolean(config?.xhome_host && config?.xhome_token),
    [config]
  );

  async function persist() {
    if (!config) {
      return;
    }
    const saved = await saveConfig(config);
    setConfig(saved);
    toaster.toast({ title: "xCloud Deck", body: "Configuration saved" });
  }

  async function beginAuth() {
    try {
      const response = await startAuth();
      setDeviceCode(response);
      setAuthStatus(await getAuthStatus());
      toaster.toast({ title: "Xbox login started", body: `Code: ${response.user_code}` });
    } catch (error) {
      toaster.toast({ title: "Auth failed", body: String(error) });
    }
  }

  async function checkAuth() {
    try {
      const response = await pollAuth();
      if (response.status === "complete" && response.config) {
        setConfig(response.config);
        setDeviceCode(null);
        toaster.toast({ title: "Xbox login complete", body: "Streaming tokens refreshed" });
      } else {
        toaster.toast({ title: `Auth: ${response.status}`, body: response.message ?? "Waiting for approval" });
      }
      setAuthStatus(await getAuthStatus());
    } catch (error) {
      toaster.toast({ title: "Auth polling failed", body: String(error) });
    }
  }

  async function refreshTokens() {
    try {
      const response = await refreshAuth();
      setConfig(response.config);
      setAuthStatus(await getAuthStatus());
      toaster.toast({ title: "Xbox tokens refreshed", body: "Hosts and tokens updated" });
    } catch (error) {
      toaster.toast({ title: "Refresh failed", body: String(error) });
    }
  }

  async function logout() {
    await logoutAuth();
    setDeviceCode(null);
    await loadState();
    toaster.toast({ title: "Logged out", body: "Stored auth cleared" });
  }

  async function discoverConsoles() {
    if (!config) {
      return;
    }
    setLoadingConsoles(true);
    try {
      const client = buildClient(config, "home");
      const response = await client.getConsoles();
      setConsoles(response.results ?? []);
    } catch (error) {
      toaster.toast({ title: "Console discovery failed", body: String(error) });
    } finally {
      setLoadingConsoles(false);
    }
  }

  if (!config) {
    return <PanelSection title="xCloud Deck"><PanelSectionRow>Loading…</PanelSectionRow></PanelSection>;
  }

  return (
    <PanelSection title="xCloud Deck MVP">
      <PanelSectionRow>
        <div style={{ fontSize: 12, opacity: 0.8 }}>{authHelp}</div>
      </PanelSectionRow>
      <PanelSectionRow>
        <div style={{ width: "100%", fontSize: 12, opacity: 0.85 }}>
          Auth: {authStatus?.logged_in ? "Logged in" : "Logged out"} · xHome {authStatus?.has_xhome ? "ready" : "missing"} · xCloud {authStatus?.has_xcloud ? "ready" : "missing"}
        </div>
      </PanelSectionRow>
      {deviceCode && (
        <PanelSectionRow>
          <div style={{ width: "100%", fontSize: 12, lineHeight: 1.5 }}>
            <div><strong>Code:</strong> {deviceCode.user_code}</div>
            <div><strong>Visit:</strong> {deviceCode.verification_uri}</div>
          </div>
        </PanelSectionRow>
      )}
      <PanelSectionRow>
        <div style={{ display: "grid", gap: 8, width: "100%", gridTemplateColumns: "1fr 1fr" }}>
          <button style={inputStyle} onClick={() => void beginAuth()}>Start Xbox login</button>
          <button style={inputStyle} onClick={() => void checkAuth()}>Check login</button>
        </div>
      </PanelSectionRow>
      <PanelSectionRow>
        <div style={{ display: "grid", gap: 8, width: "100%", gridTemplateColumns: "1fr 1fr" }}>
          <button style={inputStyle} onClick={() => void refreshTokens()}>Refresh tokens</button>
          <button style={inputStyle} onClick={() => void logout()}>Logout</button>
        </div>
      </PanelSectionRow>
      <PanelSectionRow>
        <ConfigField label="xHome host" value={config.xhome_host} placeholder="https://*.xboxlive.com" onChange={(value) => setConfig({ ...config, xhome_host: value })} />
      </PanelSectionRow>
      <PanelSectionRow>
        <ConfigField label="xHome token" value={config.xhome_token} onChange={(value) => setConfig({ ...config, xhome_token: value })} />
      </PanelSectionRow>
      <PanelSectionRow>
        <ConfigField label="xCloud host" value={config.xcloud_host} placeholder="https://*.xboxlive.com" onChange={(value) => setConfig({ ...config, xcloud_host: value })} />
      </PanelSectionRow>
      <PanelSectionRow>
        <ConfigField label="xCloud token" value={config.xcloud_token} onChange={(value) => setConfig({ ...config, xcloud_token: value })} />
      </PanelSectionRow>
      <PanelSectionRow>
        <ConfigField label="MSAL user token (needed for some home sessions)" value={config.msal_token} onChange={(value) => setConfig({ ...config, msal_token: value })} />
      </PanelSectionRow>
      <PanelSectionRow>
        <div style={{ display: "grid", gap: 8, width: "100%", gridTemplateColumns: "1fr 1fr" }}>
          <button style={inputStyle} onClick={() => setConfig({ ...config, stream_type: "home" })}>Type: {config.stream_type === "home" ? "Home" : "Set Home"}</button>
          <button style={inputStyle} onClick={() => setConfig({ ...config, stream_type: "cloud" })}>Type: {config.stream_type === "cloud" ? "Cloud" : "Set Cloud"}</button>
        </div>
      </PanelSectionRow>
      <PanelSectionRow>
        <ConfigField label="Target server/title ID" value={config.stream_target} placeholder="Console serverId or xCloud titleId" onChange={(value) => setConfig({ ...config, stream_target: value })} />
      </PanelSectionRow>
      <PanelSectionRow>
        <div style={{ display: "grid", gap: 8, width: "100%", gridTemplateColumns: "1fr 1fr" }}>
          <ConfigField label="Locale" value={config.preferred_locale} onChange={(value) => setConfig({ ...config, preferred_locale: value })} />
          <ConfigField label="Video bitrate kbps" type="number" value={config.video_bitrate} onChange={(value) => setConfig({ ...config, video_bitrate: Number(value) || 0 })} />
        </div>
      </PanelSectionRow>
      <PanelSectionRow>
        <div style={{ display: "grid", gap: 8, width: "100%", gridTemplateColumns: "1fr 1fr" }}>
          <button style={inputStyle} onClick={() => setConfig({ ...config, force_1080p: !config.force_1080p })}>1080p spoof: {config.force_1080p ? "On" : "Off"}</button>
          <button style={inputStyle} onClick={() => setConfig({ ...config, enable_vibration: !config.enable_vibration })}>Rumble: {config.enable_vibration ? "On" : "Off"}</button>
        </div>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={() => void persist()}>Save configuration</ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={!canDiscoverConsoles || loadingConsoles} onClick={() => void discoverConsoles()}>
          {loadingConsoles ? "Discovering consoles..." : "Discover home consoles"}
        </ButtonItem>
      </PanelSectionRow>
      {consoles.map((consoleInfo) => (
        <PanelSectionRow key={consoleInfo.serverId}>
          <button
            style={{ ...inputStyle, textAlign: "left" }}
            onClick={() => setConfig({ ...config, stream_type: "home", stream_target: consoleInfo.serverId })}
          >
            <div>{consoleInfo.deviceName}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>{consoleInfo.consoleType} · {consoleInfo.powerState} · {consoleInfo.serverId}</div>
          </button>
        </PanelSectionRow>
      ))}
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          disabled={!config.stream_target}
          onClick={async () => {
            await persist();
            Navigation.Navigate(STREAM_ROUTE);
            Navigation.CloseSideMenus();
          }}
        >
          Open stream view
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
}

function StreamRoute() {
  const [status, setStatus] = useState("Loading configuration...");
  const [config, setConfig] = useState<PluginConfig | null>(null);
  const [sessionPath, setSessionPath] = useState("");
  const [statsText, setStatsText] = useState("Waiting for stream stats...");

  useEffect(() => {
    let player: XCloudPlayer | undefined;
    let gamepad: GamepadInput | undefined;
    let session: StreamSession | undefined;
    let keepaliveInterval: number | undefined;
    let statsInterval: number | undefined;
    let disposed = false;

    async function start() {
      const loadedConfig = await getConfig();
      if (disposed) return;
      setConfig(loadedConfig);
      const client = buildClient(loadedConfig, loadedConfig.stream_type);
      setStatus(`Starting ${loadedConfig.stream_type} stream for ${loadedConfig.stream_target}...`);

      const response = await client.startStream(loadedConfig.stream_type, loadedConfig.stream_target);
      session = new StreamSession(client, response);
      setSessionPath(session.getSessionPath());

      while (!disposed) {
        const state = await session.refreshState();
        setStatus(`Session state: ${state}`);
        if (state === "Provisioned") {
          break;
        }
        if (state === "ReadyToConnect" && loadedConfig.msal_token) {
          await session.sendMsalAuth(loadedConfig.msal_token).catch(() => undefined);
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (disposed) return;

      player = new XCloudPlayer("xcloud-stream-holder", {
        videoBitrate: loadedConfig.video_bitrate,
        audioBitrate: loadedConfig.audio_bitrate,
      });
      gamepad = new GamepadInput(0, { enableVibration: loadedConfig.enable_vibration });
      gamepad.attach(player);
      player.onConnectionStateChange((state) => setStatus(`Peer connection: ${state}`));
      player.setChatSdpHandler((offer) => {
        if (!session) return;
        void session.sendChatSdpOffer(offer).then((sdpResponse) => {
          const parsed = JSON.parse(sdpResponse.exchangeResponse) as { sdp: string };
          return player?.setRemoteOffer(parsed.sdp);
        }).catch(() => undefined);
      });

      const offer = await player.createOffer();
      const sdpResponse = await session.sendSdpOffer(offer);
      const parsedSdp = JSON.parse(sdpResponse.exchangeResponse) as { sdp: string };
      await player.setRemoteOffer(parsedSdp.sdp);

      const candidates = player.getIceCandidates().map((candidate) => JSON.stringify({
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        usernameFragment: candidate.usernameFragment,
      }));
      const iceResponse = await session.sendIceCandidates(candidates);
      const parsedIce = JSON.parse(iceResponse.exchangeResponse) as RTCIceCandidateInit[];
      player.setRemoteIceCandidates(parsedIce);

      keepaliveInterval = window.setInterval(() => {
        void session?.sendKeepalive().catch(() => undefined);
      }, 30000);
      statsInterval = window.setInterval(() => {
        const snapshot = player?.getStats().getSnapshot();
        if (!snapshot) return;
        setStatsText(`${snapshot.videoCodec || "Video"} ${snapshot.videoWidth}x${snapshot.videoHeight} @ ${snapshot.videoFps || 0}fps · RTT ${(snapshot.rtt * 1000).toFixed(0)}ms`);
      }, 1000);
    }

    void start().catch((error) => {
      setStatus(`Stream failed: ${String(error)}`);
    });

    return () => {
      disposed = true;
      if (keepaliveInterval) window.clearInterval(keepaliveInterval);
      if (statsInterval) window.clearInterval(statsInterval);
      void session?.stop().catch(() => undefined);
      gamepad?.detach();
      player?.destroy();
    };
  }, []);

  return (
    <div style={{ padding: 16, height: "100%", display: "flex", flexDirection: "column", gap: 12, background: "black", color: "white" }}>
      <div className={staticClasses.Title}>xCloud Deck Stream</div>
      <div style={{ opacity: 0.8 }}>{status}</div>
      <div style={{ opacity: 0.6, fontSize: 12 }}>{sessionPath}</div>
      <div style={{ opacity: 0.85, fontSize: 12 }}>{statsText}</div>
      <div id="xcloud-stream-holder" style={{ flex: 1, background: "#111", borderRadius: 12, overflow: "hidden" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button style={inputStyle} onClick={() => Navigation.Navigate("/")}>Back</button>
        <button style={inputStyle} onClick={() => toaster.toast({ title: "xCloud Deck", body: config?.stream_target ?? "No target" })}>Info</button>
      </div>
    </div>
  );
}

export default definePlugin(() => {
  routerHook.addRoute(STREAM_ROUTE, StreamRoute, { exact: true });

  return {
    name: "xCloud Deck",
    titleView: <div className={staticClasses.Title}>xCloud Deck</div>,
    content: <Content />,
    icon: <FaCloud />,
    onDismount() {
      routerHook.removeRoute(STREAM_ROUTE);
    },
  };
});
