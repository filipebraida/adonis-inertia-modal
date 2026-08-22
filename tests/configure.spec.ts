import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { test } from '@japa/runner'

import { configure } from '../configure.ts'

/**
 * Lightweight test of the configure hook: a fake Configure command records the
 * codemods calls and printed lines, so we verify the provider registration and
 * the framework detection without booting a full app. `appDir` becomes the
 * root `app.makePath` resolves against — write a package.json there to steer
 * the client detection.
 */
async function fakeCommand(appDeps?: Record<string, string>) {
  const appDir = await mkdtemp(join(tmpdir(), 'adonis-modal-configure-'))
  if (appDeps) {
    await writeFile(join(appDir, 'package.json'), JSON.stringify({ dependencies: appDeps }))
  }

  const providers: string[] = []
  const lines: string[] = []
  const codemods = {
    async updateRcFile(callback: (rc: { addProvider: (provider: string) => void }) => void) {
      callback({ addProvider: (provider) => providers.push(provider) })
    },
  }
  const command = {
    createCodemods: async () => codemods,
    app: { makePath: (...parts: string[]) => join(appDir, ...parts) },
    logger: {
      info: (line: string) => lines.push(line),
      log: (line: string) => lines.push(line),
    },
  }
  return { command, providers, lines }
}

test.group('configure', () => {
  test('registers the modal provider', async ({ assert }) => {
    const { command, providers } = await fakeCommand()

    await configure(command as never)

    assert.include(providers, 'adonis-inertia-modal/modal_provider')
  })

  test('prints only the React wiring for a React app', async ({ assert }) => {
    const { command, lines } = await fakeCommand({ '@inertiajs/react': '^3.0.0' })

    await configure(command as never)

    const output = lines.join('\n')
    assert.include(output, 'adonis-inertia-modal/react')
    assert.notInclude(output, 'adonis-inertia-modal/vue')
    assert.include(output, 'adonis-inertia-modal/styles.css')
  })

  test('prints only the Vue wiring for a Vue app', async ({ assert }) => {
    const { command, lines } = await fakeCommand({ '@inertiajs/vue3': '^3.0.0' })

    await configure(command as never)

    const output = lines.join('\n')
    assert.include(output, 'adonis-inertia-modal/vue')
    assert.notInclude(output, 'adonis-inertia-modal/react')
  })

  test('prints both wirings when the adapter cannot be told apart', async ({ assert }) => {
    // No package.json at all — same path as an unreadable or both-adapters one.
    const { command, lines } = await fakeCommand()

    await configure(command as never)

    const output = lines.join('\n')
    assert.include(output, 'adonis-inertia-modal/react')
    assert.include(output, 'adonis-inertia-modal/vue')
  })
})
