import { getBuiltinServerConfig } from '@/packages/mcp/builtin'
import { mcpController } from '@/packages/mcp/controller'
import { initSettingsStore } from '@/stores/settingsStore'
import { NODE_ENV } from '@/variables'

function monitorServerStatus() {
  const id = setInterval(() => {
    console.debug(
      'MCP Servers:',
      JSON.stringify(
        Array.from(mcpController.servers.values()).map(({ config, instance: server }) => {
          return {
            id: config.id,
            name: config.name,
            status: server.status,
          }
        }),
        null,
        2
      )
    )
  }, 10000)
  return () => clearInterval(id)
}

initSettingsStore()
  .then((settings) => {
    const { mcp, licenseKey } = settings
    const servers = [
      ...(mcp.enabledBuiltinServers || []).map((id) => getBuiltinServerConfig(id, licenseKey)).filter((s) => !!s),
      ...(mcp.servers || []), // user defined servers
    ]
    console.info(`mcp bootstrap ${servers.length} servers, with license key: ${!!licenseKey}`)
    mcpController.bootstrap(servers)
    let stopMonitor: (() => void) | undefined
    if (NODE_ENV === 'development') {
      stopMonitor = monitorServerStatus()
    }
    // Wire stopMonitor to app quit when available
    if (stopMonitor !== undefined) {
      window.addEventListener('beforeunload', stopMonitor)
    }
  })
  .catch((err) => {
    console.error('mcp bootstrap error', err)
  })
