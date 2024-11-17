import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { config } from './config'
import { debugLog } from './utils'

export const hostsFilePath: string = process.platform === 'win32'
  ? path.join(process.env.windir || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts')
  : '/etc/hosts'

async function sudoWrite(operation: 'append' | 'write', content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      reject(new Error('Administrator privileges required on Windows'))
      return
    }

    const tmpFile = path.join(os.tmpdir(), 'hosts.tmp')

    try {
      if (operation === 'append') {
        // For append, read current content first
        const currentContent = fs.readFileSync(hostsFilePath, 'utf8')
        fs.writeFileSync(tmpFile, currentContent + content, 'utf8')
      }
      else {
        // For write, just write the new content
        fs.writeFileSync(tmpFile, content, 'utf8')
      }

      const sudo = spawn('sudo', ['cp', tmpFile, hostsFilePath])

      sudo.on('close', (code) => {
        try {
          fs.unlinkSync(tmpFile)
          if (code === 0)
            resolve()
          else
            reject(new Error(`sudo process exited with code ${code}`))
        }
        catch (err) {
          reject(err)
        }
      })

      sudo.on('error', (err) => {
        try {
          fs.unlinkSync(tmpFile)
        }
        catch { }
        reject(err)
      })
    }
    catch (err) {
      reject(err)
    }
  })
}

export async function addHosts(hosts: string[]): Promise<void> {
  debugLog('hosts', `Adding hosts: ${hosts.join(', ')}`, config.verbose)
  debugLog('hosts', `Using hosts file at: ${hostsFilePath}`, config.verbose)

  try {
    // Read existing hosts file content
    const existingContent = await fs.promises.readFile(hostsFilePath, 'utf-8')

    // Prepare new entries, only including those that don't exist
    const newEntries = hosts.filter((host) => {
      const ipv4Entry = `127.0.0.1 ${host}`
      const ipv6Entry = `::1 ${host}`
      return !existingContent.includes(ipv4Entry) && !existingContent.includes(ipv6Entry)
    })

    if (newEntries.length === 0) {
      debugLog('hosts', 'All hosts already exist in hosts file', config.verbose)
      log.info('All hosts are already in the hosts file')
      return
    }

    // Create content for new entries
    const hostEntries = newEntries.map(host =>
      `\n# Added by rpx\n127.0.0.1 ${host}\n::1 ${host}`,
    ).join('\n')

    try {
      // Try normal write first
      await fs.promises.appendFile(hostsFilePath, hostEntries, { flag: 'a' })
      log.success(`Added new hosts: ${newEntries.join(', ')}`)
    }
    catch (writeErr) {
      if ((writeErr as NodeJS.ErrnoException).code === 'EACCES') {
        debugLog('hosts', 'Permission denied, attempting with sudo', config.verbose)
        try {
          await sudoWrite('append', hostEntries)
          log.success(`Added new hosts with sudo: ${newEntries.join(', ')}`)
        }
        // eslint-disable-next-line unused-imports/no-unused-vars
        catch (sudoErr) {
          log.error('Failed to modify hosts file automatically')
          log.warn('Please add these entries to your hosts file manually:')
          hostEntries.split('\n').forEach(entry => log.warn(entry))

          if (process.platform === 'win32') {
            log.warn('\nOn Windows:')
            log.warn('1. Run notepad as administrator')
            log.warn('2. Open C:\\Windows\\System32\\drivers\\etc\\hosts')
          }
          else {
            log.warn('\nOn Unix systems:')
            log.warn(`sudo nano ${hostsFilePath}`)
          }

          throw new Error('Failed to modify hosts file: manual intervention required')
        }
      }
      else {
        throw writeErr
      }
    }
  }
  catch (err) {
    const error = err as Error
    log.error(`Failed to manage hosts file: ${error.message}`)
    throw error
  }
}

export async function removeHosts(hosts: string[]): Promise<void> {
  debugLog('hosts', `Removing hosts: ${hosts.join(', ')}`, config.verbose)

  try {
    const content = await fs.promises.readFile(hostsFilePath, 'utf-8')
    const lines = content.split('\n')

    // Filter out our added entries and their comments
    const filteredLines = lines.filter((line, index) => {
      // If it's our comment, skip this line and the following IPv4/IPv6 entries
      if (line.trim() === '# Added by rpx') {
        // Skip next two lines (IPv4 and IPv6)
        lines.splice(index + 1, 2)
        return false
      }
      return true
    })

    // Remove empty lines at the end of the file
    while (filteredLines[filteredLines.length - 1]?.trim() === '')
      filteredLines.pop()

    // Ensure file ends with a single newline
    const newContent = `${filteredLines.join('\n')}\n`

    try {
      await fs.promises.writeFile(hostsFilePath, newContent)
      log.success('Hosts removed successfully')
    }
    catch (writeErr) {
      if ((writeErr as NodeJS.ErrnoException).code === 'EACCES') {
        debugLog('hosts', 'Permission denied, attempting with sudo', config.verbose)
        try {
          await sudoWrite('write', newContent)
          log.success('Hosts removed successfully with sudo')
        }
        // eslint-disable-next-line unused-imports/no-unused-vars
        catch (sudoErr) {
          log.error('Failed to modify hosts file automatically')
          log.warn('Please remove these entries from your hosts file manually:')
          hosts.forEach((host) => {
            log.warn('# Added by rpx')
            log.warn(`127.0.0.1 ${host}`)
            log.warn(`::1 ${host}`)
          })

          if (process.platform === 'win32') {
            log.warn('\nOn Windows:')
            log.warn('1. Run notepad as administrator')
            log.warn('2. Open C:\\Windows\\System32\\drivers\\etc\\hosts')
          }
          else {
            log.warn('\nOn Unix systems:')
            log.warn(`sudo nano ${hostsFilePath}`)
          }

          throw new Error('Failed to modify hosts file: manual intervention required')
        }
      }
      else {
        throw writeErr
      }
    }
  }
  catch (err) {
    const error = err as Error
    log.error(`Failed to remove hosts: ${error.message}`)
    throw error
  }
}

// Helper function to check if hosts exist
export async function checkHosts(hosts: string[]): Promise<boolean[]> {
  debugLog('hosts', `Checking hosts: ${hosts}`, config.verbose)

  const content = await fs.promises.readFile(hostsFilePath, 'utf-8')
  return hosts.map((host) => {
    const ipv4Entry = `127.0.0.1 ${host}`
    const ipv6Entry = `::1 ${host}`
    return content.includes(ipv4Entry) || content.includes(ipv6Entry)
  })
}
