/*
|--------------------------------------------------------------------------
| Configure hook
|--------------------------------------------------------------------------
|
| The configure hook is called when someone runs "node ace configure <package>"
| command. You are free to perform any operations inside this function to
| configure the package.
|
*/

import { readFile } from 'node:fs/promises'

import type Configure from '@adonisjs/core/commands/configure'

/**
 * Which client adapter the app uses, read from its package.json. Returns null
 * when the answer is ambiguous (both, neither, or no readable package.json) —
 * the caller then prints the wiring for both frameworks.
 */
async function detectClient(command: Configure): Promise<'react' | 'vue' | null> {
  try {
    const raw = await readFile(command.app.makePath('package.json'), 'utf-8')
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    const react = '@inertiajs/react' in deps
    const vue = '@inertiajs/vue3' in deps
    if (react !== vue) {
      return react ? 'react' : 'vue'
    }
  } catch {
    // Fall through to printing both wirings.
  }
  return null
}

function printReactWiring(command: Configure) {
  command.logger.log('  React:')
  command.logger.log('  1. Wrap your app with <ModalStackProvider> in your Inertia entrypoint:')
  command.logger.log("       import { ModalStackProvider } from 'adonis-inertia-modal/react'")
  command.logger.log('       // <ModalStackProvider><App {...props} /></ModalStackProvider>')
  command.logger.log('')
  command.logger.log('  2. Render <ModalRoot /> once inside your app (e.g. in a layout):')
  command.logger.log("       import { ModalRoot } from 'adonis-inertia-modal/react'")
}

function printVueWiring(command: Configure) {
  command.logger.log('  Vue 3:')
  command.logger.log('  1. Install the plugin in your Inertia entrypoint:')
  command.logger.log("       import { modal } from 'adonis-inertia-modal/vue'")
  command.logger.log(
    '       // .use(modal, { resolveComponent: (name) => resolvePageComponent(...) })'
  )
  command.logger.log('')
  command.logger.log('  2. Render <ModalRoot /> once inside your app (e.g. in a layout):')
  command.logger.log("       import { ModalRoot } from 'adonis-inertia-modal/vue'")
}

export async function configure(command: Configure) {
  const codemods = await command.createCodemods()

  /**
   * Register the provider that extends `ctx.inertia` with `modal()`.
   */
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('adonis-inertia-modal/modal_provider')
  })

  /**
   * Manual frontend wiring can't be safely codemodded, so we print the steps
   * for the adapter the app actually uses (both when we can't tell).
   */
  const client = await detectClient(command)

  command.logger.info('adonis-inertia-modal is configured. Finish the frontend wiring:')
  command.logger.log('')
  if (client !== 'vue') {
    printReactWiring(command)
    command.logger.log('')
  }
  if (client !== 'react') {
    printVueWiring(command)
    command.logger.log('')
  }
  command.logger.log('  Import the styles once (e.g. in your app entrypoint):')
  command.logger.log("       import 'adonis-inertia-modal/styles.css'")
}
