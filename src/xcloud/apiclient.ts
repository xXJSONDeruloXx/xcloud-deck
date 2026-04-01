export interface XCloudApiClientConfig {
  locale?: string;
  token?: string;
  host?: string;
  force1080p?: boolean;
}

interface XCloudApiClientConfigRequired extends Required<XCloudApiClientConfig> {}

export interface StartStreamResponse {
  sessionId: string;
  sessionPath: string;
  state: string;
}

export interface ConsoleInfo {
  deviceName: string;
  serverId: string;
  powerState: string;
  consoleType: string;
  playPath: string;
  outOfHomeWarning: boolean;
  wirelessWarning: boolean;
  isDevKit: boolean;
}

export interface ConsolesResponse {
  totalItems: number;
  results: ConsoleInfo[];
  continuationToken: string | null;
}

export default class XCloudApiClient {
  private config: XCloudApiClientConfigRequired = {
    locale: "en-US",
    token: "",
    host: "",
    force1080p: true,
  };

  constructor(config: XCloudApiClientConfig = {}) {
    this.config = { ...this.config, ...config };
  }

  getConfig() {
    return this.config;
  }

  getBaseHost() {
    return this.config.host;
  }

  getConsoles() {
    return this.get("/v6/servers/home") as Promise<ConsolesResponse>;
  }

  startStream(type: "home" | "cloud", target: string) {
    return this.post(`/v5/sessions/${type}/play`, JSON.stringify({
      clientSessionId: "",
      titleId: type === "cloud" ? target : "",
      systemUpdateGroup: "",
      settings: {
        nanoVersion: "V3;WebrtcTransport.dll",
        enableOptionalDataCollection: false,
        enableTextToSpeech: false,
        highContrast: 0,
        locale: this.config.locale,
        useIceConnection: false,
        timezoneOffsetMinutes: 120,
        sdkType: "web",
        osName: "windows",
      },
      serverId: type === "home" ? target : "",
      fallbackRegionNames: [],
    })) as Promise<StartStreamResponse>;
  }

  get(path: string, headers: Record<string, string> = {}) {
    return fetch(this.getBaseHost() + path, {
      headers: this.buildHeaders(headers),
    }).then(async (response) => {
      try {
        return await response.json();
      } catch (error) {
        if (response.status >= 200 && response.status <= 299) {
          return { status: response.status };
        }
        throw error;
      }
    });
  }

  post(path: string, body: string, headers: Record<string, string> = {}) {
    return fetch(this.getBaseHost() + path, {
      method: "POST",
      headers: this.buildHeaders(headers),
      body,
    }).then(async (response) => {
      try {
        return await response.json();
      } catch (error) {
        if (response.status >= 200 && response.status <= 299) {
          return { status: response.status };
        }
        throw error;
      }
    });
  }

  delete(path: string, headers: Record<string, string> = {}) {
    return fetch(this.getBaseHost() + path, {
      method: "DELETE",
      headers: this.buildHeaders(headers),
    }).then(async (response) => {
      try {
        return await response.json();
      } catch (error) {
        if (response.status >= 200 && response.status <= 299) {
          return { status: response.status };
        }
        throw error;
      }
    });
  }

  private buildHeaders(headers: Record<string, string>) {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Gssv-Client": "XboxComBrowser",
      "X-MS-Device-Info": this.getDeviceInfo(),
      ...(this.config.token ? { Authorization: `Bearer ${this.config.token}` } : {}),
      ...headers,
    };
  }

  private getDeviceInfo() {
    return JSON.stringify({
      appInfo: {
        env: {
          clientAppId: "www.xbox.com",
          clientAppType: "browser",
          clientAppVersion: "21.1.98",
          clientSdkVersion: "8.5.3",
          httpEnvironment: "prod",
          sdkInstallId: "",
        },
      },
      dev: {
        hw: {
          make: "Microsoft",
          model: "Steam Deck",
          sdktype: "web",
        },
        os: {
          name: this.config.force1080p ? "windows" : "android",
          ver: "22631.2715",
          platform: "desktop",
        },
        displayInfo: {
          dimensions: {
            widthInPixels: 1920,
            heightInPixels: 1080,
          },
          pixelDensity: {
            dpiX: 2,
            dpiY: 2,
          },
        },
        browser: {
          browserName: "chrome",
          browserVersion: "119.0",
        },
      },
    });
  }
}
