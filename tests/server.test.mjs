import test from 'node:test'
import assert from 'node:assert'
import { EventEmitter } from 'node:events'
import { existsSync, rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createChatService } from '../src/server.mjs'

function createHttpServerStub () {
  return new EventEmitter()
}

test('Server: creates persistence directory when missing', async () => {
  const baseDir = mkdtempSync(join(tmpdir(), 'hubot-chat-'))
  const persistPath = join(baseDir, 'nested', 'chat.sqlite')

  assert.equal(existsSync(join(baseDir, 'nested')), false)

  const service = createChatService({
    httpServer: createHttpServerStub(),
    router: null,
    options: { persistPath }
  })

  assert.equal(existsSync(join(baseDir, 'nested')), true)
  assert.equal(existsSync(persistPath), true)

  if (service.persistence) service.persistence.close()
  rmSync(baseDir, { recursive: true, force: true })
})
