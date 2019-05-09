/**
 * @file index
 * @author Jim Bulkowski <jim.b@paperelectron.com>
 * @project sequelize-core
 * @license MIT {@link http://opensource.org/licenses/MIT}
 */
import {map, get, isFunction, reduce, each, capitalize, toLower, merge,fromPairs, forOwn} from 'lodash/fp'
import {CreatePlugin} from "@pomegranate/plugin-tools";


export const Plugin = CreatePlugin('merge')
  .variables({
    host: 'localhost',
    port: 5432,
    username: null,
    password: null,
    database: null,
    additionalOptions: {},
  })
  .configuration({
    name: 'SequelizePG',
    injectableParam: 'SQL',
    applicationMember: ['Sequelize'],
    depends: ['@pomofficial/SequelizeModels']
  })
  .hooks({
    load: async (Injector, PluginVariables, PluginFiles, PluginLogger, SQL, SequelizeModels) => {

      const actualOptions = merge(PluginVariables.additionalOptions, {
        host: PluginVariables.host,
        database: PluginVariables.database,
        username: PluginVariables.username,
        password: PluginVariables.password,
        dialect: 'postgres',
        logging: PluginVariables.logging
      })

      const sequelize = new SQL.Sequelize(actualOptions);

      Injector.anything('Sequelize', SQL.Sequelize)
      Injector.anything('SequelizeConnection', sequelize)

      // let allModels = reduce((acc, [name, modelClass]) => {
      //   let i = Injector.inject(modelClass)
      //   acc[name] = i
      //   return acc
      // }, {}, SequelizeModels)


      let allModels = map(([name, modelInjectable]) => {
        return [name, Injector.inject(modelInjectable)]
      }, SequelizeModels)

      let modelStore = fromPairs(allModels)

      each(([name, modelClass]) => {
        if (isFunction(modelClass.associate)) {
          PluginLogger.log(`Creating associations for ${name} `, 2)
          modelClass.associate(modelStore)
        }
      }, allModels)

      modelStore.SequelizeConnection = sequelize
      return modelStore
    },
    start: async (SequelizeConnection, PluginVariables, PluginLogger) => {
      let authed = await SequelizeConnection.authenticate()
      await SequelizeConnection.sync({force: false, alter: PluginVariables.alterTables})
      PluginLogger.log('Connected')
      return null
    },
    stop: async (SequelizeConnection, PluginLogger) => {
      await SequelizeConnection.close()
      PluginLogger.log('Connection Closed')
      return null
    }
  })