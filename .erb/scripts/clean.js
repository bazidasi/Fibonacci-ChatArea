import { rimrafSync } from 'rimraf'
import fs from 'fs'
import { execSync } from 'child_process'
import webpackPaths from '../configs/webpack.paths'

const foldersToRemove = [
    webpackPaths.distPath,
    webpackPaths.appNodeModulesPath,
    webpackPaths.buildPath,
    webpackPaths.dllPath,
]

const productName = 'Fibonacci Chat Area'

/**
 * Windows: a previously packaged app (release/build/win-unpacked) left running,
 * an antivirus scan (Windows Defender), or an open Explorer window inside the
 * output folder can hold a lock on files such as resources/app.asar. Deleting
 * the previous build then fails with EBUSY/EPERM ("resource busy or locked").
 *
 * Mitigations, in order:
 *  1. Best-effort terminate a running unpacked build of this app (Windows only),
 *     which is the most common lock holder.
 *  2. Give rimraf a generous retry budget for transient EBUSY/EPERM locks
 *     (up to ~45s of retries with exponential backoff).
 *  3. If a folder still cannot be removed, fail with an actionable message
 *     instead of a raw EBUSY stack trace.
 */
function killRunningUnpackedApp() {
    if (process.platform !== 'win32') return
    const exeNames = [`${productName}.exe`]
    for (const exe of exeNames) {
        try {
            // /T also kills child processes spawned by the app (GPU/renderer helpers).
            execSync(`taskkill /F /IM "${exe}" /T`, { stdio: 'ignore' })
            console.log(`[clean] Terminated a running "${exe}" that was locking the previous build output`)
        } catch {
            // App not running (or could not be terminated) — nothing to do.
        }
    }
}

function removeFolder(folder) {
    rimrafSync(folder, { maxRetries: 30, backoff: 1.5, retryDelay: 500 })
}

killRunningUnpackedApp()

foldersToRemove.forEach((folder) => {
    if (!fs.existsSync(folder)) return
    try {
        removeFolder(folder)
    } catch (error) {
        console.error(`
[clean] Failed to delete: ${folder}
Reason: ${error && error.message ? error.message : error}

On Windows this is almost always caused by a file lock from one of the following:

  1. A still-running build of "${productName}" (release/build/win-unpacked).
     -> Close the app (also check the system tray), then re-run the packaging script.

  2. Antivirus / Windows Defender scanning resources\\app.asar.
     -> Add an exclusion for the project's "release" folder, then re-run.

  3. An Explorer (File Explorer) window open inside release\\build.
     -> Navigate away from that folder or close the window, then re-run.

After closing the locking program, you can also delete the folder manually and re-run:
  Remove-Item -Recurse -Force "<project>\\release\\build"
`)
        process.exit(1)
    }
})
