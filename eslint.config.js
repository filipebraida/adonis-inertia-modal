import { configPkg } from '@adonisjs/eslint-config'

export default [{ ignores: ['build', 'coverage', 'playground'] }, ...configPkg()]
