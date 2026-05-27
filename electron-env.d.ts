/// <reference types="vite/client" />
/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
    interface ProcessEnv {
        readonly APP_ROOT: string
        readonly VITE_DEV_SERVER_URL: string
    }
}


