// Metro (o empacotador do React Native) com acesso às regras compartilhadas em ../src/domain.
// As regras de meta, datas e sequência ficam num lugar só para o site e para o app.
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../src/domain')]

module.exports = config
